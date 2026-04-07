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

type DispatchResult = { entry: GeneratorEntry; confidence: number } | null;

export interface GenerationResult {
  code: string;
  thinking?: string;
  model?: string;
  recoveredFromThinking?: boolean;
}

/**
 * Normalize generator result to GenerationResult format.
 * Handles backward compatibility with string returns.
 */
function normalizeGeneratorResult(
  result: string | GeneratorResultType
): GenerationResult {
  if (typeof result === 'string') {
    return { code: result };
  }
  return {
    code: result.code,
    thinking: result.thinking,
    model: result.model,
    recoveredFromThinking: result.recoveredFromThinking,
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
    loadedPrompt: string,
    bypassCache?: boolean
  ): Promise<GenerationResult> {
    await registerAllGenerators();
    const dispatched = generatorRegistry.dispatch(loadedPrompt);

    if (this.options.useSwarm) {
      return this.generateWithSwarm(usedPrompt);
    }

    // Consolidated collaboration path - all collaboration goes through CollaborationEngine
    if (this.options.useDeepCollab || this.options.useCollab) {
      return this.generateWithCollaboration(usedPrompt, dispatched);
    }

    if (dispatched) {
      const genPrompt = dispatched.entry.name === 'llm' ? usedPrompt : loadedPrompt;
      const result = await dispatched.entry.generate(genPrompt);
      return normalizeGeneratorResult(result);
    }

    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const config = await getEffectiveConfig(undefined, process.cwd());
    const generator = new P5GeneratorLLM(config.baseUrl ? { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey, role: 'generator' } : undefined, { bypassCache });
    const result = await generator.generate(usedPrompt, { bypassCache });
    return normalizeGeneratorResult(result);
  }

  private async generateWithSwarm(prompt: string): Promise<GenerationResult> {
    const orchestrator = new SwarmOrchestrator(this.options.swarmConfig, {
      onProgress: (data) => {
        this.options.onProgress?.({
          iteration: data.round,
          score: 0,
          promiseDetected: false,
          code: '',
          timestamp: new Date().toISOString(),
        });
      },
    });

    const swarmResult = await orchestrator.run(prompt, this.options.swarmMode);

    if (this.options.project) {
      try {
        await this.gallery.saveSwarmSession(this.options.project, swarmResult);
      } catch (err) {
        Logger.warn('GenerationOrchestrator', 'Swarm session save failed:', err);
      }
    }

    if (this.archiveLearning) {
      try {
        const mined = MiningEngine.mineResult(swarmResult);
        for (const fragment of mined) {
          this.archiveLearning.addFragment(fragment, this.options.collabDomain || 'p5');
        }
      } catch (err) {
        Logger.warn('GenerationOrchestrator', 'Swarm mining failed:', err);
      }
    }

    return { code: swarmResult.finalOutput };
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
    dispatched: DispatchResult
  ): Promise<GenerationResult> {
    const llmCaller = (prompt: string, _systemPrompt?: string) =>
      collabLLMCaller(prompt, _systemPrompt, this.options, dispatched);

    // All collaboration now goes through the consolidated CollaborationEngine
    // which routes to SwarmOrchestrator
    const engine = new CollaborationEngine({
      domain: this.options.collabDomain || Domain.P5,
      systemPrompt: '',
      callLLM: llmCaller,
      convergenceThreshold: this.options.collabConfig?.convergenceThreshold,
      maxRounds: this.options.collabConfig?.maxRounds ?? this.options.collabConfig?.maxPhases,
      swarmConfig: {
        mode: this.options.swarmMode ?? 'hybrid',
        maxRounds: this.options.swarmConfig?.maxRounds ?? 4,
        ...this.options.swarmConfig,
      },
      onProgress: (update: PhaseUpdate & { mode: string }) => {
        this.options.onProgress?.({
          iteration: 0,
          score: update.quality || 0,
          promiseDetected: false,
          code: update.output || '',
          timestamp: new Date().toISOString(),
        });
      },
    });

    const collabResult = await engine.run(usedPrompt);
    return { code: collabResult.output };
  }
}
