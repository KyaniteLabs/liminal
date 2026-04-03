/**
 * SwarmOptions - Configuration for swarm generation mode
 *
 * Extracted from LoopOptions to reduce interface size and improve
 * modularity. Swarm mode enables multi-agent generation with
 * persona-based collaborative refinement.
 */

import { SwarmMode, type SwarmConfig } from '../../swarm/types.js';

/**
 * Swarm generation options
 */
export interface SwarmOptions {
  /** Enable swarm generation (7-persona Ollama swarm) */
  enabled?: boolean;
  /** Configuration for the swarm */
  config?: Partial<SwarmConfig>;
  /** Swarm generative mode (default: 'hybrid') */
  mode?: SwarmMode;
  /** Number of parallel agents */
  swarmSize?: number;
  /** Delay between agent starts (ms) */
  staggerDelay?: number;
  /** Timeout per agent (ms) */
  agentTimeout?: number;
  /** Whether to continue on individual failures */
  continueOnFailure?: boolean;
}

/**
 * Normalize SwarmOptions with defaults
 */
export function normalizeSwarmOptions(
  options?: SwarmOptions | null
): Required<Pick<SwarmOptions, 'enabled' | 'mode'>> &
  Pick<SwarmOptions, 'config' | 'swarmSize' | 'staggerDelay' | 'agentTimeout' | 'continueOnFailure'> {
  return {
    enabled: options?.enabled ?? false,
    config: options?.config ?? {},
    mode: options?.mode ?? SwarmMode.HYBRID,
    swarmSize: options?.swarmSize,
    staggerDelay: options?.staggerDelay,
    agentTimeout: options?.agentTimeout,
    continueOnFailure: options?.continueOnFailure,
  };
}
