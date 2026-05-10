/**
 * GenerationOrchestrator - Swarm/collab/generator dispatch for RalphLoop
 *
 * Handles the complex generation dispatch logic:
 * - LLM caller wrapper for collaboration modes
 * - Swarm generation (7-persona Ollama swarm)
 * - Collaboration via CollaborationEngine (consolidated to SwarmOrchestrator)
 * - Standard generator registry dispatch
 *
 * Consolidated as part of Fix 8: Consolidate Triple Redundancy.
 * DeepCollaboration and CollaborativeClient have been removed.
 * All collaboration now routes through CollaborationEngine -> SwarmOrchestrator.
 */

import { Domain } from '../types/domains.js';
import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import type { GeneratorEntry, GeneratorResult as GeneratorResultType } from '../generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../generators/registerGenerators.js';
import { Gallery } from '../gallery/Gallery.js';
import { CollaborationEngine, type PhaseUpdate } from '../collab/CollaborationEngine.js';
import { SwarmOrchestrator } from '../swarm/SwarmOrchestrator.js';
import { MiningEngine } from '../swarm/MiningEngine.js';
import { ArchiveLearning } from '../learning/index.js';
import type { NormalizedLoopOptions } from './LoopConfig.js';
import { getEffectiveConfig } from '../config/ConfigLoader.js';
import { Logger } from '../utils/Logger.js';
import { AmbiguityDetector } from './AmbiguityDetector.js';
import type { ClarifyResult, GenerationSuccess } from './clarify.js';
import { abortable, throwIfAborted } from '../utils/abort.js';

type DispatchResult = { entry: GeneratorEntry; confidence: number } | null;


function entryNameForDomain(domain?: Domain | string): string | null {
  const value = String(domain || '').toLowerCase();
  if (!value) return null;
  if (value === Domain.GLSL || value === Domain.SHADER || value === Domain.WEBGL) return 'shader';
  if (value === Domain.REVIEWD) return 'revideo';
  if (value === Domain.KINETIC) return 'kinetic';
  if (value === Domain.HYPERFRAMES) return 'hyperframes';
  if (value === Domain.P5 || value === Domain.THREE || value === Domain.HYDRA || value === Domain.TONE || value === Domain.STRUDEL || value === Domain.ASCII) return value;
  return null;
}

function dispatchForRequestedDomain(domain?: Domain | string): DispatchResult {
  const entryName = entryNameForDomain(domain);
  if (!entryName || typeof generatorRegistry.getAll !== 'function') return null;
  const entry = generatorRegistry.getAll().find((candidate) => candidate.name === entryName);
  return entry ? { entry, confidence: 1 } : null;
}

/**
 * Union type for all generate() return values.
 * Backward-compatible: existing callers reading .code still work via GenerationSuccess.
 */
export type GenerationResult = ClarifyResult | GenerationSuccess;

/**
 * Normalize generator result to GenerationSuccess format.
 * Handles backward compatibility with string returns.
 */
function normalizeGeneratorResult(
  result: string | GeneratorResultType
): GenerationSuccess {
  if (typeof result === 'string') {
    return { needsClarification: false, code: result };
  }
  return {
    needsClarification: false,
    code: result.code,
    thinking: result.thinking,
    model: result.model,
    recoveredFromThinking: result.recoveredFromThinking,
    warnings: [],
  };
}

/**
 * Extracts code string from generator result (handles both string and GeneratorResult).
 */
function extractCode(result: string | GeneratorResultType): string {
  if (typeof result === 'string') {
    return result;
  }
  return result.code;
}

/**
 * LLM caller wrapper for collaboration modes.
 * Handles custom LLM callbacks, dispatched generators, and fallback to P5GeneratorLLM.
 */
async function collabLLMCaller(
  prompt: string,
  _systemPrompt: string | undefined,
  normalizedOptions: NormalizedLoopOptions,
  dispatched: DispatchResult
): Promise<string> {
  if (normalizedOptions.collabConfig?.callLLM) {
    return normalizedOptions.collabConfig.callLLM(prompt, _systemPrompt);
  }
  if (dispatched?.entry.name === 'llm') {
    const result = await dispatched.entry.generate(prompt, {});
    return extractCode(result);
  }
  const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
  const config = await getEffectiveConfig(undefined, process.cwd());
  const generator = new P5GeneratorLLM(config.baseUrl ? { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey, role: 'generator' } : undefined);
  const result = await generator.generate(prompt);
  return extractCode(result);
}

/**
 * Orchestrates code generation across swarm, collaboration, and standard generators.
 * 
 * CONSOLIDATED: All collaboration now routes through CollaborationEngine.
 * The old DeepCollaboration and CollaborativeClient classes have been removed.
 */
export class GenerationOrchestrator {
  constructor(
    private options: NormalizedLoopOptions,
    private gallery: Gallery,
    private archiveLearning: ArchiveLearning | null
  ) {}

  /**
   * Generate code using the appropriate strategy based on options.
   */
  async generate(
    usedPrompt: string,
    _loadedPrompt: string,
    bypassCache?: boolean,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    throwIfAborted(signal);
    await registerAllGenerators();
    throwIfAborted(signal);
    const dispatched = dispatchForRequestedDomain(this.options.collabDomain) ?? generatorRegistry.dispatch(usedPrompt);

    if (this.options.useSwarm) {
      const result = await this.generateWithSwarm(usedPrompt, signal);
      throwIfAborted(signal);
      return result;
    }

    // Consolidated collaboration path - all collaboration goes through CollaborationEngine
    if (this.options.useDeepCollab || this.options.useCollab) {
      const result = await this.generateWithCollaboration(usedPrompt, dispatched, signal);
      throwIfAborted(signal);
      return result;
    }

    if (dispatched) {
      const generatorParams = bypassCache !== undefined || signal
        ? { bypassCache, signal }
        : undefined;
      const result = generatorParams
        ? await dispatched.entry.generate(usedPrompt, generatorParams)
        : await dispatched.entry.generate(usedPrompt);
      throwIfAborted(signal);
      return normalizeGeneratorResult(result);
    }

    // NO specialized generator matched — check for ambiguity before falling back to P5
    const ambiguityDetector = new AmbiguityDetector();
    const issues = ambiguityDetector.detect(usedPrompt);

    if (issues.length > 0) {
      const hints = ambiguityDetector.getDomainHints(usedPrompt);
      // Format questions for the user — limit to 4
      const questions = issues.slice(0, 4).map((issue) => ({
        question: issue.suggestedQuestion,
        options: null, // free-text answer
        default: '',
      }));

      return {
        needsClarification: true,
        clarifyingQuestions: questions,
        suggestions: hints,
      } as ClarifyResult;
    }

    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const config = await getEffectiveConfig(undefined, process.cwd());
    const generator = new P5GeneratorLLM(config.baseUrl ? { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey, role: 'generator' } : undefined, { bypassCache });
    const result = await generator.generate(usedPrompt, { bypassCache, signal });
    throwIfAborted(signal);
    return normalizeGeneratorResult(result);
  }

  private async generateWithSwarm(prompt: string, signal?: AbortSignal): Promise<GenerationResult> {
    const orchestrator = new SwarmOrchestrator(this.options.swarmConfig, {
      signal,
      onProgress: (data) => {
        throwIfAborted(signal);
        this.options.onProgress?.({
          iteration: data.round,
          score: 0,
          promiseDetected: false,
          code: '',
          timestamp: new Date().toISOString(),
        });
      },
    });

    const swarmResult = await abortable(orchestrator.run(prompt, this.options.swarmMode), signal);
    throwIfAborted(signal);
    const warnings: string[] = [];

    if (this.options.project) {
      try {
        await this.gallery.saveSwarmSession(this.options.project, swarmResult);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.error('GenerationOrchestrator', 'Swarm session save failed:', err);
        warnings.push(`Swarm session save failed: ${msg}`);
      }
    }

    if (this.archiveLearning) {
      try {
        const mined = MiningEngine.mineResult(swarmResult);
        for (const fragment of mined) {
          this.archiveLearning.addFragment(fragment, this.options.collabDomain || 'p5');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        Logger.error('GenerationOrchestrator', 'Swarm mining failed:', err);
        warnings.push(`Swarm mining failed: ${msg}`);
      }
    }

    return { needsClarification: false, code: swarmResult.finalOutput, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Generate using the consolidated CollaborationEngine.
   * 
   * As part of Fix 8: Consolidate Triple Redundancy, all collaboration
   * modes (deep collab, simple collab) now route through CollaborationEngine
   * which uses SwarmOrchestrator internally.
   */
  private async generateWithCollaboration(
    usedPrompt: string,
    dispatched: DispatchResult,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    const llmCaller = async (prompt: string, _systemPrompt?: string) => {
      throwIfAborted(signal);
      return abortable(collabLLMCaller(prompt, _systemPrompt, this.options, dispatched), signal);
    };

    // All collaboration now goes through the consolidated CollaborationEngine
    // which routes to SwarmOrchestrator
    const engine = new CollaborationEngine({
      domain: this.options.collabDomain || Domain.P5,
      systemPrompt: '',
      callLLM: llmCaller,
      signal,
      convergenceThreshold: this.options.collabConfig?.convergenceThreshold,
      maxRounds: this.options.collabConfig?.maxRounds ?? this.options.collabConfig?.maxPhases,
      swarmConfig: {
        mode: this.options.swarmMode ?? 'hybrid',
        maxRounds: this.options.swarmConfig?.maxRounds ?? this.options.collabConfig?.maxRounds ?? this.options.collabConfig?.maxPhases ?? 4,
        ...this.options.swarmConfig,
      },
      onProgress: (update: PhaseUpdate & { mode: string }) => {
        throwIfAborted(signal);
        this.options.onProgress?.({
          iteration: 0,
          score: update.quality || 0,
          promiseDetected: false,
          code: update.output || '',
          timestamp: new Date().toISOString(),
        });
      },
    });

    const collabResult = await abortable(engine.run(usedPrompt), signal);
    throwIfAborted(signal);
    return { needsClarification: false, code: collabResult.output };
  }
}
