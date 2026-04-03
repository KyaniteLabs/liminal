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

import { PromptStore } from './PromptStore.js';
import path from 'node:path';
import { ContextAccumulation } from './ContextAccumulation.js';
import { ScoringEngine } from './ScoringEngine.js';
import { PromiseDetector } from './PromiseDetector.js';
import { Gallery } from '../gallery/Gallery.js';
import { SafetyGuardrails } from './SafetyGuardrails.js';
import { CompostHeap } from '../compost/CompostHeap.js';
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
import { RuntimeHealthMonitor } from '../guardrails/RuntimeHealthMonitor.js';

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
import { LoopPersistence } from './LoopPersistence.js';
import { StagnationDetector } from './StagnationDetector.js';
import { runOrganismMode } from './OrganismLoop.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import { env } from '../utils/env.js';

export type { LoopOptions, LoopResult, IterationContext, NormalizedLoopOptions };

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
      const provider = env('LLM_PROVIDER') || 'lmstudio';
      if (provider !== 'ollama') {
        Logger.warn('RalphLoop', `Swarm mode is designed for Ollama. Current provider is "${provider}". Swarm may not work correctly.`);
      }
    }

    // Organism mode: delegate entirely to OrganismLoop
    if (normalizedOptions.mode === 'organism') {
      return runOrganismMode(prompt, normalizedOptions, startTime);
    }

    // Initialize subsystems
    const gallery = new Gallery(normalizedOptions.galleryDir);
    const stagnation = new StagnationDetector(normalizedOptions.stagnationThreshold ?? 7);

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
    const persistence = new LoopPersistence(gallery, normalizedOptions);
    const generator = new GenerationOrchestrator(normalizedOptions, gallery, archiveLearning);

    let iteration = 0;
    let completed = false;
    let reason = '';
    let currentCode = '';
    let finalScore = 0;

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
        // Emit thoughts during generation for chat display
        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Starting iteration ${iteration}...`);
          normalizedOptions.onThought?.('Loading prompt...');
        }

        // Load prompt (same every time)
        const loadedPrompt = PromptStore.load(prompt);

        // Build context and enhance prompt
        const contextForInjection = buildContextForInjection(iteration, normalizedOptions, prompt, loadedPrompt);
        let usedPrompt = PromptStore.injectContext(loadedPrompt, contextForInjection);
        if (usedPrompt === loadedPrompt) {
          usedPrompt = loadedPrompt + '\n\n---\nContext from previous iterations:\n' + contextForInjection;
        }

        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.('Enhancing prompt with context and compost...');
        }

        // Enhance with compost seed, DNA, and archive examples
        usedPrompt = await enhancePrompt(usedPrompt, loadedPrompt, normalizedOptions, archiveLearning);

        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.('Generating code...');
        }

        // Generate code (bypass cache to ensure fresh generation each iteration)
        // Ralph Loop requires fresh LLM calls each iteration - caching would defeat the iterative improvement pattern
        const { code } = await generator.generate(usedPrompt, loadedPrompt, true);

        // Validate generated code before accepting it
        const validation = CodeValidator.validate(code);
        if (!validation.valid) {
          Logger.warn('RalphLoop', `Code validation failed: ${validation.errors.join('; ')}`);
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
          // Force score to 0 so quality gate rejects this iteration
          currentCode = validation.cleanedCode || '// Validation failed — empty code';
        } else {
          currentCode = validation.cleanedCode;
        }
        
        // Check code completeness (structural - braces, parens balanced)
        const isComplete = RalphLoop.isCodeComplete(currentCode);
        
        // Runtime validation: ACTUALLY EXECUTE the code to check for runtime errors
        let runtimeValid = true;
        let runtimeError = '';
        let consoleErrorCount = 0;
        
        // Only run runtime validation for visual domains that can be tested in browser
        const testableDomains = ['p5', 'three', 'glsl', 'html'];
        const domainToTest = normalizedOptions.collabDomain || 'p5';
        
        if (testableDomains.includes(domainToTest) && currentCode.length > 100) {
          try {
            const healthMonitor = new RuntimeHealthMonitor({ 
              durationMs: 3000,  // 3 second quick check
              disableSandbox: process.env.LIMINAL_DISABLE_SANDBOX === 'true'
            });
            
            const healthResult = await healthMonitor.quickCheck(currentCode, domainToTest);
            
            runtimeValid = healthResult.healthy && healthResult.metrics.consoleErrorCount === 0;
            consoleErrorCount = healthResult.metrics.consoleErrorCount;
            
            if (!runtimeValid) {
              runtimeError = healthResult.issues.join('; ') || 
                            (consoleErrorCount > 0 ? `${consoleErrorCount} console errors` : 'Runtime validation failed');
            }
          } catch (healthErr) {
            // If runtime check itself fails, log but don't block (could be env issue)
            Logger.warn('RalphLoop', `Runtime check error: ${healthErr instanceof Error ? healthErr.message : 'unknown'}`);
            // Still mark as valid to not block users due to infra issues
            runtimeValid = true;
          }
        }
        
        // Log runtime validation results
        if (!runtimeValid) {
          Logger.warn('RalphLoop', `Runtime validation failed: ${runtimeError}`);
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.(`⚠️ Runtime check failed: ${runtimeError}. Forcing another iteration.`);
          }
        } else if (consoleErrorCount > 0) {
          Logger.warn('RalphLoop', `Runtime validation found ${consoleErrorCount} console errors`);
        }

        // Diagnostic: Log that we got fresh code (not from cache)
        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.(`Generated ${code.length} characters of code (iteration ${iteration})`);
        }

        // Evaluate quality
        if (normalizedOptions.chatMode) {
          normalizedOptions.onThought?.('Evaluating code quality...');
        }

        // LIR: Parse generated code into structured tokens if enabled
        let lirContext: LIREvaluationContext | undefined;
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
          } catch {
            // LIR parsing failed — regex fallback will be used
          }
        }

        const scoringEngine = new ScoringEngine(normalizedOptions.evaluationStrategy ?? 'detailed');
        const evaluation = await scoringEngine.score(
          {
            output: currentCode,
            criteria: normalizedOptions.evaluationCriteria,
            lirContext,
          },
          normalizedOptions.evaluationStrategy ?? 'detailed',
        );

        // Aesthetic guardrails: run AestheticCritic if enabled
        if (normalizedOptions.useAestheticGuardrails) {
          try {
            const { AestheticCritic } = await import('../aesthetic/index.js');
            const critic = new AestheticCritic();
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

        // Runtime validation penalty: if code has runtime errors, force score to 0
        // This prevents broken code from being accepted
        if (!runtimeValid) {
          evaluation.score = 0;
          if (!evaluation.issues) {
            evaluation.issues = [];
          }
          evaluation.issues.push(`[runtime] ${runtimeError}`);
          Logger.warn('RalphLoop', `Runtime validation failed - forcing score to 0`);
          if (normalizedOptions.chatMode) {
            normalizedOptions.onThought?.(`❌ Code has runtime errors. Score forced to 0. Will retry...`);
          }
        }

        // Quality gate: break if score below minimum threshold (after giving it a chance)
        // Only apply quality gate after at least 2 iterations to allow initial attempts
        // Use domain-specific threshold if available, otherwise use default minQualityScore
        // Detect domain from prompt keywords if collabDomain is the default 'p5'
        let domain = normalizedOptions.collabDomain || 'p5';
        if (domain === 'p5') {
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
        const { noveltyScore, hints } = await evolution.update(iteration, currentCode, evaluation.score, prompt);

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
              const mill = new CompostMill(new LLMClient(), compostConfig);
              await mill.digest();
              eventBus.emit(EventTypes.COMPOST_STAGE, 'RalphLoop', {
                stage: 'auto-digest',
                message: 'Heap at capacity — triggered auto-digest',
              });
            }
          } catch (err) {
            console.warn('Auto-compost failed:', err);
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
        recordRoutingOutcome({
          domain: (normalizedOptions.collabDomain || 'p5') as 'ascii' | 'music' | 'code' | 'visual' | 'remotion',
          model: normalizedOptions.useSwarm ? 'hybrid' : 'local',
          qualityScore: evaluation.score,
          timestamp: new Date().toISOString(),
        }).catch((err) => {
          Logger.warn('RalphLoop', 'Failed to record routing outcome:', err instanceof Error ? err.message : err);
        });

        // Save iteration context
        const iterationContext: IterationContext = {
          iteration,
          prompt: loadedPrompt,
          usedPrompt,
          code: currentCode,
          evaluation: { score: evaluation.score, issues: evaluation.issues ?? [] },
          timestamp: new Date().toISOString(),
          maxIterations: normalizedOptions.maxIterations,
        };
        ContextAccumulation.save(iterationContext);

        // Call onIteration callback for chat mode
        normalizedOptions.onIteration?.(iterationContext);

        // Persist to gallery
        await persistence.saveIteration(iteration, currentCode);
        await persistence.saveMergeStep(iteration);

        // Update final score
        finalScore = evaluation.score;

        // Check stagnation
        const stagnationResult = stagnation.check(iteration, evaluation.score, noveltyScore, prompt);
        if (stagnationResult.shouldBreak) {
          reason = stagnationResult.reason;
          break;
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

      } catch (error) {
        // Report error to Meta-Harness (skip during tests to avoid log pollution)
        if (process.env.NODE_ENV !== 'test') {
          await metaHarness.onGenerationComplete({
            success: false,
            model: normalizedOptions.useSwarm ? 'swarm' : 'local',
            domain: normalizedOptions.collabDomain || 'p5',
            prompt: prompt,
            error: error instanceof Error ? error.message : String(error),
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

    const duration = Date.now() - startTime;

    // Report final result to Meta-Harness (skip during tests to avoid log pollution)
    if (process.env.NODE_ENV !== 'test') {
      await metaHarness.onGenerationComplete({
        success: completed,
        model: normalizedOptions.useSwarm ? 'swarm' : 'local',
        domain: normalizedOptions.collabDomain || 'p5',
        prompt: prompt,
        code: currentCode,
        error: completed ? undefined : reason,
        duration: duration,
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

    return {
      code: currentCode,
      iterations: iteration,
      completed,
      reason,
      timestamp: new Date().toISOString(),
      duration,
      finalScore,
      project: normalizedOptions.project,
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

