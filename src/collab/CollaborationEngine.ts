/**
 * CollaborationEngine — unified entry point for multi-model collaboration.
 *
 * Consolidated to use only SwarmOrchestrator as THE collaboration system.
 * Previous modes ('phases', 'simple') have been removed as part of
 * Fix 8: Consolidate Triple Redundancy.
 *
 * All collaboration now goes through the swarm orchestrator which provides:
 * - Multi-persona parallel generation
 * - Voting-based selection
 * - Multiple swarm modes (competitive, hybrid, ring, mesh)
 */

import { SwarmOrchestrator, type SwarmOrchestratorOptions } from '../swarm/SwarmOrchestrator.js';
import type { SwarmConfig, SwarmMode, SwarmResult } from '../swarm/types.js';
import { Domain } from '../types/domains.js';
import { ScoringEngine } from '../core/ScoringEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Collaboration mode - now only supports swarm. */
export type CollaborationMode = 'swarm';

/** Unified result from collaboration. */
export interface CollaborationEngineResult {
  /** The final creative output. */
  output: string;
  /** Quality score (0-1) from ScoringEngine. */
  qualityScore: number;
  /** Which strategy was used - always 'swarm'. */
  mode: CollaborationMode;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Whether the strategy converged early. */
  converged: boolean;
  /** Raw swarm result for advanced consumers. */
  raw: SwarmResult;
}

/** Progress update callback data. */
export interface PhaseUpdate {
  phaseName: string;
  model: string;
  action: string;
  output?: string;
  quality?: number;
  duration?: number;
}

/** Configuration for the CollaborationEngine. */
export interface CollaborationEngineConfig {
  /** Domain hint for scoring. */
  domain?: Domain;
  /** System prompt prefix. */
  systemPrompt?: string;
  /** Convergence threshold (0-1). Stop early when quality reaches this. */
  convergenceThreshold?: number;
  /** Max rounds. */
  maxRounds?: number;
  /** LLM caller — shared across strategies. */
  callLLM: (prompt: string, systemPrompt?: string) => Promise<string>;
  /** Swarm-specific config. */
  swarmConfig?: Partial<SwarmConfig>;
  /** Swarm-specific options. */
  swarmOptions?: SwarmOrchestratorOptions;
  /** Progress callback. */
  onProgress?: (update: PhaseUpdate & { mode: CollaborationMode }) => void;
}

// ---------------------------------------------------------------------------
// CollaborationEngine
// ---------------------------------------------------------------------------

/**
 * CollaborationEngine - THE collaboration system for Liminal.
 *
 * Consolidated to use only SwarmOrchestrator. All collaboration modes
 * now route through the swarm for consistency and maintainability.
 */
export class CollaborationEngine {
  private config: CollaborationEngineConfig;
  private scoringEngine: ScoringEngine;

  constructor(config: CollaborationEngineConfig) {
    this.config = config;
    this.scoringEngine = new ScoringEngine('comprehensive');
  }

  /**
   * Run collaboration using the swarm orchestrator.
   */
  async run(prompt: string): Promise<CollaborationEngineResult> {
    const swarmMode = (this.config.swarmConfig?.mode ?? 'hybrid') as SwarmMode;
    const systemPrompt = this.config.systemPrompt ?? '';
    const swarmConfig = {
      ...this.config.swarmConfig,
      maxRounds: this.config.swarmConfig?.maxRounds ?? this.config.maxRounds,
      convergenceThreshold: this.config.swarmConfig?.convergenceThreshold ?? this.config.convergenceThreshold,
    };

    const orchestrator = new SwarmOrchestrator(swarmConfig, {
      ...this.config.swarmOptions,
      // CollaborationEngine owns the runtime LLM adapter; keep swarm from silently
      // falling back to its default Ollama path when callers inject another provider.
      callOllama: (_model, personaSystemPrompt, userPrompt) =>
        this.config.callLLM(userPrompt, [systemPrompt, personaSystemPrompt].filter(Boolean).join('\n\n')),
      onProgress: (data) => {
        this.config.onProgress?.({
          mode: 'swarm',
          phaseName: 'Round',
          model: 'Swarm',
          action: `Round ${data.round}/${data.totalRounds}, winner: ${data.winnerId}`,
        });
      },
    });

    const result = await orchestrator.run(prompt, swarmMode);
    const score = await this.scoringEngine.quick(result.finalOutput);

    return {
      output: result.finalOutput,
      qualityScore: score,
      mode: 'swarm',
      durationSeconds: result.totalDurationMs / 1000,
      converged: result.converged,
      raw: result,
    };
  }
}
