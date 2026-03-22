/**
 * RalphLoop - Self-recursive iteration engine for Liminal
 *
 * Implements the Ralph-Wiggum Loop pattern:
 * - Same prompt every iteration
 * - Context changes each iteration (previous work, history)
 * - Self-evaluation and improvement
 * - Terminates on promise detection or max-iterations
 *
 * Safety mechanisms:
 * - Max-iterations hard limit
 * - Timeout protection per iteration
 * - Quality gates via CreativeEvaluator
 * - Error tolerance
 *
 * Integration:
 * - Uses PromptStore for consistent prompts
 * - Uses ContextAccumulation for state management
 * - Uses P5Generator for code generation
 * - Uses CreativeEvaluator for quality assessment
 * - Uses PromiseDetector for termination detection
 * - Uses Gallery for iteration persistence
 */

import { PromptStore } from './PromptStore.js';
import path from 'node:path';
import { ContextAccumulation } from './ContextAccumulation.js';
import { EvaluationFramework, type EvaluationStrategy } from './EvaluationFramework.js';
import { PromiseDetector } from './PromiseDetector.js';
import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../generators/registerGenerators.js';
import { Gallery } from '../gallery/Gallery.js';
import { generateMusicToVisual } from '../musicToVisual/generateMusicToVisual.js';
import { mergeSketchCode } from '../utils/mergeSketchCode.js';
import { MapElites } from '../evolution/MapElites.js';
import { NoveltyArchive } from '../evolution/NoveltyArchive.js';
import { extractBehavior } from '../evolution/BehaviorVectors.js';
import { SafetyGuardrails } from './SafetyGuardrails.js';
import { DeepCollaboration } from '../collab/DeepCollaboration.js';
import { CollaborativeClient } from '../collab/CollaborativeClient.js';
import { CollaborationEngine } from '../collab/CollaborationEngine.js';
import type { CollaborationMode } from '../collab/CollaborationEngine.js';
import type { DeepCollaborationConfig, CollaborativeConfig, DomainType } from '../collab/types.js';
import { SwarmOrchestrator } from '../swarm/SwarmOrchestrator.js';
import { MiningEngine } from '../swarm/MiningEngine.js';
import type { SwarmConfig, SwarmMode } from '../swarm/types.js';
import { SelfReflectionEngine } from '../improvement/SelfReflection.js';
import { SeedBank } from '../compost/SeedBank.js';
import { CompostMill } from '../compost/CompostMill.js';
import { CompostHeap } from '../compost/CompostHeap.js';
import { mergeConfig as mergeCompostConfig } from '../compost/defaults.js';
import { ArchiveLearning } from '../learning/index.js';
import { QualityArchive } from '../learning/index.js';
import { AestheticModel } from '../evolution/AestheticModel.js';
import { recordRoutingOutcome } from '../routing/RoutingData.js';
import { eventBus, EventTypes } from './EventBus.js';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';

interface LoopOptions {
  maxIterations?: number;
  timeoutMinutes?: number;
  galleryDir?: string;
  project?: string;
  tolerateErrors?: boolean;
  minQualityScore?: number;
  /** 'p5' (default) or 'organism' (generateMusicToVisual + saveOrganism per iteration) */
  mode?: 'p5' | 'organism';
  /** Optional traits for organism mode (bpm, palette) */
  traits?: { bpm?: number; palette?: string };
  /** Optional seed code for iteration 1: "improve this toward [prompt]" */
  seedCode?: string;
  /** Optional seed template name or content for iteration 1 */
  seedTemplate?: string;
  /** Max characters of context to inject (truncation). PRD: Context bloat. */
  maxContextLength?: number;
  /** Include only last K iterations in context (default: all in history up to maxContextLength) */
  lastKIterations?: number;
  /** Optional evaluation criteria (e.g. ["aesthetic", "technical", "novelty"]). When provided, passed to EvaluationFramework.evaluate(). */
  evaluationCriteria?: string[];
  /** Evaluation strategy to use (default: 'detailed') */
  evaluationStrategy?: EvaluationStrategy;
  /** Progress callback: called after each iteration with iteration number, score, promiseDetected, code, timestamp */
  onProgress?: (data: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }) => void;
  /** Optional AbortSignal to stop the loop (checked at start of each iteration) */
  signal?: AbortSignal;
  /** When set (e.g. 2), every N-th iteration is a merge step: take two from history, produce proposed, call onMergeStep. */
  mergeEveryN?: number;
  /** Called when a merge step runs: (codeA, codeB, proposed) from last two in history. */
  onMergeStep?: (data: { codeA: string; codeB: string; proposed: string }) => void;
  /** Enable MAP-Elites quality-diversity optimization */
  useMapElites?: boolean;
  /** MAP-Elites grid dimensions (default [10, 10]) */
  mapElitesDims?: [number, number];
  /** Safety guardrails configuration */
  safetyConfig?: import('./SafetyGuardrails.js').SafetyConfig;
  /** Break loop if no fitness improvement for this many iterations (default 7, 0 = disabled) */
  stagnationThreshold?: number;
  /** Enable deep collaboration (multi-model specialized roles) */
  useDeepCollab?: boolean;
  /** Enable simple 2-model collaboration */
  useCollab?: boolean;
  /** Use CollaborationEngine instead of raw DeepCollaboration/CollaborativeClient */
  collabMode?: CollaborationMode;
  /** Configuration for collaboration (merged with defaults) */
  collabConfig?: Partial<DeepCollaborationConfig & CollaborativeConfig>;
  /** Domain for collaboration quality assessment (default: 'p5') */
  collabDomain?: DomainType;
  /** Enable swarm generation (7-persona Ollama swarm) */
  useSwarm?: boolean;
  /** Configuration for the swarm */
  swarmConfig?: Partial<SwarmConfig>;
  /** Swarm generative mode (default: 'hybrid') */
  swarmMode?: SwarmMode;
  /** Enable archive learning — store high-quality outputs for few-shot improvement */
  useArchiveLearning?: boolean;
  /** Path for quality archive JSON (default: ~/.liminal/archive/quality_archive.json) */
  archivePath?: string;
  /** Enable aesthetic model — predict quality based on behavior vectors */
  useAestheticModel?: boolean;
  /** Auto-feed quality outputs to compost heap and trigger digest when full */
  autoCompost?: boolean;
}

interface LoopResult {
  code: string;
  iterations: number;
  completed: boolean;
  reason: string;
  timestamp: string;
  duration: number;
  finalScore: number;
  project?: string;
}

interface IterationContext {
  iteration: number;
  prompt: string;
  usedPrompt: string;
  code: string;
  evaluation: { score: number; issues: string[]; [key: string]: unknown };
  timestamp: string;
  maxIterations?: number;
}

interface NormalizedLoopOptions extends LoopOptions {
  maxIterations: number;
  timeoutMinutes: number;
  galleryDir: string;
  project: string;
  tolerateErrors: boolean;
  minQualityScore: number;
  useMapElites: boolean;
  mapElitesDims: [number, number];
  safetyConfig: import('./SafetyGuardrails.js').SafetyConfig | undefined;
  _mapElites?: MapElites;
  _noveltyArchive?: NoveltyArchive;
  useDeepCollab: boolean;
  useCollab: boolean;
  collabConfig: Partial<DeepCollaborationConfig & CollaborativeConfig>;
  collabDomain: DomainType;
  useSwarm: boolean;
  swarmConfig: Partial<SwarmConfig>;
  swarmMode: SwarmMode;
}

export class RalphLoop {
  private static readonly DEFAULT_MAX_ITERATIONS = 20;
  private static readonly DEFAULT_TIMEOUT_MINUTES = 30;
  private static readonly DEFAULT_MIN_QUALITY_SCORE = 0.7;

  /**
   * LLM caller wrapper for collaboration modes
   * Handles custom LLM callbacks, dispatched generators, and fallback to P5GeneratorLLM
   */
  private static async collabLLMCaller(
    prompt: string,
    _systemPrompt: string | undefined,
    normalizedOptions: NormalizedLoopOptions,
    dispatched: { entry: { name: string; generate(prompt: string, options: Record<string, unknown>): string | Promise<string> } } | null | undefined
  ): Promise<string> {
    if (normalizedOptions.collabConfig?.callLLM) {
      return normalizedOptions.collabConfig.callLLM(prompt, _systemPrompt);
    }
    if (dispatched?.entry.name === 'llm') {
      const result = dispatched.entry.generate(prompt, {});
      return typeof result === 'string' ? result : await result;
    }
    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const generator = new P5GeneratorLLM();
    const result = generator.generate(prompt);
    return typeof result === 'string' ? result : await result;
  }

  /**
   * Run the Ralph-Wiggum Loop
   *
   * @param prompt - The prompt to use for all iterations
   * @param options - Optional configuration
   * @returns Loop result with code, iterations, and metadata
   */
  static async run(prompt: string, options: LoopOptions | null = {}): Promise<LoopResult> {
    const startTime = Date.now();

    // Normalize options
    const normalizedOptions = this.normalizeOptions(options);

    eventBus.emit(EventTypes.PROCESS_START, 'RalphLoop', { process: 'ralph-loop', maxIterations: normalizedOptions.maxIterations });

    // Organism mode: use generateMusicToVisual per iteration, save organism, no P5GeneratorLLM
    if (normalizedOptions.mode === 'organism') {
      return this.runOrganismMode(prompt, normalizedOptions, startTime);
    }

    // Initialize gallery
    const gallery = new Gallery(normalizedOptions.galleryDir);

    let iteration = 0;
    let completed = false;
    let reason = '';
    let currentCode = '';
    let finalScore = 0;
    let bestScore = 0;
    let iterationsSinceLastImprovement = 0;
    const selfReflection = new SelfReflectionEngine();

    // Initialize archive learning and aesthetic model
    let archiveLearning: ArchiveLearning | null = null;
    let qualityArchive: QualityArchive | null = null;
    let aestheticModel: AestheticModel | null = null;

    if (normalizedOptions.useArchiveLearning) {
      archiveLearning = new ArchiveLearning({
        archivePath: normalizedOptions.archivePath,
      });
      qualityArchive = archiveLearning.getArchive();
      await qualityArchive.load();
    }

    if (normalizedOptions.useAestheticModel) {
      aestheticModel = new AestheticModel();
      const aestheticPath = `${process.env.HOME}/.liminal/aesthetic_model.json`;
      await aestheticModel.load(aestheticPath).catch((err) => { Logger.warn('RalphLoop', 'Failed to load aesthetic model:', err); });
    }

    // Load persisted MAP-Elites if enabled
    if (normalizedOptions.useMapElites) {
      const mapElitesPath = `${process.env.HOME}/.liminal/map_elites.json`;
      const mapElites = normalizedOptions._mapElites as MapElites | undefined;
      if (mapElites) {
        await mapElites.load(mapElitesPath).catch((err) => { Logger.warn('RalphLoop', 'Failed to load MAP-Elites archive:', err); });
      }
    }

    // Main loop
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
        // Load prompt (same every time)
        const loadedPrompt = PromptStore.load(prompt);

        // Build context for injection (includes seed on iteration 1 when provided)
        const contextForInjection = this.buildContextForInjection(iteration, normalizedOptions, prompt, loadedPrompt);

        // Inject context into prompt if it has placeholders; then always append if no placeholder was used
        let usedPrompt = PromptStore.injectContext(loadedPrompt, contextForInjection);
        if (usedPrompt === loadedPrompt) {
          usedPrompt = loadedPrompt + '\n\n---\nContext from previous iterations:\n' + contextForInjection;
        }

        // Generate code via unified registry dispatch
        registerAllGenerators();

        // Inject a random compost seed for creative cross-pollination
        try {
          const compostConfig = mergeCompostConfig();
          const seedBank = new SeedBank(compostConfig);
          const seedContent = await seedBank.getRandomContent();
          if (seedContent) {
            usedPrompt += '\n\n---\nCreative seed from compost:\n' + seedContent;
          }
        } catch (err) {
          // No compost seeds available — continue without
          Logger.warn('RalphLoop', 'Compost seed injection failed:', err);
        }

        // Inject compost DNA if available for the detected domain
        try {
          const allDNA = generatorRegistry.getAllDNA();
          if (allDNA.size > 0) {
            const dispatchedDNA = generatorRegistry.dispatch(loadedPrompt);
            const matchedDomain = dispatchedDNA?.entry?.name;
            if (matchedDomain) {
              const dna = generatorRegistry.getDNA(matchedDomain);
              if (dna && dna.coreLogic) {
                usedPrompt += '\n\n---\nDomain knowledge from compost DNA:\n' +
                  `Core pattern: ${dna.coreLogic}\n` +
                  (dna.prompts?.length > 0 ? `Example prompt: ${dna.prompts[0]}\n` : '');
              }
            }
            // Also inject from all DNA entries if domain match is weak
            if (!dispatchedDNA || dispatchedDNA.confidence < 0.7) {
              for (const [domain, dna] of allDNA) {
                const promptLower = loadedPrompt.toLowerCase();
                if (promptLower.includes(domain.toLowerCase()) && dna.coreLogic) {
                  usedPrompt += '\n\n---\nCompost DNA for "' + domain + '":\n' +
                    `Core pattern: ${dna.coreLogic}\n`;
                  break; // Only inject one fallback DNA
                }
              }
            }
          }
        } catch (err) {
          // DNA injection failed — continue without
          Logger.warn('RalphLoop', 'Compost DNA injection failed:', err);
        }

        // Inject archived high-quality examples from past runs
        if (archiveLearning) {
          try {
            const enhanced = archiveLearning.buildEnhancedPrompt(usedPrompt, normalizedOptions.collabDomain || 'p5');
            if (enhanced !== usedPrompt) {
              usedPrompt = enhanced;
            }
          } catch (err) {
            // Archive lookup failed — continue without
            Logger.warn('RalphLoop', 'Archive learning injection failed:', err);
          }
        }
        const dispatched = generatorRegistry.dispatch(loadedPrompt);

        // Check if we should use swarm for this iteration
        if (normalizedOptions.useSwarm) {
          const swarmResult = await this.generateWithSwarm(usedPrompt, normalizedOptions, gallery);
          currentCode = swarmResult.finalOutput;

          // Mine swarm fragments and feed into archive learning
          if (archiveLearning) {
            try {
              const mined = MiningEngine.mineResult(swarmResult);
              for (const fragment of mined) {
                archiveLearning.addFragment(fragment, normalizedOptions.collabDomain || 'p5');
              }
            } catch (err) {
              // Mining failed — continue without
              Logger.warn('RalphLoop', 'Swarm mining failed:', err);
            }
          }
        } else if (normalizedOptions.useDeepCollab || normalizedOptions.useCollab) {
          // Use CollaborationEngine when collabMode is set, otherwise legacy path
          if (normalizedOptions.collabMode) {
            const collabLLMCaller = (prompt: string, _systemPrompt?: string) => this.collabLLMCaller(prompt, _systemPrompt, normalizedOptions, dispatched);

            const engine = new CollaborationEngine({
              mode: normalizedOptions.collabMode,
              domain: normalizedOptions.collabDomain || 'p5',
              systemPrompt: '',
              callLLM: collabLLMCaller,
              convergenceThreshold: normalizedOptions.collabConfig?.convergenceThreshold,
              maxRounds: normalizedOptions.collabConfig?.maxRounds ?? normalizedOptions.collabConfig?.maxPhases,
              onProgress: (update) => {
                options?.onProgress?.({
                  iteration: 0,
                  score: update.quality || 0,
                  promiseDetected: false,
                  code: update.output || '',
                  timestamp: new Date().toISOString(),
                });
              },
            });

            const collabResult = await engine.run(usedPrompt);
            currentCode = collabResult.output;
          } else {
            // Use collaboration for LLM generation
            const shouldUseCollab = !dispatched || dispatched.entry.name === 'llm';

            if (shouldUseCollab) {
              // Create a wrapper that adapts the generator signature to collaboration signature
              const collabLLMCaller = (prompt: string, _systemPrompt?: string) => this.collabLLMCaller(prompt, _systemPrompt, normalizedOptions, dispatched);

              currentCode = await this.generateWithCollaboration(
                usedPrompt,
                normalizedOptions,
                collabLLMCaller
              );
            } else if (dispatched) {
              // Collab enabled but non-LLM generator matched — use it directly
              const genPrompt = dispatched.entry.name === 'llm' ? usedPrompt : loadedPrompt;
              currentCode = await dispatched.entry.generate(genPrompt);
            }
          }
        } else if (dispatched) {
          const genPrompt = dispatched.entry.name === 'llm' ? usedPrompt : loadedPrompt;
          currentCode = await dispatched.entry.generate(genPrompt);
        } else {
          // No generator matched (should not happen with LLM fallback at confidence 0,
          // but guard against a cleared registry)
          const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
          const generator = new P5GeneratorLLM();
          currentCode = await generator.generate(usedPrompt);
        }

        // Evaluate quality
        const evaluation = await EvaluationFramework.evaluate(
          currentCode,
          normalizedOptions.evaluationStrategy ?? 'detailed',
          {
            criteria: normalizedOptions.evaluationCriteria,
          }
        );

        eventBus.emit(EventTypes.LOOP_EVALUATION, 'RalphLoop', {
          iteration,
          overallScore: evaluation.score,
          technicalScore: evaluation.details?.technical ?? 0,
          aestheticScore: evaluation.details?.aesthetic ?? evaluation.details?.creative ?? 0,
          noveltyScore: evaluation.details?.novelty ?? 0,
        });

        // MAP-Elites integration
        let noveltyScore = 0;
        if (normalizedOptions.useMapElites) {
          const mapElites = normalizedOptions._mapElites as MapElites | undefined;
          const archive = normalizedOptions._noveltyArchive as NoveltyArchive | undefined;

          const behavior = extractBehavior(currentCode);
          // Compute novelty score and use it as bonus dimension
          if (archive) {
            noveltyScore = archive.noveltyScore(behavior);
          }

          if (mapElites) {
            mapElites.insert(
              `iteration-${iteration}`,
              behavior,
              evaluation.score
            );

            // Inject diverse elites into next iteration's context when coverage is low
            const coverage = mapElites.coverage();
            if (coverage < 0.3 && iteration > 1) {
              const elites = mapElites.getElites(3);
              if (elites.length > 0) {
                ContextAccumulation.save({
                  iteration: iteration + 0.1,
                  prompt,
                  usedPrompt: '',
                  code: '',
                  evaluation: {
                    score: 0,
                    issues: [],
                    mapElitesCoverage: coverage,
                    mapElitesDiversityHint: `Low MAP-Elites coverage (${(coverage * 100).toFixed(0)}%). Consider exploring diverse behaviors.`,
                  },
                  timestamp: new Date().toISOString(),
                  maxIterations: normalizedOptions.maxIterations,
                });
              }
            }
          }

          // Feed behavior + score into aesthetic model for prediction
          if (aestheticModel) {
            const predictedQuality = aestheticModel.predict(behavior, { domain: normalizedOptions.collabDomain || 'p5' });
            aestheticModel.update([{ behavior, rating: evaluation.score * 5, domain: normalizedOptions.collabDomain || 'p5' }]);

            // Use prediction to add context hint for next iteration
            if (predictedQuality < 0.3 && iteration > 1) {
              usedPrompt += '\n\n---\nAesthetic model hint: This behavior region has produced low-quality outputs in the past. Try a significantly different approach.';
            } else if (predictedQuality > 0.7) {
              usedPrompt += '\n\n---\nAesthetic model hint: This behavior region tends to produce high-quality outputs. Lean into this direction.';
            }
          }
        }

        // Archive learning: store high-quality outputs
        if (archiveLearning && evaluation.score >= 0.65) {
          archiveLearning.addOutput(
            loadedPrompt,
            currentCode,
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
            // Write code to a temp file for heap ingestion
            const fs = await import('node:fs/promises');
            await fs.mkdir(tempDir, { recursive: true });
            await fs.writeFile(codePath, currentCode, 'utf-8');
            await heap.addFile(codePath);
            eventBus.emit(EventTypes.COMPOST_STAGE, 'RalphLoop', {
              stage: 'auto-compost',
              message: `Auto-fed iteration ${iteration} (score: ${evaluation.score.toFixed(2)}) to compost heap`,
            });
            // Auto-digest when heap is at capacity
            if (await heap.isOverCapacity()) {
              const mill = new CompostMill(new LLMClient(), compostConfig);
              await mill.digest();
              eventBus.emit(EventTypes.COMPOST_STAGE, 'RalphLoop', {
                stage: 'auto-digest',
                message: 'Heap at capacity — triggered auto-digest',
              });
            }
          } catch (err) {
            // Auto-compost failed — continue without
            console.warn('Auto-compost failed:', err);
          }
        }

        // Record routing outcome for dynamic routing
        recordRoutingOutcome({
          domain: (normalizedOptions.collabDomain || 'p5') as 'ascii' | 'music' | 'code' | 'visual',
          model: normalizedOptions.useSwarm ? 'hybrid' : 'local',
          qualityScore: evaluation.score,
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        // Save iteration context
        const iterationContext: IterationContext = {
          iteration,
          prompt: loadedPrompt,
          usedPrompt,
          code: currentCode,
          evaluation: { score: evaluation.score, issues: evaluation.issues ?? [] },
          timestamp: new Date().toISOString(),
          maxIterations: normalizedOptions.maxIterations
        };

        ContextAccumulation.save(iterationContext);

        // Save to gallery if project specified
        if (normalizedOptions.project) {
          try {
            await gallery.saveIteration(normalizedOptions.project, iteration, currentCode);
          } catch (error) {
            // Log but don't fail if gallery save fails
            if (!normalizedOptions.tolerateErrors) {
              throw error;
            }
          }
        }

        // Merge-every-N: after every N iterations, merge last two from history and call onMergeStep
        const history = ContextAccumulation.getHistory();
        if (
          normalizedOptions.mergeEveryN != null &&
          normalizedOptions.mergeEveryN >= 2 &&
          iteration % normalizedOptions.mergeEveryN === 0 &&
          history.length >= 2
        ) {
          const lastTwo = history.slice(-2) as IterationContext[];
          const codeA = lastTwo[0].code;
          const codeB = lastTwo[1].code;
          const proposed = mergeSketchCode(codeA, codeB);
          normalizedOptions.onMergeStep?.({ codeA, codeB, proposed });
          if (normalizedOptions.project) {
            try {
              await gallery.saveIteration(normalizedOptions.project, iteration + 1, proposed);
            } catch (error) {
              if (!normalizedOptions.tolerateErrors) throw error;
            }
          }
        }

        // Update final score
        finalScore = evaluation.score;

        // Record score for self-reflection
        selfReflection.recordScore({
          iteration,
          timestamp: Date.now(),
          overallScore: evaluation.score,
          technicalScore: evaluation.details?.technical ?? 0,
          aestheticScore: evaluation.details?.aesthetic ?? evaluation.details?.creative ?? 0,
          noveltyScore: evaluation.details?.novelty ?? 0,
          domain: normalizedOptions.collabDomain || 'p5',
        });

        // Stagnation detection with self-reflection improvement
        // High novelty resets stagnation — the system is exploring even if quality plateaus
        if (noveltyScore > 0.5) {
          iterationsSinceLastImprovement = Math.max(0, iterationsSinceLastImprovement - 1);
        }
        if (evaluation.score > bestScore) {
          bestScore = evaluation.score;
          iterationsSinceLastImprovement = 0;
        } else {
          iterationsSinceLastImprovement++;
          if (
            normalizedOptions.stagnationThreshold != null &&
            normalizedOptions.stagnationThreshold > 0 &&
            iterationsSinceLastImprovement >= normalizedOptions.stagnationThreshold
          ) {
            // Use self-reflection to check if improvement is possible
            const suggestions = selfReflection.analyze();
            const improvementSpec = suggestions.length > 0
              ? selfReflection.designImprovementSpec(suggestions[0])
              : null;

            if (improvementSpec) {
              // Inject improvement suggestion into next iteration's context
              // instead of breaking — give the loop one more chance
              if (iterationsSinceLastImprovement === normalizedOptions.stagnationThreshold) {
                ContextAccumulation.save({
                  iteration: iteration + 0.5,
                  prompt,
                  usedPrompt: improvementSpec,
                  code: '',
                  evaluation: { score: 0, issues: [suggestions[0].description] },
                  timestamp: new Date().toISOString(),
                  maxIterations: normalizedOptions.maxIterations,
                });
                // Reset counter to give improvement a chance
                iterationsSinceLastImprovement = 0;
              } else {
                reason = `stagnation detected (${iterationsSinceLastImprovement} iterations without improvement)`;
                break;
              }
            } else {
              reason = `stagnation detected (${iterationsSinceLastImprovement} iterations without improvement)`;
              break;
            }
          }
        }

        const promiseDetected = PromiseDetector.detect(currentCode);
        normalizedOptions.onProgress?.({
          iteration,
          score: evaluation.score,
          promiseDetected,
          code: currentCode,
          timestamp: iterationContext.timestamp
        });

        eventBus.emit(EventTypes.LOOP_ITERATION, 'RalphLoop', {
          iteration,
          maxIterations: normalizedOptions.maxIterations,
          score: evaluation.score,
          promiseDetected,
          durationMs: Date.now() - startTime,
        });

        // Quality gate: break if below threshold
        if (evaluation.score < normalizedOptions.minQualityScore) {
          completed = false;
          reason = 'quality threshold not met';
          break;
        }

        // Check for promise detection (termination condition)
        if (promiseDetected) {
          completed = true;
          reason = 'promise detected in generated code';
          break;
        }

        // Check timeout (single iteration protection)
        const elapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
        if (elapsed > normalizedOptions.timeoutMinutes) {
          reason = `Timeout exceeded (${normalizedOptions.timeoutMinutes} minutes)`;
          break;
        }

      } catch (error) {
        if (!normalizedOptions.tolerateErrors) {
          throw error;
        }
        // Continue on error if tolerateErrors is true
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

    const duration = Date.now() - startTime;

    // Persist archive learning data
    if (qualityArchive) {
      await qualityArchive.save();
    }

    // Persist MAP-Elites and AestheticModel across runs
    if (normalizedOptions.useMapElites) {
      const mapElitesPath = `${process.env.HOME}/.liminal/map_elites.json`;
      const mapElites = normalizedOptions._mapElites as MapElites | undefined;
      if (mapElites) {
        await mapElites.save(mapElitesPath).catch(() => {});
      }
    }
    if (aestheticModel) {
      const aestheticPath = `${process.env.HOME}/.liminal/aesthetic_model.json`;
      await aestheticModel.save(aestheticPath).catch(() => {});
    }

    eventBus.emit(EventTypes.PROCESS_END, 'RalphLoop', {
      process: 'ralph-loop',
      success: completed,
      durationMs: Date.now() - startTime,
      reason,
      iterations: iteration,
      finalScore,
    });

    return {
      code: currentCode,
      iterations: iteration,
      completed,
      reason,
      timestamp: new Date().toISOString(),
      duration,
      finalScore,
      project: normalizedOptions.project
    };
  }

  /**
   * Normalize options with defaults
   */
  private static normalizeOptions(options: LoopOptions | null): NormalizedLoopOptions {
    return {
      maxIterations: options?.maxIterations || RalphLoop.DEFAULT_MAX_ITERATIONS,
      timeoutMinutes: options?.timeoutMinutes || RalphLoop.DEFAULT_TIMEOUT_MINUTES,
      galleryDir: options?.galleryDir || 'gallery',
      project: options?.project || `project-${Date.now()}`,
      tolerateErrors: options?.tolerateErrors ?? false,
      minQualityScore: options?.minQualityScore ?? RalphLoop.DEFAULT_MIN_QUALITY_SCORE,
      mode: options?.mode ?? 'p5',
      traits: options?.traits,
      mergeEveryN: options?.mergeEveryN,
      onMergeStep: options?.onMergeStep,
      seedCode: options?.seedCode,
      seedTemplate: options?.seedTemplate,
      maxContextLength: options?.maxContextLength,
      lastKIterations: options?.lastKIterations,
      evaluationCriteria: options?.evaluationCriteria,
      evaluationStrategy: options?.evaluationStrategy,
      onProgress: options?.onProgress,
      signal: options?.signal,
      useMapElites: options?.useMapElites ?? false,
      mapElitesDims: options?.mapElitesDims ?? [10, 10],
      safetyConfig: options?.safetyConfig,
      stagnationThreshold: options?.stagnationThreshold ?? 7,
      useDeepCollab: options?.useDeepCollab ?? false,
      useCollab: options?.useCollab ?? false,
      collabConfig: options?.collabConfig || {},
      collabMode: options?.collabMode,
      collabDomain: options?.collabDomain || 'p5',
      useSwarm: options?.useSwarm ?? false,
      swarmConfig: options?.swarmConfig || {},
      swarmMode: options?.swarmMode ?? ('hybrid' as SwarmMode),
      useArchiveLearning: options?.useArchiveLearning ?? false,
      archivePath: options?.archivePath,
      useAestheticModel: options?.useAestheticModel ?? false,
      autoCompost: options?.autoCompost ?? false,
      _mapElites: options?.useMapElites ? new MapElites(options?.mapElitesDims ?? [10, 10]) : undefined,
      _noveltyArchive: options?.useMapElites ? new NoveltyArchive() : undefined,
    };
  }

  /**
   * Organism mode: generateMusicToVisual per iteration, saveOrganism to gallery.
   * Uses context accumulation, compost seed injection, and quality evaluation.
   */
  private static async runOrganismMode(
    prompt: string,
    options: ReturnType<typeof RalphLoop.normalizeOptions>,
    startTime: number
  ): Promise<LoopResult> {
    const gallery = new Gallery(options.galleryDir);

    eventBus.emit(EventTypes.PROCESS_START, 'RalphLoop', { process: 'ralph-loop', mode: 'organism' });

    let lastMusic = '';
    let lastVisual = '';
    let iteration = 0;
    let bestScore = 0;
    let iterationsSinceLastImprovement = 0;

    for (let i = 1; i <= options.maxIterations; i++) {
      if (options.signal?.aborted) {
        return {
          code: lastMusic + '\n' + lastVisual,
          iterations: iteration,
          completed: false,
          reason: 'aborted by user',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          finalScore: bestScore,
          project: options.project,
        };
      }
      iteration = i;

      // Build context from previous iterations
      const history = ContextAccumulation.getHistory();
      let enhancedPrompt = prompt;
      if (history.length > 0) {
        const lastIter = history[history.length - 1];
        enhancedPrompt += `\n\nPrevious iteration produced code of length ${lastIter.code.length}. Score: ${lastIter.evaluation?.score?.toFixed(2) ?? 'N/A'}.`;
        if (lastIter.evaluation?.issues?.length > 0) {
          enhancedPrompt += ` Issues: ${lastIter.evaluation.issues.join(', ')}.`;
        }
      }

      // Inject a random compost seed for creative cross-pollination
      try {
        const compostConfig = mergeCompostConfig();
        const seedBank = new SeedBank(compostConfig);
        const seedContent = await seedBank.getRandomContent();
        if (seedContent) {
          enhancedPrompt += '\n\nCreative seed from compost:\n' + seedContent;
        }
      } catch (err) {
        // No compost seeds available — continue without
        console.warn('Organism compost seed injection failed:', err);
      }

      const result = await generateMusicToVisual(enhancedPrompt, { traits: options.traits });
      lastMusic = result.musicCode;
      lastVisual = result.visualCode;

      // Heuristic quality evaluation for organism mode
      const qualityScore = this.assessOrganismQuality(result.musicCode, result.visualCode);

      // Context accumulation
      ContextAccumulation.save({
        iteration: i,
        prompt: enhancedPrompt,
        usedPrompt: enhancedPrompt,
        code: result.musicCode + '\n' + result.visualCode,
        evaluation: { score: qualityScore, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: options.maxIterations,
      });

      // Stagnation detection
      if (qualityScore > bestScore) {
        bestScore = qualityScore;
        iterationsSinceLastImprovement = 0;
      } else {
        iterationsSinceLastImprovement++;
        if (
          options.stagnationThreshold != null &&
          options.stagnationThreshold > 0 &&
          iterationsSinceLastImprovement >= options.stagnationThreshold
        ) {
          break;
        }
      }

      if (options.project) {
        await gallery.saveOrganism(options.project, i, result.musicCode, result.visualCode);
      }
      options.onProgress?.({
        iteration: i,
        score: qualityScore,
        promiseDetected: false,
        code: result.musicCode + '\n' + result.visualCode,
        timestamp: new Date().toISOString(),
      });
    }
    const duration = Date.now() - startTime;

    eventBus.emit(EventTypes.PROCESS_END, 'RalphLoop', { process: 'ralph-loop', success: true, durationMs: Date.now() - startTime, iterations: iteration });

    return {
      code: lastMusic + '\n' + lastVisual,
      iterations: iteration,
      completed: true,
      reason: `max iterations reached (${options.maxIterations})`,
      timestamp: new Date().toISOString(),
      duration,
      finalScore: bestScore,
      project: options.project,
    };
  }

  /**
   * Assess organism quality using syntax-aware heuristics
   * Evaluates Strudel (music) and Hydra (visual) code patterns
   */
  private static assessOrganismQuality(musicCode: string, visualCode: string): number {
    let score = 0;

    // Strudel syntax patterns (valid music code signals)
    const strudelPatterns = [
      /\$\d/,           // mini notation $0, $1
      /s\d/,            // stack references s0, s1
      /~/,              // repeat
      /:seq\(/,         // sequence
      /:percol\(/,      // percolate
      /:chord\(/,       // chord
      /\.\w+\s*\(.*\)/, // method calls (generic pattern matching)
      /"/,              // string literals
      /'/,              // string literals
    ];

    // Hydra syntax patterns (valid visual code signals)
    const hydraPatterns = [
      /osc\(/,          // oscillator
      /shape\(/,        // shape
      /src\(/,          // source
      /solid\(/,        // solid
      /color\(/,        // color
      /rotate\(/,       // rotate
      /scale\(/,        // scale
      /blend\(/,        // blend
      /modulate\(/,     // modulate
      /pixelate\(/,     // pixelate
    ];

    // Check Strudel patterns in music code
    let musicSyntaxScore = 0;
    for (const pattern of strudelPatterns) {
      if (pattern.test(musicCode)) musicSyntaxScore++;
    }
    score += Math.min(0.4, (musicSyntaxScore / strudelPatterns.length) * 0.4);

    // Check Hydra patterns in visual code
    let visualSyntaxScore = 0;
    for (const pattern of hydraPatterns) {
      if (pattern.test(visualCode)) visualSyntaxScore++;
    }
    score += Math.min(0.3, (visualSyntaxScore / hydraPatterns.length) * 0.3);

    // Complexity: non-trivial content length (not just whitespace/comments)
    const strippedMusic = musicCode.replace(/\/\/.*$/gm, '').trim();
    const strippedVisual = visualCode.replace(/\/\/.*$/gm, '').trim();
    const contentLength = strippedMusic.length + strippedVisual.length;
    score += Math.min(0.3, contentLength / 400 * 0.3);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate using swarm (7-persona Ollama swarm)
   *
   * @param prompt - The prompt to generate from
   * @param options - Normalized loop options
   * @returns Generated text from the swarm
   */
  private static async generateWithSwarm(
    prompt: string,
    options: ReturnType<typeof RalphLoop.normalizeOptions>,
    gallery: Gallery
  ): Promise<import('../swarm/types.js').SwarmResult> {
    const orchestrator = new SwarmOrchestrator(options.swarmConfig, {
      onProgress: (data) => {
        options.onProgress?.({
          iteration: data.round,
          score: 0,
          promiseDetected: false,
          code: '',
          timestamp: new Date().toISOString(),
        });
      },
    });

    const result = await orchestrator.run(prompt, options.swarmMode);

    // Save swarm session for provenance
    if (options.project) {
      try {
        await gallery.saveSwarmSession(options.project, result);
      } catch (err) {
        // Best-effort — don't fail the loop
        console.warn('Swarm session save failed:', err);
      }
    }

    return result;
  }

  /**
   * Generate using deep or simple collaboration
   *
   * @param prompt - The prompt to generate from
   * @param options - Normalized loop options
   * @param fallbackLLM - Fallback LLM caller for collaboration
   * @returns Generated code
   */
  private static async generateWithCollaboration(
    prompt: string,
    options: ReturnType<typeof RalphLoop.normalizeOptions>,
    fallbackLLM: (prompt: string, systemPrompt?: string) => Promise<string>
  ): Promise<string> {
    const domain = options.collabDomain || 'p5';

    if (options.useDeepCollab) {
      // Deep collaboration with specialized roles
      const collab = new DeepCollaboration({
        ...options.collabConfig,
        callLLM: fallbackLLM,
      } as DeepCollaborationConfig);

      return await collab.generate(
        prompt,
        domain,
        '', // systemPrompt - could be added to options if needed
        (update) => {
          // Feed collaboration phase updates into the main onProgress callback
          options.onProgress?.({
            iteration: 0, // Collaboration happens within an iteration
            score: update.quality || 0,
            promiseDetected: false,
            code: update.output || '',
            timestamp: new Date().toISOString(),
          });
        }
      );
    } else {
      // Simple 2-model collaboration
      const collab = new CollaborativeClient({
        ...options.collabConfig,
        callLLM: fallbackLLM,
      } as CollaborativeConfig);

      return await collab.generate(
        prompt,
        domain,
        '', // systemPrompt - could be added to options if needed
        (update) => {
          // Feed collaboration phase updates into the main onProgress callback
          options.onProgress?.({
            iteration: 0, // Collaboration happens within an iteration
            score: update.quality || 0,
            promiseDetected: false,
            code: update.output || '',
            timestamp: new Date().toISOString(),
          });
        }
      );
    }
  }

  /**
   * Build context for injection into prompt
   *
   * This context changes each iteration, providing the "world that changes"
   * while the prompt stays the same.
   */
  private static buildContextForInjection(
    iteration: number,
    options: { seedCode?: string; seedTemplate?: string; maxContextLength?: number; lastKIterations?: number },
    _prompt?: string,
    _loadedPrompt?: string
  ): string {
    let history = ContextAccumulation.getHistory();

    if (options.lastKIterations != null && options.lastKIterations > 0 && history.length > options.lastKIterations) {
      history = history.slice(-options.lastKIterations);
    }

    let base: string;
    if (history.length === 0) {
      base = `Iteration: ${iteration}\nNo previous context available.`;
    } else {
      const contextParts: string[] = [`Current iteration: ${iteration}`];
      contextParts.push(`\nPrevious iterations: ${history.length}`);

      const mostRecent = history[history.length - 1];
      contextParts.push(`\nLast iteration (${mostRecent.iteration}):`);
      contextParts.push(`- Quality score: ${mostRecent.evaluation.score.toFixed(2)}`);
      contextParts.push(`- Code length: ${mostRecent.code.length} characters`);

      if (mostRecent.evaluation.issues && mostRecent.evaluation.issues.length > 0) {
        contextParts.push(`- Issues to address: ${mostRecent.evaluation.issues.join(', ')}`);
      }

      const codeSnippet = mostRecent.code.substring(0, 500);
      if (codeSnippet.length > 0) {
        contextParts.push(`\nPrevious code (first 500 chars):\n${codeSnippet}`);
      }

      if (history.length > 1) {
        const scores = history.map((h: IterationContext) => h.evaluation.score);
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const improving = scores[scores.length - 1] > scores[0];
        contextParts.push(`\nQuality trend:`);
        contextParts.push(`- Average score: ${avgScore.toFixed(2)}`);
        contextParts.push(`- Trend: ${improving ? 'Improving' : 'Declining'}`);
      }

      base = contextParts.join('\n');
    }

    let context = base;
    if (iteration === 1 && (options.seedCode != null || options.seedTemplate != null)) {
      const seed = options.seedCode ?? options.seedTemplate ?? '';
      context = 'Here is the seed/template; improve it toward the user\'s goal.\nSeed:\n' + seed + '\n\n' + context;
    }

    if (options.maxContextLength != null && options.maxContextLength > 0 && context.length > options.maxContextLength) {
      context = context.slice(-options.maxContextLength);
    }

    return context;
  }

  /**
   * Get the current loop state
   *
   * @returns Current iteration count and history
   */
  static getState(): { iteration: number; history: IterationContext[] } {
    const history = ContextAccumulation.getHistory();
    return {
      iteration: history.length,
      history
    };
  }

  /**
   * Reset the loop state
   *
   * Clears context accumulation for a fresh run.
   */
  static reset(): void {
    ContextAccumulation.clear();
  }

  /**
   * Check if loop is currently running
   *
   * @returns true if there is active context state
   */
  static isRunning(): boolean {
    const history = ContextAccumulation.getHistory();
    return history.length > 0;
  }

  /**
   * Get progress information for current loop
   *
   * @returns Progress details or null if no loop running
   */
  static getProgress(): { iteration: number; maxIterations?: number; progress: number } | null {
    const history = ContextAccumulation.getHistory();
    if (history.length === 0) {
      return null;
    }

    const iteration = history.length;
    // Use maxIterations from context if available, otherwise use default
    const mostRecentContext = history[history.length - 1] as IterationContext;
    const maxIterations = mostRecentContext?.maxIterations || RalphLoop.DEFAULT_MAX_ITERATIONS;

    return {
      iteration,
      maxIterations,
      progress: iteration / maxIterations
    };
  }
}