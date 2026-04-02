/**
 * GenerationOrchestrator - Swarm/collab/generator dispatch for RalphLoop
 *
 * Handles the complex generation dispatch logic:
 * - LLM caller wrapper for collaboration modes
 * - Swarm generation (7-persona Ollama swarm)
 * - Deep collaboration (multi-model specialized roles)
 * - Simple 2-model collaboration
 * - Standard generator registry dispatch
 *
 * Extracted from RalphLoop.ts (lines 176-193, 346-418, 973-1066).
 */

import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import type { GeneratorEntry } from '../generators/GeneratorRegistry.js';
import { registerAllGenerators } from '../generators/registerGenerators.js';
import { Gallery } from '../gallery/Gallery.js';
import { DeepCollaboration } from '../collab/DeepCollaboration.js';
import { CollaborativeClient } from '../collab/CollaborativeClient.js';
import { CollaborationEngine } from '../collab/CollaborationEngine.js';
import type { DeepCollaborationConfig, CollaborativeConfig } from '../collab/types.js';
import { SwarmOrchestrator } from '../swarm/SwarmOrchestrator.js';
import { MiningEngine } from '../swarm/MiningEngine.js';
import { ArchiveLearning } from '../learning/index.js';
import type { NormalizedLoopOptions } from './LoopConfig.js';

type DispatchResult = { entry: GeneratorEntry; confidence: number } | null;

export interface GenerationResult {
  code: string;
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
    const result = dispatched.entry.generate(prompt, {});
    return typeof result === 'string' ? result : await result;
  }
  const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
  const generator = new P5GeneratorLLM();
  const result = generator.generate(prompt);
  return typeof result === 'string' ? result : await result;
}

/**
 * Orchestrates code generation across swarm, collaboration, and standard generators.
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

    if (this.options.useDeepCollab || this.options.useCollab) {
      if (this.options.collabMode) {
        return this.generateWithCollabEngine(usedPrompt, dispatched);
      }
      return this.generateWithCollaboration(usedPrompt, dispatched, bypassCache);
    }

    if (dispatched) {
      const genPrompt = dispatched.entry.name === 'llm' ? usedPrompt : loadedPrompt;
      const code = await dispatched.entry.generate(genPrompt);
      return { code };
    }

    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const generator = new P5GeneratorLLM(undefined, { bypassCache });
    const code = await generator.generate(usedPrompt, { bypassCache });
    return { code };
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
        console.warn('Swarm session save failed:', err);
      }
    }

    if (this.archiveLearning) {
      try {
        const mined = MiningEngine.mineResult(swarmResult);
        for (const fragment of mined) {
          this.archiveLearning.addFragment(fragment, this.options.collabDomain || 'p5');
        }
      } catch (err) {
        console.warn('Swarm mining failed:', err);
      }
    }

    return { code: swarmResult.finalOutput };
  }

  private async generateWithCollabEngine(usedPrompt: string, dispatched: DispatchResult): Promise<GenerationResult> {
    const llmCaller = (prompt: string, _systemPrompt?: string) =>
      collabLLMCaller(prompt, _systemPrompt, this.options, dispatched);

    const engine = new CollaborationEngine({
      mode: this.options.collabMode!,
      domain: this.options.collabDomain || 'p5',
      systemPrompt: '',
      callLLM: llmCaller,
      convergenceThreshold: this.options.collabConfig?.convergenceThreshold,
      maxRounds: this.options.collabConfig?.maxRounds ?? this.options.collabConfig?.maxPhases,
      onProgress: (update) => {
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

  private async generateWithCollaboration(usedPrompt: string, dispatched: DispatchResult, bypassCache?: boolean): Promise<GenerationResult> {
    const shouldUseCollab = !dispatched || dispatched.entry.name === 'llm';

    if (shouldUseCollab) {
      const llmCaller = (prompt: string, _systemPrompt?: string) =>
        collabLLMCaller(prompt, _systemPrompt, this.options, dispatched);
      const code = await this.runCollaboration(usedPrompt, llmCaller);
      return { code };
    } else if (dispatched) {
      const code = await dispatched.entry.generate(usedPrompt);
      return { code };
    }

    const { P5GeneratorLLM } = await import('../generators/p5/P5GeneratorLLM.js');
    const generator = new P5GeneratorLLM(undefined, { bypassCache });
    const code = await generator.generate(usedPrompt, { bypassCache });
    return { code };
  }

  private async runCollaboration(
    prompt: string,
    fallbackLLM: (prompt: string, systemPrompt?: string) => Promise<string>
  ): Promise<string> {
    const domain = this.options.collabDomain || 'p5';

    if (this.options.useDeepCollab) {
      const collab = new DeepCollaboration({
        ...this.options.collabConfig,
        callLLM: fallbackLLM,
      } as DeepCollaborationConfig);

      return await collab.generate(
        prompt,
        domain,
        '',
        (update) => {
          this.options.onProgress?.({
            iteration: 0,
            score: update.quality || 0,
            promiseDetected: false,
            code: update.output || '',
            timestamp: new Date().toISOString(),
          });
        }
      );
    } else {
      const collab = new CollaborativeClient({
        ...this.options.collabConfig,
        callLLM: fallbackLLM,
      } as CollaborativeConfig);

      return await collab.generate(
        prompt,
        domain,
        '',
        (update) => {
          this.options.onProgress?.({
            iteration: 0,
            score: update.quality || 0,
            promiseDetected: false,
            code: update.output || '',
            timestamp: new Date().toISOString(),
          });
        }
      );
    }
  }
}
