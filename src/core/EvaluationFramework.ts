/**
 * EvaluationFramework - Unified evaluation interface
 *
 * Backward-compatible facade over ScoringEngine. Existing callers
 * (RalphLoop, etc.) continue to work unchanged while internally
 * delegating to the pluggable scoring system.
 *
 * Strategy mapping (legacy → ScoringEngine):
 *   'detailed'    → 'comprehensive'
 *   'fast'        → 'keyword'
 *   'heuristic'   → 'fast'
 *   'fitness'     → handled in-place (pure math, no scorer needed)
 */

import { ScoringEngine, type ScoringResult } from './ScoringEngine.js';
import type { DomainType } from '../collab/types.js';
import type { SwarmPersona } from '../swarm/types.js';

/** Legacy result from any evaluation strategy. */
export interface EvaluationResult {
  /** Overall score (0-1) */
  score: number;
  /** Dimension-specific scores (when available) */
  details?: Record<string, number>;
  /** Human-readable reasoning or feedback (when available) */
  reasoning?: string;
  /** Specific issues identified during evaluation (from detailed strategy) */
  issues?: string[];
  /** The strategy used for evaluation */
  strategy: EvaluationStrategy;
}

/** Contextual information for evaluation. */
export interface EvaluationContext {
  prompt?: string;
  domain?: DomainType;
  criteria?: string[];
  previousOutputs?: string[];
  persona?: SwarmPersona;
  dimensionScores?: Record<string, number>;
  weights?: Record<string, number>;
}

/** Available evaluation strategies (legacy names preserved for backward compatibility). */
export type EvaluationStrategy = 'detailed' | 'fast' | 'heuristic' | 'fitness';

/** Map legacy strategy names to ScoringEngine strategy names. */
const STRATEGY_MAP: Record<string, string> = {
  detailed: 'comprehensive',
  heuristic: 'fast',
  fast: 'keyword',
};

/** Shared ScoringEngine instance. */
let engine: ScoringEngine | null = null;

function getEngine(): ScoringEngine {
  if (!engine) {
    engine = new ScoringEngine('comprehensive');
  }
  return engine;
}

/** Convert a ScoringResult to the legacy EvaluationResult shape. */
function toLegacyResult(result: ScoringResult, legacyStrategy: string): EvaluationResult {
  return {
    score: result.score,
    details: result.dimensions as Record<string, number> | undefined,
    reasoning: result.issues?.length ? result.issues.join('; ') : undefined,
    issues: result.issues,
    strategy: legacyStrategy as EvaluationStrategy,
  };
}

export class EvaluationFramework {
  /**
   * Evaluate input using the specified strategy.
   *
   * Delegates to ScoringEngine for 'detailed', 'fast', and 'heuristic'.
   * 'fitness' is handled in-place as pure weighted-average math.
   */
  static async evaluate(
    input: string,
    strategy: EvaluationStrategy = 'fast',
    context: EvaluationContext = {}
  ): Promise<EvaluationResult> {
    // Fitness strategy is pure math — no scorer needed.
    if (strategy === 'fitness') {
      const weights = context.weights || {};
      const scores = context.dimensionScores || {};
      const entries = Object.entries(scores).filter(([, val]) => val !== undefined) as [string, number][];

      let totalWeight = 0;
      let weightedSum = 0;
      for (const [dimension, score] of entries) {
        const weight = weights[dimension] ?? weights['default'] ?? 1;
        weightedSum += score * weight;
        totalWeight += weight;
      }
      const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

      const details: Record<string, number> = {};
      for (const [key, value] of entries) {
        details[key] = value;
      }

      return { score, details, strategy: 'fitness' };
    }

    const engineName = STRATEGY_MAP[strategy] ?? strategy;
    const result = await getEngine().score(
      {
        output: input,
        domain: context.domain,
        prompt: context.prompt,
        previousOutputs: context.previousOutputs,
        persona: context.persona,
        criteria: context.criteria,
      },
      engineName,
    );

    return toLegacyResult(result, strategy);
  }

  /**
   * Access the underlying ScoringEngine for custom strategy registration.
   */
  static getEngine(): ScoringEngine {
    return getEngine();
  }
}
