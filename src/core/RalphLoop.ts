/**
 * RalphLoop - Self-recursive iteration engine for Liminal
 *
 * Implements the Ralph-Wiggum Loop pattern:
 * - Same prompt every iteration
 * - Context changes each iteration (previous work, history)
 * - Self-evaluation and improvement
 * - Terminates on promise detection or max-iterations
 *
 * This module is now a thin orchestrator that delegates to extracted modules:
 * - LoopConfig: types and normalization
 * - ContextBuilder: context accumulation formatting
 * - PromptEnhancer: compost seed/DNA/archive injection
 * - GenerationOrchestrator: swarm/collab/generator dispatch
 * - EvolutionIntegration: MAP-Elites + novelty + aesthetic
 * - LoopPersistence: gallery save + merge-every-N
 * - StagnationDetector: stagnation + self-reflection
 * - OrganismLoop: organism mode
 */

import { getEvalMode, getRepairMode } from '../config/FeatureFlags.js';
import type { GenerationEvaluation, ConcreteRepairAdvice } from '../core/types/GenerationEvaluation.js';
import { GeneratorHarnessTools } from '../generators/GeneratorHarnessTools.js';
import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
import type { EntropyResult } from '../entropy/types.js';
import { Domain } from '../types/domains.js';
import { PromptStore } from './PromptStore.js';
import path from 'node:path';
import { ContextAccumulation } from './ContextAccumulation.js';
import { ScoringEngine } from './ScoringEngine.js';
import { PromiseDetector } from './PromiseDetector.js';
import { Gallery } from '../gallery/Gallery.js';
import { LiminalFS } from '../fs/LiminalFS.js';
import { SafetyGuardrails } from './SafetyGuardrails.js';
import { CompostHeap } from '../compost/CompostHeap.js';
import { formatError } from '../utils/errors.js';
import { CodeValidator } from './CodeValidator.js';
import { CompostMill } from '../compost/CompostMill.js';
import { mergeConfig as mergeCompostConfig } from '../compost/defaults.js';
import { ArchiveLearning } from '../learning/index.js';
import { QualityArchive } from '../learning/index.js';
import { AestheticModel } from '../evolution/AestheticModel.js';
import { recordRoutingOutcome } from '../routing/RoutingData.js';
import { eventBus, EventTypes } from './EventBus.js';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';
import { metaHarness } from '../harness/MetaHarnessIntegration.js';
import { LLMGenerationError } from '../errors/LLMGenerationError.js';

// Extracted modules
import {
  normalizeOptions,
  DEFAULT_MAX_ITERATIONS,
  type LoopOptions,
  type LoopResult,
  type IterationContext,
  type NormalizedLoopOptions,
} from './LoopConfig.js';
import { GeneratedCodeParser } from './lir/GeneratedCodeParser.js';
import type { LIREvaluationContext } from '../aesthetic/types.js';
import { buildContextForInjection } from './ContextBuilder.js';
import { enhancePrompt } from './PromptEnhancer.js';
import { GenerationOrchestrator } from './GenerationOrchestrator.js';
import { EvolutionIntegration } from './EvolutionIntegration.js';
import { EvolutionEngine, type EvolutionProposal } from '../evolution/EvolutionEngine.js';
import { LoopPersistence } from './LoopPersistence.js';
import { StagnationDetector } from './StagnationDetector.js';
import { SuccessRateTracker } from './SuccessRateTracker.js';
import { GitIntegration } from '../git/GitIntegration.js';
import { runOrganismMode } from './OrganismLoop.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import { env } from '../utils/env.js';
import { Provider } from '../types/providers.js';
import { LiminalError } from '../errors/index.js';

export type { LoopOptions, LoopResult, IterationContext, NormalizedLoopOptions };

// DF3 shared contracts: imported for downstream use, referenced to satisfy TS
void getEvalMode;
void getRepairMode;
void 0 as unknown as GenerationEvaluation;

export class RalphLoop {
  /**
   * Run the Ralph-Wiggum Loop
   *
   * @param prompt - The prompt to use for all iterations
   * @param options - Optional configuration
   * @returns Loop result with code, iterations, and metadata
   */
  static async run(prompt: string, options: LoopOptions | null = {}): Promise<LoopResult> {
    const startTime = Date.now();
    const normalizedOptions = normalizeOptions(options);

    // Generate session ID once per run for git branch reuse and stash namespacing
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    eventBus.emit(EventTypes.PROCESS_START, 'RalphLoop', { process: 'ralph-loop', maxIterations: normalizedOptions.maxIterations });

    // Ambiguity pre-check: warn if prompt has unresolved ambiguities
    const ambiguityIssues = new AmbiguityDetector().detect(prompt);
    if (ambiguityIssues.length > 0) {
      const highPriority = ambiguityIssues.filter(i => i.severity === 'high');
      if (highPriority.length > 0) {
        Logger.warn('RalphLoop', `Prompt has ${highPriority.length} high-priority ambiguity issues:`);
        for (const issue of highPriority) {
          Logger.warn('RalphLoop', `  [${issue.type}] ${issue.description}`);
        }
      }
    }

    // Warn if swarm mode is used with non-Ollama provider
    if (normalizedOptions.useSwarm) {
      const provider = env('LLM_PROVIDER') || Provider.LMSTUDIO;
      if (provider !== Provider.OLLAMA) {
        Logger.warn('RalphLoop', `Swarm mode is designed for Ollama. Current provider is "${provider}". Swarm may not work correctly.`);
      }
    }

    // Organism mode: delegate entirely to OrganismLoop
    if (normalizedOptions.mode === 'organism') {
      return runOrganismMode(prompt, normalizedOptions, startTime);
    }

    // Initialize subsystems
    const gallery = new Gallery(normalizedOptions.galleryDir);
    const liminalFs = LiminalFS.open(process.cwd());
    const projectStore = liminalFs.getProjectStore();
    const stagnation = new StagnationDetector(normalizedOptions.stagnationThreshold ?? 7);
    const successRateTracker = new SuccessRateTracker({
      windowSize: 20,
      explorationThreshold: 0.2,
      recoveryThreshold: 0.3,
    });

    // Git integration — auto-on, agent manages version control behind the scenes
    const gitIntegration = new GitIntegration(normalizedOptions.git ?? {});
    await gitIntegration.startRun(normalizedOptions.project ?? `run-${Date.now()}`, sessionId);

    // Voice-driven visual mapping: analyze audio file if provided
    if (normalizedOptions.voiceFile && !normalizedOptions.visualMappingParams) {
      try {
        const { AudioAnalyzer } = await import('../audio/index.js');
        const { spawn } = await import('child_process');

        // Decode audio file to raw PCM (s16le, mono, 44100Hz) via ffmpeg
        // Use spawn with timeout to prevent zombie processes
        const ffmpegProcess = spawn('ffmpeg', [
          '-i', normalizedOptions.voiceFile,
          '-f', 's16le',
          '-ac', '1',
          '-ar', '44100',
          '-v', 'quiet',
          'pipe:1',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        // Set up timeout to kill hanging processes
        const FFMPEG_TIMEOUT_MS = 30000; // 30 seconds
        const timeout = setTimeout(() => {
          Logger.warn('RalphLoop', 'ffmpeg timeout reached, killing process');
          ffmpegProcess.kill('SIGTERM');
          // Force kill after grace period
          setTimeout(() => {
            if (!ffmpegProcess.killed) {
              ffmpegProcess.kill('SIGKILL');
            }
          }, 5000);
        }, FFMPEG_TIMEOUT_MS);

        // Collect stdout data
        const chunks: Buffer[] = [];
        ffmpegProcess.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));

        // Wait for process to complete
        const exitCode = await new Promise<number | null>((resolve) => {
          ffmpegProcess.on('close', (code) => resolve(code));
          ffmpegProcess.on('error', () => resolve(null));
        });

        clearTimeout(timeout);

        if (exitCode !== 0) {
          throw new LLMGenerationError(`ffmpeg exited with code ${exitCode}`, { model: 'ffmpeg' });
        }

        const pcmBuffer = Buffer.concat(chunks);

        // Convert Int16 PCM to Float32 (-1.0 to 1.0)
        const int16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768;
        }

        const analyzer = new AudioAnalyzer();
        const result = analyzer.analyze(float32, 44100);
        const visualMapping = analyzer.getVisualMapping(result);
        // eslint-disable-next-line require-atomic-updates
        normalizedOptions.visualMappingParams = visualMapping as unknown as Record<string, unknown>;
        Logger.info('RalphLoop', `Voice analysis complete: mapped audio features to visual params`);
      } catch (err) {
        Logger.warn('RalphLoop', `Voice analysis failed (is ffmpeg installed?), continuing without visual mapping: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Mic-driven visual mapping
    if (normalizedOptions.voice && !normalizedOptions.visualMappingParams) {
      try {
        const { captureMicAudio } = await import('../audio/MicCapture.js');
        const { AudioAnalyzer } = await import('../audio/index.js');
        const float32 = await captureMicAudio();
        const analyzer = new AudioAnalyzer();
        const result = analyzer.analyze(float32);
        // eslint-disable-next-line require-atomic-updates
        normalizedOptions.visualMappingParams = analyzer.getVisualMapping(result) as unknown as Record<string, unknown>;
        Logger.info('RalphLoop', `Mic capture analysis complete: mapped audio features to visual params`);
      } catch (err) {
        Logger.warn('RalphLoop', `Mic capture failed, continuing without visual mapping: ${err instanceof Error ? err.message : err}`);
      }
    }

    let archiveLearning: ArchiveLearning | null = null;
    let qualityArchive: QualityArchive | null = null;
    let aestheticModel: AestheticModel | null = null;

    if (normalizedOptions.useArchiveLearning) {
      archiveLearning = new ArchiveLearning({ archivePath: normalizedOptions.archivePath });
      qualityArchive = archiveLearning.getArchive();
      await qualityArchive.load();
    }

    if (normalizedOptions.useAestheticModel) {
      aestheticModel = new AestheticModel();
      const aestheticPath = `${process.env.HOME}/.liminal/aesthetic_model.json`;
      await aestheticModel.load(aestheticPath).catch((err) => { Logger.warn('RalphLoop', 'Failed to load aesthetic model:', err); });
    }

    if (normalizedOptions.useMapElites) {
      const mapElitesPath = `${process.env.HOME}/.liminal/map_elites.json`;
      const mapElites = normalizedOptions._mapElites;
      if (mapElites) {
        await mapElites.load(mapElitesPath).catch((err) => { Logger.warn('RalphLoop', 'Failed to load MAP-Elites archive:', err); });
      }
    }

    const evolution = new EvolutionIntegration(normalizedOptions, aestheticModel);
    const persistence = new LoopPersistence(gallery, normalizedOptions, liminalFs);
    const generator = new GenerationOrchestrator(normalizedOptions, gallery, archiveLearning);

    // DF3 Phase 8: EvolutionEngine for adaptive loop tuning
    const recentScores: number[] = [];
    const evolutionEngine = normalizedOptions.useEvolution
      ? new EvolutionEngine({
          recentScores,
          currentPolicy: {
            minQualityScore: normalizedOptions.minQualityScore,
            maxIterations: normalizedOptions.maxIterations,
          },
        })
      : undefined;

    // DF3 Phase 4: Pre-digest compost for seed-aware initial generation
    let compostMaterials: import('../compost/types.js').GenerationMaterials | undefined;
    if (normalizedOptions.autoCompost || normalizedOptions.useCompostEnhancement) {
      try {
        const compostConfig = mergeCompostConfig();
        const mill = new CompostMill(new LLMClient({ role: 'generator' }), { ...compostConfig, projectStore });
        await mill.digest();
        compostMaterials = await mill.getGenerationMaterials(normalizedOptions.collabDomain || 'p5');
      } catch (err) {
        Logger.warn('RalphLoop', 'Compost digest for generation failed:', err);
      }
    }

    let iteration = 0;
    let completed = false;
    let reason = '';
    let currentCode = '';
    let previousCode = '';
    let finalScore = 0;
    let lastThinking: string | undefined;
    let lastModel: string | undefined;

    // Convergence tracking: score history for detecting plateau
    const scoreHistory: number[] = [];
    const CONVERGENCE_WINDOW = 3;
    const CONVERGENCE_THRESHOLD = 0.01;

    // DF3 Phase 2: repair history for repeated-failure detection
    const repairHistory: GenerationEvaluation[] = [];

    const evalMode = getEvalMode();

    // Main loop
    try {
    while (iteration < normalizedOptions.maxIterations) {
      if (normalizedOptions.signal?.aborted) {
        reason = 'aborted by user';
        break;
      }

      // Safety guardrails check
      if (normalizedOptions.safetyConfig) {
        const guardrails = new SafetyGuardrails(normalizedOptions.safetyConfig);
        if (!guardrails.checkAll(finalScore)) {
          reason = 'safety guardrails triggered';
          break;
        }
        guardrails.recordApiCall();
      }

      iteration++;

      try {
        // Emit thoughts during generation for chat display
        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Starting iteration ${iteration}...`);
          normalizedOptions.onThought?.('Loading prompt...');
        }

        // Load prompt (same every time)
        const loadedPrompt = PromptStore.load(prompt);

        // Build context and enhance prompt
        // Pass previous code to generate unique hash for cache defeat
        const contextForInjection = buildContextForInjection(iteration, normalizedOptions, prompt, loadedPrompt, previousCode);
        let usedPrompt = PromptStore.injectContext(loadedPrompt, contextForInjection);
        if (usedPrompt === loadedPrompt) {
          usedPrompt = loadedPrompt + '\n\n---\nContext from previous iterations:\n' + contextForInjection;
        }

        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.('Enhancing prompt with context and compost...');
        }

        // DF3 Phase 8: Apply EvolutionEngine proposals for this iteration only
        let evoProposal: EvolutionProposal | undefined;
        const evoRestores: Array<() => void> = [];
        if (evolutionEngine && recentScores.length > 2) {
          const rawProposal = evolutionEngine.propose();
          if (rawProposal) {
            evoProposal = { ...rawProposal, delta: evolutionEngine.clamp(rawProposal.delta) };
            Logger.info('RalphLoop', `Evolution proposal (${evoProposal.type}): ${evoProposal.description}`);
            if (evoProposal.delta.promptPrefix) {
              usedPrompt = evoProposal.delta.promptPrefix + usedPrompt;
            }
            if (evoProposal.delta.promptSuffix) {
              usedPrompt = usedPrompt + evoProposal.delta.promptSuffix;
            }
            if (evoProposal.delta.minQualityScoreAdjustment !== undefined) {
              const original = normalizedOptions.minQualityScore;
              normalizedOptions.minQualityScore = Math.max(0, Math.min(1, normalizedOptions.minQualityScore + evoProposal.delta.minQualityScoreAdjustment));
              evoRestores.push(() => { normalizedOptions.minQualityScore = original; });
            }
          }
        }

        // Generate intuition hint if enabled
        let intuitionHint: string | undefined;
        if (normalizedOptions.useIntuition) {
          try {
            const { IntuitionEngine } = await import('../intuition/index.js');
            const intuitionEngine = new IntuitionEngine();
            intuitionHint = intuitionEngine.generateHint(normalizedOptions.project ?? 'default', 200);
          } catch (err) {
            Logger.warn('RalphLoop', 'Intuition hint generation failed:', err);
          }
        }

        // Enhance with compost seed, DNA, and archive examples
        // eslint-disable-next-line require-atomic-updates
        usedPrompt = await enhancePrompt(usedPrompt, loadedPrompt, normalizedOptions, archiveLearning, compostMaterials, intuitionHint);

        // Adjust numCandidates based on success rate for high-exploration mode
        const adjustedNumCandidates = successRateTracker.getRecommendedCandidates(normalizedOptions.numCandidates ?? 1);
        if (adjustedNumCandidates !== (normalizedOptions.numCandidates ?? 1) && normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Increasing to ${adjustedNumCandidates} candidates for exploration...`);
        }

        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Generating ${adjustedNumCandidates} candidate(s)...`);
        }

        // Best-of-N: Generate multiple candidates with bounded parallelism
        let numCandidates = adjustedNumCandidates;
        const candidates: Array<{ code: string; score: number; issues: string[]; index: number; thinking?: string; model?: string; genEval?: GenerationEvaluation }> = [];
        let lastGenerationError: Error | undefined;

        // Harvest entropy before generation if enabled
        let entropyEngine: MetabolicEntropyEngine | undefined;
        let entropyResult: EntropyResult | undefined;
        if (normalizedOptions.useEntropy) {
          try {
            entropyEngine = new MetabolicEntropyEngine({
              eventStore: { getRecent: () => [] },
              heap: { listFiles: async () => [] },
              telemetry: { getSummary: () => ({ successRate: 0, avgDurationMs: 0, totalTasks: 0, totalViolations: 0 }) },
            });
            entropyResult = await entropyEngine.harvest();
          } catch (err) {
            Logger.warn('RalphLoop', 'Entropy harvest failed:', err);
          }
        }

        // Use entropy for candidate search breadth (bounded)
        if (entropyResult && entropyResult.seed % 2 === 0) {
          numCandidates += 1;
        }

        const harnessTools = entropyEngine
          ? new GeneratorHarnessTools({ entropySource: entropyEngine })
          : new GeneratorHarnessTools({ seededRandom: Math.random });
        const maxParallelism = normalizedOptions.maxParallelism ?? 3;

        for (let batchStart = 0; batchStart < numCandidates; batchStart += maxParallelism) {
          const batchEnd = Math.min(batchStart + maxParallelism, numCandidates);
          const batchPromises: Promise<{ code: string; score: number; issues: string[]; index: number; thinking?: string; model?: string } | undefined>[] = [];

          for (let i = batchStart; i < batchEnd; i++) {
            batchPromises.push(
              (async (index: number) => {
                try {
                  const diversityPrompt = normalizedOptions.swarmDiversify
                    ? harnessTools.buildDiversityPrompt(usedPrompt, index, numCandidates, entropyResult?.phrase)
                    : usedPrompt;
                  // Generate code (bypass cache to ensure fresh generation each iteration)
                  // Ralph Loop requires fresh LLM calls each iteration - caching would defeat the iterative improvement pattern
                  const generationResult = await generator.generate(diversityPrompt, loadedPrompt, true);

                  if (generationResult.needsClarification) {
                    const msgs = generationResult.clarifyingQuestions.map(q => q.question).join('; ');
                    throw new Error(
                      `Ambiguous prompt — please clarify before running RalphLoop:\n${msgs}\n\n` +
                      `Detected intent: ${generationResult.suggestions.join(', ') || 'unknown'}`
                    );
                  }

                  const { code, thinking, model } = generationResult;

                  // Validate generated code before accepting it
                  const validation = CodeValidator.validate(code);

                  if (!validation.valid) {
                    Logger.warn('RalphLoop', `Candidate ${index} validation failed: ${validation.errors.join('; ')}`);
                    // Report validation failure to Meta-Harness (skip during tests to avoid log pollution)
                    if (process.env.NODE_ENV !== 'test') {
                      await metaHarness.onGenerationComplete({
                        success: false,
                        model: normalizedOptions.useSwarm ? 'swarm' : 'local',
                        domain: normalizedOptions.collabDomain || 'p5',
                        prompt: prompt,
                        code: code,
                        error: `Validation failed: ${validation.errors.join('; ')}`,
                        duration: Date.now() - startTime,
                      });
                    }
                    // Skip this candidate - don't add to candidates list
                    return undefined;
                  }

                  const candidateCode = validation.cleanedCode;

                  // Check code completeness (structural - braces, parens balanced)
                  const isComplete = RalphLoop.isCodeComplete(candidateCode);

                  // Quick score for candidate selection (simpler than full evaluation)
                  // We'll do full evaluation on the best candidate
                  const quickScore = isComplete ? 0.5 : 0.3; // Basic completeness bonus

                  return {
                    code: candidateCode,
                    score: quickScore, // Will be replaced with full score
                    issues: [],
                    index,
                    thinking,
                    model,
                  };
                } catch (candidateError) {
                  Logger.warn('RalphLoop', `Candidate ${index} generation failed: ${formatError('RalphLoop', candidateError)}`);
                  lastGenerationError = candidateError instanceof Error ? candidateError : new Error(String(candidateError));
                  // Continue to next candidate
                  if (!normalizedOptions.tolerateErrors) {
                    throw lastGenerationError;
                  }
                  return undefined;
                }
              })(i)
            );
          }

          const batchResults = await Promise.all(batchPromises);
          for (const result of batchResults) {
            if (result) {
              candidates.push(result);
            }
          }
        }

        // Select the best candidate or fail if none valid
        if (candidates.length === 0) {
          throw new LiminalError(
            'All generation candidates failed',
            'ERR_ALL_CANDIDATES_FAILED',
            {
              attempts: numCandidates,
              lastError: lastGenerationError?.message,
            }
          );
        } else {
          // For single candidate (default), just use it
          // For multiple candidates, we need to fully evaluate each to find the best
          let bestCandidate = candidates[0];

          if (candidates.length > 1) {
            // Score all candidates fully to find the best using GenerationEvaluation contract
            const candidateEvaluations: GenerationEvaluation[] = [];
            for (let i = 0; i < candidates.length; i++) {
              const candidate = candidates[i];
              try {
                // LIR: Parse generated code into structured tokens if enabled
                let lirContext: LIREvaluationContext | undefined;
                if (normalizedOptions.lirEnabled) {
                  try {
                    const genParser = new GeneratedCodeParser();
                    const lirTokens = genParser.parse(candidate.code);
                    if (lirTokens.length > 0) {
                      lirContext = {
                        lirTokens,
                        visualIntent: normalizedOptions.visualMappingParams as any,
                        lirEnabled: true,
                      };
                    }
                  } catch (err) {
                    Logger.debug('RalphLoop', 'LIR parsing failed, regex fallback will be used:', err);
                    // LIR parsing failed — regex fallback will be used
                  }
                }

                let genEval: GenerationEvaluation;
                if (evalMode === 'auto' || evalMode === 'strict-browser') {
                  const { HeadlessRenderer } = await import('../render/HeadlessRenderer.js');
                  const renderer = HeadlessRenderer.getInstance();
                  const renderEvidence = await renderer.renderWithEvidence(candidate.code, {
                    domain: (normalizedOptions.collabDomain || 'p5') as import('../render/HeadlessRenderer.js').RenderDomain,
                    width: 400,
                    height: 400,
                  });

                  if (renderEvidence.infraUnavailable) {
                    if (evalMode === 'strict-browser') {
                      throw new LiminalError(
                        'Browser rendering infrastructure is unavailable in strict-browser mode',
                        'ERR_RENDER_INFRA_UNAVAILABLE',
                      );
                    }
                    Logger.warn('RalphLoop', 'Browser render infra unavailable, falling back to legacy scoring for candidate');
                    const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                    const quickEvaluation = await scoringEngine.scoreReliable({
                      output: candidate.code,
                      criteria: normalizedOptions.evaluationCriteria,
                      lirContext,
                    });
                    genEval = {
                      score: quickEvaluation.score,
                      confidence: 1,
                      failureClass: 'none',
                      repairAdvice: quickEvaluation.issues?.[0]
                        ? { issue: quickEvaluation.issues[0], fix: 'Address the reported issue and regenerate.', constraint: 'Return a complete, runnable artifact.' }
                        : undefined,
                    };
                    candidate.score = quickEvaluation.score;
                    candidate.issues = quickEvaluation.issues ?? [];
                  } else {
                    const { scoreRenderedEvidence } = await import('../core/ScoringEngine.js');
                    genEval = await scoreRenderedEvidence(
                      renderEvidence,
                      candidate.code,
                      prompt,
                      undefined,
                    );
                    if (genEval.failureClass === 'scorer') {
                      if (evalMode === 'strict-browser') {
                        throw new LiminalError(
                          'Evaluator LLM is unavailable in strict-browser mode',
                          'ERR_EVALUATOR_UNAVAILABLE',
                        );
                      }
                      Logger.warn('RalphLoop', 'Evaluator LLM unavailable for rendered-evidence scoring, falling back to legacy scoring for candidate');
                      const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                      const quickEvaluation = await scoringEngine.scoreReliable({
                        output: candidate.code,
                        criteria: normalizedOptions.evaluationCriteria,
                        lirContext,
                      });
                      genEval = {
                        score: quickEvaluation.score,
                        confidence: 1,
                        failureClass: 'none',
                        repairAdvice: quickEvaluation.issues?.[0]
                          ? { issue: quickEvaluation.issues[0], fix: 'Address the reported issue and regenerate.', constraint: 'Return a complete, runnable artifact.' }
                          : undefined,
                      };
                      candidate.score = quickEvaluation.score;
                      candidate.issues = quickEvaluation.issues ?? [];
                    } else {
                      candidate.score = genEval.score;
                      candidate.issues = genEval.repairAdvice ? [genEval.repairAdvice.issue] : [];
                    }
                  }
                } else {
                  const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                  const quickEvaluation = await scoringEngine.scoreReliable({
                    output: candidate.code,
                    criteria: normalizedOptions.evaluationCriteria,
                    lirContext,
                  });
                  genEval = {
                    score: quickEvaluation.score,
                    confidence: 1,
                    failureClass: 'none',
                    repairAdvice: quickEvaluation.issues?.[0]
                      ? { issue: quickEvaluation.issues[0], fix: 'Address the reported issue and regenerate.', constraint: 'Return a complete, runnable artifact.' }
                      : undefined,
                  };
                  candidate.score = quickEvaluation.score;
                  candidate.issues = quickEvaluation.issues ?? [];
                }

                candidate.genEval = genEval;
                candidateEvaluations.push(genEval);
              } catch (scoringError) {
                Logger.warn('RalphLoop', `Failed to score candidate ${candidate.index}: ${formatError('RalphLoop', scoringError)}`);
                const fallbackEval: GenerationEvaluation = {
                  score: candidate.score,
                  confidence: 0,
                  failureClass: 'scorer',
                };
                candidate.genEval = fallbackEval;
                candidateEvaluations.push(fallbackEval);
              }
            }

            const { winnerIndex } = harnessTools.rankCandidates(
              candidates.map(c => c.code),
              candidateEvaluations,
            );
            if (winnerIndex === -1) {
              Logger.warn('RalphLoop', 'Candidate evaluations are empty; falling back to first candidate');
            }
            bestCandidate = candidates[winnerIndex] ?? candidates[0];

            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.(`Selected candidate ${bestCandidate.index + 1}/${numCandidates} (score: ${bestCandidate.score.toFixed(2)})`);
            }
          }

          currentCode = bestCandidate.code;
          lastThinking = bestCandidate.thinking;
          lastModel = bestCandidate.model;
        }

        // Check code completeness (structural - braces, parens balanced)
        const isComplete = RalphLoop.isCodeComplete(currentCode);
        
        // Runtime validation: test if code actually works
        let runtimeValid = true;
        let runtimeError = '';
        
        // Detect output type and run appropriate runtime test
        const outputType = detectOutputType(currentCode);
        if (outputType === Domain.GLSL) {
          // For GLSL, we can't easily test in Node, but we can check syntax
          const hasMain = /void\s+main\s*\(/.test(currentCode);
          const hasFragColor = /gl_FragColor/.test(currentCode);
          if (!hasMain || !hasFragColor) {
            runtimeValid = false;
            runtimeError = 'Missing main() or gl_FragColor';
          }
        }
        
        // Log runtime validation results
        if (!runtimeValid) {
          Logger.warn('RalphLoop', `Runtime validation failed: ${runtimeError}`);
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.(`Runtime check failed: ${runtimeError}`);
          }
        }

        // Diagnostic: Log that we got fresh code (not from cache)
        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Generated ${currentCode.length} characters of code (iteration ${iteration})`);
        }

        // Evaluate quality
        // If we already evaluated multiple candidates, use the best candidate's score
        // Otherwise, run evaluation for the single candidate
        let evaluation: { score: number; issues?: string[]; dimensions?: Record<string, number>; repairAdvice?: ConcreteRepairAdvice };
        let lirContext: LIREvaluationContext | undefined;

        // Handle case where all candidates failed validation
        if (candidates.length === 0) {
          evaluation = { score: 0, issues: ['All candidates failed validation'] };
        } else if (candidates.length > 1) {
          // We already evaluated all candidates, use the best one's score
          const bestCandidate = candidates.find(c => c.code === currentCode);
          evaluation = {
            score: bestCandidate?.score ?? 0,
            issues: bestCandidate?.issues ?? [],
            dimensions: {},
            repairAdvice: bestCandidate?.genEval?.repairAdvice,
          };
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.(`Using pre-evaluated score: ${evaluation.score.toFixed(2)}`);
          }
        } else {
          // Single candidate - run full evaluation
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.('Evaluating code quality...');
          }

          // LIR: Parse generated code into structured tokens if enabled
          if (normalizedOptions.lirEnabled) {
            try {
              const genParser = new GeneratedCodeParser();
              const lirTokens = genParser.parse(currentCode);
              if (lirTokens.length > 0) {
                lirContext = {
                  lirTokens,
                  visualIntent: normalizedOptions.visualMappingParams as any,
                  lirEnabled: true,
                };
              }
            } catch (err) {
              Logger.debug('RalphLoop', 'LIR parsing failed, regex fallback will be used:', err);
              // LIR parsing failed — regex fallback will be used
            }
          }

          // DF3 Phase 1: eval-mode-aware scoring with browser-render evidence
          if (evalMode === 'auto' || evalMode === 'strict-browser') {
            const { HeadlessRenderer } = await import('../render/HeadlessRenderer.js');
            const renderer = HeadlessRenderer.getInstance();
            const renderEvidence = await renderer.renderWithEvidence(currentCode, {
              domain: (normalizedOptions.collabDomain || 'p5') as import('../render/HeadlessRenderer.js').RenderDomain,
              width: 400,
              height: 400,
            });

            if (renderEvidence.infraUnavailable) {
              if (evalMode === 'strict-browser') {
                throw new LiminalError(
                  'Browser rendering infrastructure is unavailable in strict-browser mode',
                  'ERR_RENDER_INFRA_UNAVAILABLE',
                );
              }
              Logger.warn('RalphLoop', 'Browser render infra unavailable, falling back to legacy scoring');
              const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
              evaluation = await scoringEngine.scoreReliable(
                {
                  output: currentCode,
                  criteria: normalizedOptions.evaluationCriteria,
                  lirContext,
                },
              );
            } else {
              const { scoreRenderedEvidence } = await import('../core/ScoringEngine.js');
              const genEval = await scoreRenderedEvidence(
                renderEvidence,
                currentCode,
                prompt,
                undefined,
              );
              if (genEval.failureClass === 'scorer') {
                if (evalMode === 'strict-browser') {
                  throw new LiminalError(
                    'Evaluator LLM is unavailable in strict-browser mode',
                    'ERR_EVALUATOR_UNAVAILABLE',
                  );
                }
                Logger.warn('RalphLoop', 'Evaluator LLM unavailable for rendered-evidence scoring, falling back to legacy scoring');
                const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                evaluation = await scoringEngine.scoreReliable(
                  {
                    output: currentCode,
                    criteria: normalizedOptions.evaluationCriteria,
                    lirContext,
                  },
                );
              } else {
                evaluation = {
                  score: genEval.score,
                  issues: genEval.repairAdvice ? [genEval.repairAdvice.issue] : [],
                  dimensions: {},
                  repairAdvice: genEval.repairAdvice,
                };
              }
            }
          } else {
            // legacy mode
            const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
            evaluation = await scoringEngine.scoreReliable(
              {
                output: currentCode,
                criteria: normalizedOptions.evaluationCriteria,
                lirContext,
              },
            );
          }
        }

        // DF3 Phase 2: Single-Round Repair
        const repairMode = getRepairMode();
        if (repairMode === 'single-round' && evaluation.score < normalizedOptions.minQualityScore) {
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.('Attempting single-round repair...');
          }

          try {
            const harness = new GeneratorHarnessTools({ seededRandom: Math.random });

            // Build repair packet with repeated-failure detection
            const genEval: GenerationEvaluation = {
              score: evaluation.score,
              confidence: 1,
              failureClass: 'none',
              repairAdvice: evaluation.repairAdvice ?? (evaluation.issues && evaluation.issues.length > 0
                ? { issue: evaluation.issues[0], fix: 'Address the reported issue and regenerate.', constraint: 'Return a complete, runnable artifact.' }
                : undefined),
            };
            const repairPacket = harness.buildRepairPacket(genEval, repairHistory);

            if (repairPacket) {
              let repairPrompt = `${usedPrompt}\n\n---\n${repairPacket}`;
              if (entropyResult) {
                repairPrompt = harness.modulateRepairPrompt(repairPrompt, entropyResult.phrase);
              }
              const repairResult = await generator.generate(repairPrompt, loadedPrompt, true);

              if (!repairResult.needsClarification) {
                const repairValidation = CodeValidator.validate(repairResult.code);
                if (repairValidation.valid) {
                  const repairCode = repairValidation.cleanedCode;

                  // Evaluate repair candidate using the same path
                  let repairEval: { score: number; issues?: string[]; dimensions?: Record<string, number>; repairAdvice?: ConcreteRepairAdvice };
                  let repairLirContext: LIREvaluationContext | undefined;

                  if (normalizedOptions.lirEnabled) {
                    try {
                      const genParser = new GeneratedCodeParser();
                      const lirTokens = genParser.parse(repairCode);
                      if (lirTokens.length > 0) {
                        repairLirContext = {
                          lirTokens,
                          visualIntent: normalizedOptions.visualMappingParams as any,
                          lirEnabled: true,
                        };
                      }
                    } catch {
                      // ignore LIR parse errors for repair
                    }
                  }

                  if (evalMode === 'auto' || evalMode === 'strict-browser') {
                    const { HeadlessRenderer } = await import('../render/HeadlessRenderer.js');
                    const renderer = HeadlessRenderer.getInstance();
                    const renderEvidence = await renderer.renderWithEvidence(repairCode, {
                      domain: (normalizedOptions.collabDomain || 'p5') as import('../render/HeadlessRenderer.js').RenderDomain,
                      width: 400,
                      height: 400,
                    });

                    if (renderEvidence.infraUnavailable) {
                      const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                      repairEval = await scoringEngine.scoreReliable({
                        output: repairCode,
                        criteria: normalizedOptions.evaluationCriteria,
                        lirContext: repairLirContext,
                      });
                    } else {
                      const { scoreRenderedEvidence } = await import('../core/ScoringEngine.js');
                      const genEvalRepair = await scoreRenderedEvidence(
                        renderEvidence,
                        repairCode,
                        prompt,
                        undefined,
                      );
                      if (genEvalRepair.failureClass === 'scorer') {
                        if (evalMode === 'strict-browser') {
                          throw new LiminalError(
                            'Evaluator LLM is unavailable in strict-browser mode',
                            'ERR_EVALUATOR_UNAVAILABLE',
                          );
                        }
                        Logger.warn('RalphLoop', 'Evaluator LLM unavailable for rendered-evidence repair scoring, falling back to legacy scoring');
                        const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                        repairEval = await scoringEngine.scoreReliable({
                          output: repairCode,
                          criteria: normalizedOptions.evaluationCriteria,
                          lirContext: repairLirContext,
                        });
                      } else {
                        repairEval = {
                          score: genEvalRepair.score,
                          issues: genEvalRepair.repairAdvice ? [genEvalRepair.repairAdvice.issue] : [],
                          dimensions: {},
                          repairAdvice: genEvalRepair.repairAdvice,
                        };
                      }
                    }
                  } else {
                    const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
                    repairEval = await scoringEngine.scoreReliable({
                      output: repairCode,
                      criteria: normalizedOptions.evaluationCriteria,
                      lirContext: repairLirContext,
                    });
                  }

                  // Incumbent preservation: only replace if repair is better or equal
                  if (repairEval.score >= evaluation.score) {
                    // eslint-disable-next-line require-atomic-updates -- sequential loop, no concurrent mutation
                    currentCode = repairCode;
                    evaluation = repairEval;
                    if (normalizedOptions.chatMode) {
                      normalizedOptions.onThought?.(`Repair improved score to ${evaluation.score.toFixed(2)}`);
                    }
                  } else if (normalizedOptions.chatMode) {
                    normalizedOptions.onThought?.(`Repair did not improve (score ${repairEval.score.toFixed(2)}), keeping incumbent`);
                  }
                }
              }
            }
          } catch (repairError) {
            Logger.warn('RalphLoop', 'Single-round repair failed:', repairError instanceof Error ? repairError.message : repairError);
            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.('Repair attempt failed, continuing with incumbent');
            }
          }
        }

        // Record evaluation for repeated-failure detection
        repairHistory.push({
          score: evaluation.score,
          confidence: 1,
          failureClass: 'none',
          repairAdvice: evaluation.repairAdvice ?? (evaluation.issues && evaluation.issues.length > 0
            ? { issue: evaluation.issues[0], fix: 'Address the reported issue.', constraint: 'Complete artifact.' }
            : undefined),
        });

        // Aesthetic guardrails: run AestheticCritic if enabled
        if (normalizedOptions.useAestheticGuardrails) {
          try {
            const { AestheticCritic } = await import('../aesthetic/index.js');
            const critic = new AestheticCritic();
            // Wire LLM client for dual-path evaluation (LLM-as-Judge + heuristic)
            try {
              const llmForCritic = new LLMClient({ role: 'evaluator' });
              critic.setLLMClient(llmForCritic as any);
            } catch (err) {
              Logger.debug('RalphLoop', 'LLM client creation for AestheticCritic failed, heuristic-only path will be used:', err);
              // LLM client creation failed — heuristic-only path will be used
            }
            const aestheticReport = critic.critique(
              currentCode,
              normalizedOptions.aestheticConfig as any,
              lirContext,  // Pass LIR context for structured evaluation
            );

            // Apply penalty if violations detected
            if (!aestheticReport.passed) {
              const penalty = aestheticReport.score;
              evaluation.score = evaluation.score * penalty;

              // Append violations to issues for next iteration feedback
              const aestheticIssues = aestheticReport.violations
                .filter(v => v.severity === 'error' || v.severity === 'warning')
                .map(v => `[aesthetic] ${v.rule}: ${v.message}`);
              if (evaluation.issues) {
                evaluation.issues = [...evaluation.issues, ...aestheticIssues];
              }
            }

            // Emit aesthetic score in evaluation event
            eventBus.emit(EventTypes.LOOP_EVALUATION, 'RalphLoop', {
              iteration,
              overallScore: evaluation.score,
              technicalScore: evaluation.dimensions?.technical ?? 0,
              aestheticScore: aestheticReport.score,
              noveltyScore: evaluation.dimensions?.novelty ?? 0,
            });
          } catch (e) {
            // Aesthetic analysis failed gracefully — don't block generation
            normalizedOptions.onThought?.(`Aesthetic analysis skipped: ${e instanceof Error ? e.message : 'unknown error'}`);
          }
        } else {
          eventBus.emit(EventTypes.LOOP_EVALUATION, 'RalphLoop', {
            iteration,
            overallScore: evaluation.score,
            technicalScore: evaluation.dimensions?.technical ?? 0,
            aestheticScore: evaluation.dimensions?.aesthetic ?? evaluation.dimensions?.creative ?? 0,
            noveltyScore: evaluation.dimensions?.novelty ?? 0,
          });
        }

        // Intuition-based scoring: advisory only, no score blending
        if (normalizedOptions.useIntuition && candidates.length > 0) {
          try {
            const { IntuitionEngine } = await import('../intuition/index.js');
            const intuitionEngine = new IntuitionEngine();
            // Record outcome for future learning (advisory only, no score blending)
            intuitionEngine.recordOutcome(currentCode, normalizedOptions.project ?? 'default', evaluation.score);
          } catch (e) {
            normalizedOptions.onThought?.(`Intuition recording skipped: ${e instanceof Error ? e.message : 'unknown error'}`);
          }
        }

        // Render-based scoring: if enabled, render code and blend with syntactic score
        // Skip the legacy RenderAndScorePipeline in auto/strict-browser modes to avoid double work
        if (normalizedOptions.useRenderScoring && candidates.length > 0 && evalMode === 'legacy') {
          try {
            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.('Running render-based quality analysis...');
            }
            
            const { RenderAndScorePipeline } = await import('../render/RenderAndScorePipeline.js');
            const pipeline = new RenderAndScorePipeline(normalizedOptions.renderScoringOptions);
            
            const renderResult = await pipeline.process(currentCode);
            
            if (renderResult.success) {
              // Blend render score with existing score
              const blendedScore = RenderAndScorePipeline.blendScores({
                baseScore: evaluation.score,
                renderScore: renderResult.score,
                renderWeight: 0.4,
                mode: 'adaptive',
              });
              
              const oldScore = evaluation.score;
              evaluation.score = blendedScore;
              
              if (normalizedOptions.chatMode) {
                normalizedOptions.onThought?.(`Render score: ${renderResult.score.toFixed(2)}, blended: ${blendedScore.toFixed(2)} (was ${oldScore.toFixed(2)})`);
                if (renderResult.warnings?.length) {
                  normalizedOptions.onThought?.(`Render warnings: ${renderResult.warnings.join(' | ')}`);
                }
              }
              if (renderResult.warnings?.length) {
                Logger.warn('RalphLoop', `Render scoring warnings: ${renderResult.warnings.join(' | ')}`);
              }
              
              // Add render score info to dimensions
              if (!evaluation.dimensions) {
                evaluation.dimensions = {};
              }
              evaluation.dimensions.render = renderResult.score;
              
              // Log render details
              if (renderResult.visual) {
                Logger.debug('RalphLoop', `Visual score: ${renderResult.visual.score.toFixed(2)} (color: ${renderResult.visual.colorVariety.toFixed(2)}, edges: ${renderResult.visual.edgeComplexity.toFixed(2)})`);
              }
              if (renderResult.audio) {
                Logger.debug('RalphLoop', `Audio score: ${renderResult.audio.score.toFixed(2)} (freq: ${renderResult.audio.frequencyVariety.toFixed(2)}, dynamics: ${renderResult.audio.dynamics.toFixed(2)})`);
              }
            } else {
              Logger.warn('RalphLoop', `Render scoring failed: ${renderResult.error}`);
              if (normalizedOptions.chatMode) {
                normalizedOptions.onThought?.(`Render analysis skipped: ${renderResult.error}`);
              }
            }
            
            // Clean up resources
            await pipeline.close();
          } catch (renderError) {
            Logger.warn('RalphLoop', 'Render scoring error:', renderError);
            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.('Render analysis unavailable');
            }
          }
        }

        // Save iteration context and update final score before quality/success gates
        // so that callbacks and finalScore are set even when breaking early
        const iterationContext: IterationContext = {
          iteration,
          prompt: loadedPrompt,
          usedPrompt,
          code: currentCode,
          evaluation: { score: evaluation.score, issues: evaluation.issues ?? [] },
          timestamp: new Date().toISOString(),
          maxIterations: normalizedOptions.maxIterations,
          selectedCandidateIndex: candidates.length > 0 ? candidates.find(c => c.code === currentCode)?.index ?? 0 : 0,
          numCandidatesGenerated: numCandidates,
        };
        ContextAccumulation.save(iterationContext);
        normalizedOptions.onIteration?.(iterationContext);
        finalScore = evaluation.score;

        // Quality gate: break if score below minimum threshold (after giving it a chance)
        // Only apply quality gate after at least 2 iterations to allow initial attempts
        // Use domain-specific threshold if available, otherwise use default minQualityScore
        // Detect domain from prompt keywords if collabDomain is the default 'p5'
        let domain = normalizedOptions.collabDomain || 'p5';
        if (domain === Domain.P5) {
          const promptLower = prompt.toLowerCase();
          if (promptLower.includes('ascii') || promptLower.includes('text art')) domain = 'ascii';
          else if (promptLower.includes('music') || promptLower.includes('strudel') || promptLower.includes('hydra')) domain = 'music';
          else if (promptLower.includes('remotion') || promptLower.includes('video') || promptLower.includes('motion graphics') || promptLower.includes('title sequence')) domain = 'remotion';
          // Keep 'p5' for visual/shader/three since they're handled by the same generator
        }
        const qualityThreshold = normalizedOptions.domainQualityThresholds?.[domain] ?? normalizedOptions.minQualityScore;
        if (iteration >= 2 && evaluation.score < qualityThreshold) {
          reason = `quality threshold not met (score ${evaluation.score.toFixed(2)} < ${qualityThreshold} for domain: ${domain})`;
          break;
        }

        // Success gate: break if score exceeds excellent threshold (0.90) AND code is complete
        // Stop iterating when we've achieved excellent quality to avoid regression
        // BUT don't exit if code is incomplete - force another iteration to complete it
        if (evaluation.score >= 0.90 && isComplete) {
          completed = true;
          reason = `excellent quality achieved (score ${evaluation.score.toFixed(2)} >= 0.90, code complete)`;
          break;
        }
        
        // Force continuation if code is incomplete (even if quality is high)
        if (!isComplete && iteration < normalizedOptions.maxIterations) {
          Logger.info('RalphLoop', `Code incomplete after iteration ${iteration}, forcing another iteration`);
          // Continue to next iteration without breaking
        }
        
        // Iteration Extension: If at iteration 3 and still not working well, extend max iterations
        if (iteration === 3 && !normalizedOptions._disableIterationExtension) {
          const isWorkingWell = evaluation.score >= 0.70 && isComplete;
          if (!isWorkingWell) {
            const newMax = Math.min(normalizedOptions.maxIterations + 3, 20);
            if (newMax > normalizedOptions.maxIterations) {
              normalizedOptions.maxIterations = newMax;
              Logger.info('RalphLoop', `Extending max iterations to ${newMax} (score: ${evaluation.score.toFixed(2)}, complete: ${isComplete})`);
              if (normalizedOptions.chatMode) {
                normalizedOptions.onThought?.(`Extending to ${newMax} iterations to improve quality...`);
              }
            }
          }
        }

        // Update evolution subsystems
        const { noveltyScore, hints } = evolution.update(iteration, currentCode, evaluation.score, prompt);

        // DF3 Phase 8: Feed score into EvolutionEngine
        if (evolutionEngine) {
          recentScores.push(evaluation.score);
        }

        // Append aesthetic hints to usedPrompt for next iteration's context
        if (hints) {
          usedPrompt += hints;
        }

        // Archive learning: store high-quality outputs
        if (archiveLearning && evaluation.score >= 0.65) {
          archiveLearning.addOutput(
            loadedPrompt, currentCode,
            normalizedOptions.collabDomain || 'p5',
            evaluation.score,
            { iteration, domain: normalizedOptions.collabDomain || 'p5' }
          );
        }

        // Auto-compost: feed quality outputs to compost heap
        if (normalizedOptions.autoCompost && evaluation.score >= 0.7 && normalizedOptions.project) {
          try {
            const compostConfig = mergeCompostConfig();
            const heap = new CompostHeap(compostConfig);
            const tempDir = path.join(normalizedOptions.galleryDir, normalizedOptions.project);
            const codePath = path.join(tempDir, `v${iteration}.js`);
            const fs = await import('node:fs/promises');
            await fs.mkdir(tempDir, { recursive: true });
            await fs.writeFile(codePath, currentCode, 'utf-8');
            await heap.addFile(codePath);
            eventBus.emit(EventTypes.COMPOST_STAGE, 'RalphLoop', {
              stage: 'auto-compost',
              message: `Auto-fed iteration ${iteration} (score: ${evaluation.score.toFixed(2)}) to compost heap`,
            });
            if (await heap.isOverCapacity()) {
              const mill = new CompostMill(new LLMClient({ role: 'generator' }), { ...compostConfig, projectStore });
              await mill.digest();
              compostMaterials = await mill.getGenerationMaterials(normalizedOptions.collabDomain || 'p5');
              eventBus.emit(EventTypes.COMPOST_STAGE, 'RalphLoop', {
                stage: 'auto-digest',
                message: 'Heap at capacity — triggered auto-digest',
              });
            }
          } catch (err) {
            Logger.warn('RalphLoop', 'Auto-compost failed:', err);
          }
        }

        // Guidance: check for proactive suggestions
        if (normalizedOptions.guidanceEngine && normalizedOptions.chatMode) {
          const guidance = normalizedOptions.guidanceEngine as any;
          // Update iteration tracking for guidance
          if (guidance.updateIteration) {
            guidance.updateIteration(iteration, evaluation.score);
          }
          // Get and emit suggestions
          const suggestions = guidance.suggestNextAction({
            prompt: loadedPrompt,
            domain: normalizedOptions.collabDomain || 'p5',
            techniques: [],
            constraints: [],
            references: [],
          });
          for (const suggestion of suggestions) {
            normalizedOptions.onSuggestion?.(suggestion);
          }
        }

        // Record routing outcome for dynamic routing
        try {
          await recordRoutingOutcome({
            domain: (normalizedOptions.collabDomain || 'p5') as 'ascii' | 'music' | 'code' | 'visual' | 'remotion',
            model: normalizedOptions.useSwarm ? 'hybrid' : 'local',
            qualityScore: evaluation.score,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          Logger.warn('RalphLoop', 'Failed to record routing outcome:', err instanceof Error ? err.message : err);
        }

        // Store previous code before saving current iteration
        previousCode = currentCode;

        // Persist to gallery
        await persistence.saveIteration(iteration, currentCode);
        await persistence.saveMergeStep(iteration);

        // Git: auto-commit iteration (agent manages this behind the scenes)
        await gitIntegration.commitIteration({
          prompt: loadedPrompt,
          score: evaluation.score,
          iteration,
          code: currentCode,
          filePath: path.join(normalizedOptions.galleryDir, normalizedOptions.project, `v${iteration}.js`),
          model: lastModel,
        });

        // Track score history for convergence detection
        scoreHistory.push(evaluation.score);

        // Check stagnation
        const stagnationResult = stagnation.check(iteration, evaluation.score, noveltyScore, prompt, domain);

        // Log exploration mode changes
        if (stagnationResult.exploreAggressively !== undefined) {
          const wasExploring = successRateTracker.shouldExploreAggressively();
          successRateTracker.recordAttempt(evaluation.score >= 0.7);
          const isExploring = successRateTracker.shouldExploreAggressively();

          if (!wasExploring && isExploring) {
            Logger.info('RalphLoop', `Entering high-exploration mode (success rate: ${(stagnationResult.successRate ?? 0).toFixed(2)})`);
            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.('Success rate dropped — increasing exploration...');
            }
          } else if (wasExploring && !isExploring) {
            Logger.info('RalphLoop', `Exiting high-exploration mode (success rate: ${successRateTracker.getSuccessRate().toFixed(2)})`);
            if (normalizedOptions.chatMode) {
              normalizedOptions.onThought?.('Success rate recovered — returning to normal mode');
            }
          }
        }

        if (stagnationResult.shouldBreak) {
          reason = stagnationResult.reason;
          break;
        }

        // Convergence detection: stop if score hasn't improved by >0.01 in 3 iterations
        if (scoreHistory.length >= CONVERGENCE_WINDOW) {
          const recentScores = scoreHistory.slice(-CONVERGENCE_WINDOW);
          const maxInWindow = Math.max(...recentScores);
          const minInWindow = Math.min(...recentScores);
          const improvement = maxInWindow - minInWindow;

          if (improvement < CONVERGENCE_THRESHOLD) {
            reason = `convergence detected (score plateau: ${minInWindow.toFixed(3)}-${maxInWindow.toFixed(3)} over ${CONVERGENCE_WINDOW} iterations)`;
            Logger.info('RalphLoop', reason);
            break;
          }
        }

        const promiseDetected = PromiseDetector.detect(currentCode);
        normalizedOptions.onProgress?.({
          iteration,
          score: evaluation.score,
          promiseDetected,
          code: currentCode,
          timestamp: iterationContext.timestamp,
        });

        eventBus.emit(EventTypes.LOOP_ITERATION, 'RalphLoop', {
          iteration,
          maxIterations: normalizedOptions.maxIterations,
          score: evaluation.score,
          promiseDetected,
          durationMs: Date.now() - startTime,
        });

        // Success gate: break if promise detected (indicates completion)
        if (promiseDetected) {
          completed = true;
          reason = 'promise detected in generated code';
          break;
        }

        // Check timeout
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        if (elapsed > normalizedOptions.timeoutMinutes) {
          reason = `Timeout exceeded (${normalizedOptions.timeoutMinutes} minutes)`;
          break;
        }

        // DF3 Phase 8: Restore any temporarily mutated loop settings
        for (const restore of evoRestores) {
          restore();
        }

      } catch (error) {
        // Report error to Meta-Harness (skip during tests to avoid log pollution)
        if (process.env.NODE_ENV !== 'test') {
          await metaHarness.onGenerationComplete({
            success: false,
            model: normalizedOptions.useSwarm ? 'swarm' : 'local',
            domain: normalizedOptions.collabDomain || 'p5',
            prompt: prompt,
            error: formatError('RalphLoop', error),
            duration: Date.now() - startTime,
          });
        }
        
        if (!normalizedOptions.tolerateErrors) {
          throw error;
        }
      }
    }

    // Set completion reason if not already set
    if (!reason) {
      if (iteration >= normalizedOptions.maxIterations) {
        reason = `max iterations reached (${normalizedOptions.maxIterations})`;
      } else {
        reason = 'Loop terminated';
      }
    }

    } finally {
      // Git: end run, restore original branch (always cleanup)
      await gitIntegration.endRun(reason || 'loop ended', sessionId);
    }

    const duration = Date.now() - startTime;

    // Report final result to Meta-Harness (skip during tests to avoid log pollution)
    if (process.env.NODE_ENV !== 'test') {
      await metaHarness.onGenerationComplete({
        success: completed,
        model: lastModel || (normalizedOptions.useSwarm ? 'swarm' : 'local'),
        domain: normalizedOptions.collabDomain || 'p5',
        prompt: prompt,
        code: currentCode,
        error: completed ? undefined : reason,
        duration: duration,
        thinking: lastThinking,
      });
    }

    // Persist archive learning data
    if (qualityArchive) {
      await qualityArchive.save();
    }

    // Persist MAP-Elites and AestheticModel across runs
    if (normalizedOptions.useMapElites) {
      const mapElitesPath = `${process.env.HOME}/.liminal/map_elites.json`;
      const mapElites = normalizedOptions._mapElites;
      if (mapElites) {
        await mapElites.save(mapElitesPath).catch((err) => {
          Logger.warn('RalphLoop', 'Failed to save MAP-Elites:', err instanceof Error ? err.message : err);
        });
      }
    }
    if (aestheticModel) {
      const aestheticPath = `${process.env.HOME}/.liminal/aesthetic_model.json`;
      await aestheticModel.save(aestheticPath).catch((err) => {
        Logger.warn('RalphLoop', 'Failed to save aesthetic model:', err instanceof Error ? err.message : err);
      });
    }

    eventBus.emit(EventTypes.PROCESS_END, 'RalphLoop', {
      process: 'ralph-loop',
      success: completed,
      durationMs: Date.now() - startTime,
      reason,
      iterations: iteration,
      finalScore,
    });

    liminalFs.close();

    return {
      code: currentCode,
      iterations: iteration,
      completed,
      reason,
      timestamp: new Date().toISOString(),
      duration,
      finalScore,
      project: normalizedOptions.project,
      thinking: lastThinking,
      model: lastModel,
    };
  }

  /**
   * Get the current loop state
   */
  static getState(): { iteration: number; history: IterationContext[] } {
    const history = ContextAccumulation.getHistory();
    return { iteration: history.length, history };
  }

  /**
   * Reset the loop state
   */
  static reset(): void {
    ContextAccumulation.clear();
  }

  /**
   * Check if loop is currently running
   */
  static isRunning(): boolean {
    return ContextAccumulation.getHistory().length > 0;
  }

  /**
   * Get progress information for current loop
   */
  static getProgress(): { iteration: number; maxIterations?: number; progress: number } | null {
    const history = ContextAccumulation.getHistory();
    if (history.length === 0) return null;

    const iteration = history.length;
    const mostRecentContext = history[history.length - 1] as IterationContext;
    const maxIterations = mostRecentContext?.maxIterations || DEFAULT_MAX_ITERATIONS;

    return { iteration, maxIterations, progress: iteration / maxIterations };
  }

  /**
   * Check if code is structurally complete (not cut off mid-function)
   * Validates brace/paren/bracket balance and common cutoff patterns
   */
  static isCodeComplete(code: string): boolean {
    // Count opening and closing braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;

    // Count opening and closing parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    // Count opening and closing brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;

    // Check for common cutoff patterns
    const hasCutoffPattern = /\n\s{0,4}$/m.test(code.slice(-100)); // Ends with whitespace only
    const endsMidFunction = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/.test(code.slice(-200));
    const endsMidClass = /class\s+\w+.*\{[^}]*$/.test(code.slice(-200));

    return openBraces === closeBraces &&
           openParens === closeParens &&
           openBrackets === closeBrackets &&
           !hasCutoffPattern &&
           !endsMidFunction &&
           !endsMidClass;
  }
}

/**
 * Detect output type from generated code
 */
function detectOutputType(code: string): 'p5' | 'three' | 'glsl' | 'hydra' | 'strudel' | 'remotion' | 'unknown' {
  if (code.includes('function setup()') || code.includes('createCanvas')) {
    return 'p5';
  }
  if (code.includes('THREE.') || code.includes('WebGLRenderer')) {
    return 'three';
  }
  if (code.includes('void main') && code.includes('gl_FragColor')) {
    return 'glsl';
  }
  if (code.includes('.out(o0)') || code.includes('src(o0)')) {
    return 'hydra';
  }
  if (code.includes('.s(') && (code.includes('stack') || code.includes('$:'))) {
    return 'strudel';
  }
  if (code.includes('Remotion') || code.includes('useCurrentFrame')) {
    return 'remotion';
  }
  return 'unknown';
}
