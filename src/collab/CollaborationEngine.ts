/**
 * CollaborationEngine — single entry point for all collaboration strategies.
 *
 * Wraps the three existing collaboration systems behind a unified interface:
 * - 'swarm':   Multi-persona parallel generation (SwarmOrchestrator)
 * - 'phases':  Specialist pipeline: creator → critic → integrator (DeepCollaboration)
 * - 'simple':  2-model ping-pong (CollaborativeClient)
 *
 * All strategies share the ScoringEngine for quality evaluation.
 */

import { SwarmOrchestrator, type SwarmOrchestratorOptions } from '../swarm/SwarmOrchestrator.js';
import type { SwarmConfig, SwarmMode, SwarmResult } from '../swarm/types.js';
import { DeepCollaboration } from './DeepCollaboration.js';
import { CollaborativeClient } from './CollaborativeClient.js';
import type { DeepCollaborationConfig, DeepCollaborationResult, CollaborativeConfig, CollaborativeResult, PhaseUpdate } from './types.js';
import { Domain } from '../types/domains.js';
import { ScoringEngine } from '../core/ScoringEngine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which collaboration strategy to use. */
export type CollaborationMode = 'swarm' | 'phases' | 'simple';

/** Unified result from any collaboration strategy. */
export interface CollaborationEngineResult {
  /** The final creative output. */
  output: string;
  /** Quality score (0-1) from ScoringEngine. */
  qualityScore: number;
  /** Which strategy was used. */
  mode: CollaborationMode;
  /** Duration in seconds. */
  durationSeconds: number;
  /** Whether the strategy converged early. */
  converged: boolean;
  /** Raw strategy-specific result for advanced consumers. */
  raw: SwarmResult | DeepCollaborationResult | CollaborativeResult;
}

/** Configuration for the CollaborationEngine. */
export interface CollaborationEngineConfig {
  /** Which strategy to use. */
  mode: CollaborationMode;
  /** Domain hint for scoring. */
  domain?: Domain;
  /** System prompt prefix. */
  systemPrompt?: string;
  /** Convergence threshold (0-1). Stop early when quality reaches this. */
  convergenceThreshold?: number;
  /** Max rounds/phases. */
  maxRounds?: number;
  /** LLM caller — shared across strategies. */
  callLLM: (prompt: string, systemPrompt?: string) => Promise<string>;
  /** Swarm-specific config (mode='swarm' only). */
  swarmConfig?: Partial<SwarmConfig>;
  /** Swarm-specific options (mode='swarm' only). */
  swarmOptions?: SwarmOrchestratorOptions;
  /** Progress callback. */
  onProgress?: (update: PhaseUpdate & { mode: CollaborationMode }) => void;
}

// ---------------------------------------------------------------------------
// CollaborationEngine
// ---------------------------------------------------------------------------

export class CollaborationEngine {
  private config: CollaborationEngineConfig;
  private scoringEngine: ScoringEngine;

  constructor(config: CollaborationEngineConfig) {
    this.config = config;
    this.scoringEngine = new ScoringEngine('comprehensive');
  }

  /**
   * Run collaboration with the configured strategy.
   */
  async run(prompt: string): Promise<CollaborationEngineResult> {
    switch (this.config.mode) {
      case 'swarm':
        return this.runSwarm(prompt);
      case 'phases':
        return this.runPhases(prompt);
      case 'simple':
        return this.runSimple(prompt);
      default:
        throw new Error(`Unknown collaboration mode: ${this.config.mode}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Swarm strategy
  // ---------------------------------------------------------------------------

  private async runSwarm(prompt: string): Promise<CollaborationEngineResult> {
    const swarmMode = (this.config.swarmConfig?.mode ?? 'hybrid') as SwarmMode;

    const orchestrator = new SwarmOrchestrator(this.config.swarmConfig, {
      ...this.config.swarmOptions,
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

  // ---------------------------------------------------------------------------
  // Phases strategy (DeepCollaboration)
  // ---------------------------------------------------------------------------

  private async runPhases(prompt: string): Promise<CollaborationEngineResult> {
    const deepConfig: DeepCollaborationConfig = {
      callLLM: this.config.callLLM,
      maxPhases: this.config.maxRounds,
      convergenceThreshold: this.config.convergenceThreshold,
    };

    const client = new DeepCollaboration(deepConfig);
    const result = await client.generateDeepCollaboration(
      prompt,
      this.config.domain,
      this.config.systemPrompt,
      (update) => this.config.onProgress?.({ ...update, mode: 'phases' }),
    );

    return {
      output: result.finalOutput,
      qualityScore: result.qualityScore,
      mode: 'phases',
      durationSeconds: result.totalDurationSeconds,
      converged: result.metadata.converged,
      raw: result,
    };
  }

  // ---------------------------------------------------------------------------
  // Simple strategy (CollaborativeClient)
  // ---------------------------------------------------------------------------

  private async runSimple(prompt: string): Promise<CollaborationEngineResult> {
    const simpleConfig: CollaborativeConfig = {
      callLLM: this.config.callLLM,
      maxRounds: this.config.maxRounds,
      convergenceThreshold: this.config.convergenceThreshold,
    };

    const client = new CollaborativeClient(simpleConfig);
    const result = await client.generateCollaborative(
      prompt,
      this.config.domain,
      this.config.systemPrompt,
      (update) => this.config.onProgress?.({ ...update, mode: 'simple' }),
    );

    return {
      output: result.finalOutput,
      qualityScore: result.qualityScore,
      mode: 'simple',
      durationSeconds: result.totalDurationSeconds,
      converged: result.metadata.converged,
      raw: result,
    };
  }
}
