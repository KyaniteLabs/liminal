/**
 * RalphLoop - Self-recursive iteration engine for Atelier
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
import { ContextAccumulation } from './ContextAccumulation.js';
import { CreativeEvaluator } from './CreativeEvaluator.js';
import { PromiseDetector } from './PromiseDetector.js';
import { P5GeneratorLLM } from '../generators/p5/P5GeneratorLLM.js';
import { ParticleSystem } from '../generators/p5/ParticleSystem.js';
import { CellularAutomata } from '../generators/p5/CellularAutomata.js';
import { FlowField } from '../generators/p5/FlowField.js';
import { ShaderGenerator } from '../generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../generators/three/ThreeGenerator.js';
import { Gallery } from '../gallery/Gallery.js';
import { promptToGeneratorParams } from '../utils/promptToGeneratorParams.js';
import { generateMusicToVisual } from '../musicToVisual/generateMusicToVisual.js';
import { mergeSketchCode } from '../utils/mergeSketchCode.js';

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
  /** Optional evaluation criteria (e.g. ["aesthetic", "technical", "novelty"]). When provided, passed to CreativeEvaluator.assess(). */
  evaluationCriteria?: string[];
  /** Progress callback: called after each iteration with iteration number, score, promiseDetected, code, timestamp */
  onProgress?: (data: { iteration: number; score: number; promiseDetected: boolean; code: string; timestamp: string }) => void;
  /** Optional AbortSignal to stop the loop (checked at start of each iteration) */
  signal?: AbortSignal;
  /** When set (e.g. 2), every N-th iteration is a merge step: take two from history, produce proposed, call onMergeStep. */
  mergeEveryN?: number;
  /** Called when a merge step runs: (codeA, codeB, proposed) from last two in history. */
  onMergeStep?: (data: { codeA: string; codeB: string; proposed: string }) => void;
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
  evaluation: any;
  timestamp: string;
  maxIterations?: number;
}

export class RalphLoop {
  private static readonly DEFAULT_MAX_ITERATIONS = 20;
  private static readonly DEFAULT_TIMEOUT_MINUTES = 30;
  private static readonly DEFAULT_MIN_QUALITY_SCORE = 0.7;

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

    // Main loop
    while (iteration < normalizedOptions.maxIterations) {
      if (normalizedOptions.signal?.aborted) {
        reason = 'aborted by user';
        break;
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

        // Generate code (route by prompt keywords: particle/galaxy -> ParticleSystem; cellular/automata/lenia -> CellularAutomata; else LLM)
        const { generatorKind, generatorParams } = this.chooseGenerator(loadedPrompt);
        if (generatorKind === 'particle') {
          currentCode = ParticleSystem.generate(generatorParams);
        } else if (generatorKind === 'cellular') {
          currentCode = CellularAutomata.generate(generatorParams);
        } else if (generatorKind === 'flowfield') {
          currentCode = FlowField.generate(generatorParams);
        } else if (generatorKind === 'shader') {
          const shaderGen = new ShaderGenerator();
          currentCode = await shaderGen.generate(loadedPrompt);
        } else if (generatorKind === 'three') {
          const threeGen = new ThreeGenerator();
          currentCode = await threeGen.generate(loadedPrompt);
        } else {
          const generator = new P5GeneratorLLM();
          currentCode = await generator.generate(usedPrompt);
        }

        // Evaluate quality
        const evaluation = CreativeEvaluator.assess(currentCode, {
          evaluationCriteria: normalizedOptions.evaluationCriteria
        });

        // Save iteration context
        const iterationContext: IterationContext = {
          iteration,
          prompt: loadedPrompt,
          usedPrompt,
          code: currentCode,
          evaluation,
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

        const promiseDetected = PromiseDetector.detect(currentCode);
        normalizedOptions.onProgress?.({
          iteration,
          score: evaluation.score,
          promiseDetected,
          code: currentCode,
          timestamp: iterationContext.timestamp
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
  private static normalizeOptions(options: LoopOptions | null): LoopOptions & { maxIterations: number; timeoutMinutes: number; galleryDir: string; project: string; tolerateErrors: boolean; minQualityScore: number } {
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
      onProgress: options?.onProgress,
      signal: options?.signal
    };
  }

  /**
   * Organism mode: generateMusicToVisual per iteration, saveOrganism to gallery. No P5GeneratorLLM.
   */
  private static async runOrganismMode(
    prompt: string,
    options: ReturnType<typeof RalphLoop.normalizeOptions>,
    startTime: number
  ): Promise<LoopResult> {
    const gallery = new Gallery(options.galleryDir);
    let lastMusic = '';
    let lastVisual = '';
    let iteration = 0;
    for (let i = 1; i <= options.maxIterations; i++) {
      if (options.signal?.aborted) {
        return {
          code: lastMusic + '\n' + lastVisual,
          iterations: iteration,
          completed: false,
          reason: 'aborted by user',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          finalScore: 1,
          project: options.project,
        };
      }
      iteration = i;
      const result = await generateMusicToVisual(prompt, { traits: options.traits });
      lastMusic = result.musicCode;
      lastVisual = result.visualCode;
      if (options.project) {
        await gallery.saveOrganism(options.project, i, result.musicCode, result.visualCode);
      }
      options.onProgress?.({
        iteration: i,
        score: 1,
        promiseDetected: false,
        code: result.musicCode + '\n' + result.visualCode,
        timestamp: new Date().toISOString(),
      });
    }
    const duration = Date.now() - startTime;
    return {
      code: lastMusic + '\n' + lastVisual,
      iterations: iteration,
      completed: true,
      reason: `max iterations reached (${options.maxIterations})`,
      timestamp: new Date().toISOString(),
      duration,
      finalScore: 1,
      project: options.project,
    };
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
        const scores = history.map((h: any) => h.evaluation.score);
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
   * Choose code generator by prompt keywords; returns kind and params for that generator.
   * - "particle" or "galaxy" -> ParticleSystem
   * - "cellular" or "automata" or "lenia" -> CellularAutomata
   * - otherwise -> LLM (P5GeneratorLLM)
   */
  private static chooseGenerator(
    prompt: string
  ): { generatorKind: 'particle' | 'cellular' | 'flowfield' | 'shader' | 'three' | 'llm'; generatorParams: Record<string, unknown> } {
    const lower = prompt.toLowerCase();
    const derived = promptToGeneratorParams(prompt);
    if (/3d|three\.js|\bthree\b|webgl\s*3d|3d\s*scene|3d\s*particle/.test(lower)) {
      return { generatorKind: 'three', generatorParams: {} };
    }
    if (/shader|glsl|ray\s*march|sdf|fragment/.test(lower)) {
      return { generatorKind: 'shader', generatorParams: {} };
    }
    if (/flow\s*field|flow\s*particle|particles?\s+flow/.test(lower)) {
      const params: Record<string, unknown> = { ...derived };
      if (/blue/.test(lower)) params.palette = 'cool';
      if (/warm|red|orange/.test(lower)) params.palette = 'warm';
      return { generatorKind: 'flowfield', generatorParams: params };
    }
    if (/particle|galaxy/.test(lower)) {
      const params: Record<string, unknown> = { ...derived };
      if (/blue/.test(lower)) params.palette = 'cool';
      return { generatorKind: 'particle', generatorParams: params };
    }
    if (/cellular|automata|lenia/.test(lower)) {
      return { generatorKind: 'cellular', generatorParams: { ...derived } };
    }
    return { generatorKind: 'llm', generatorParams: {} };
  }

  /**
   * Get the current loop state
   *
   * @returns Current iteration count and history
   */
  static getState(): { iteration: number; history: any[] } {
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