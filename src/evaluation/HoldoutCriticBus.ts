/**
 * HoldoutCriticBus — Phase 15
 *
 * Prevents Goodharting by running multiple independent critics
 * and monitoring disagreement. When scores collapse into overfitting
 * (all critics agree too strongly), the system escalates.
 *
 * Critics:
 * - Primary taste model
 * - Aesthetic critics (from existing evaluation fabric)
 * - Emergence critics (from Phase 14)
 * - Hidden holdout checks
 */

import type { ArchiveEntry } from '../emergence/types.js';

export interface CriticVote {
  criticId: string;
  score: number;
  weight: number;
  /** Why this critic gave this score */
  reasoning?: string;
}

export interface HoldoutResult {
  /** Weighted average across all critics */
  compositeScore: number;
  /** Individual votes */
  votes: CriticVote[];
  /** Agreement level between critics */
  agreement: 'consensus' | 'minor-divergence' | 'major-divergence';
  /** Whether the result is blocked due to overfitting suspicion */
  blocked: boolean;
  /** Explanation of the decision */
  explanation: string;
}

export type CriticFn = (entry: ArchiveEntry) => number;

export interface HoldoutCriticBusConfig {
  /** Maximum standard deviation for "consensus" (default: 0.1) */
  consensusThreshold?: number;
  /** Minimum std dev for "major-divergence" (default: 0.3) */
  majorDivergenceThreshold?: number;
  /** Whether to block on major divergence (default: true) */
  blockOnDivergence?: boolean;
}

const DEFAULT_CONSENSUS = 0.1;
const DEFAULT_MAJOR = 0.3;
const DEFAULT_BLOCK = true;

export class HoldoutCriticBus {
  private readonly critics: Map<string, { fn: CriticFn; weight: number }> = new Map();
  private readonly consensusThreshold: number;
  private readonly majorDivergenceThreshold: number;
  private readonly blockOnDivergence: boolean;

  constructor(config: HoldoutCriticBusConfig = {}) {
    this.consensusThreshold = config.consensusThreshold ?? DEFAULT_CONSENSUS;
    this.majorDivergenceThreshold = config.majorDivergenceThreshold ?? DEFAULT_MAJOR;
    this.blockOnDivergence = config.blockOnDivergence ?? DEFAULT_BLOCK;
  }

  /**
   * Register a critic with an ID and weight.
   */
  registerCritic(criticId: string, fn: CriticFn, weight: number = 1.0): void {
    this.critics.set(criticId, { fn, weight });
  }

  /**
   * Evaluate an artifact through all registered critics.
   */
  evaluate(entry: ArchiveEntry): HoldoutResult {
    const votes: CriticVote[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [id, critic] of this.critics) {
      const score = critic.fn(entry);
      votes.push({ criticId: id, score, weight: critic.weight });
      weightedSum += score * critic.weight;
      totalWeight += critic.weight;
    }

    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Compute disagreement
    const scores = votes.map(v => v.score);
    const stdDev = this.standardDeviation(scores);

    let agreement: HoldoutResult['agreement'];
    if (stdDev <= this.consensusThreshold) {
      agreement = 'consensus';
    } else if (stdDev >= this.majorDivergenceThreshold) {
      agreement = 'major-divergence';
    } else {
      agreement = 'minor-divergence';
    }

    const blocked = agreement === 'major-divergence' && this.blockOnDivergence;

    let explanation: string;
    if (blocked) {
      explanation = `Blocked: critics disagree significantly (std: ${stdDev.toFixed(3)}). Possible overfitting.`;
    } else if (agreement === 'consensus') {
      explanation = `Consensus: all critics agree (std: ${stdDev.toFixed(3)}). Score: ${compositeScore.toFixed(3)}.`;
    } else {
      const maxCritic = votes.reduce((a, b) => a.score > b.score ? a : b);
      const minCritic = votes.reduce((a, b) => a.score < b.score ? a : b);
      explanation = `Minor divergence: ${maxCritic.criticId} (${maxCritic.score.toFixed(2)}) vs ${minCritic.criticId} (${minCritic.score.toFixed(2)}).`;
    }

    return { compositeScore, votes, agreement, blocked, explanation };
  }

  /**
   * Check if the critic bus has enough critics registered.
   */
  isReady(): boolean {
    return this.critics.size >= 2;
  }

  /**
   * Get registered critic IDs.
   */
  getCriticIds(): string[] {
    return [...this.critics.keys()];
  }

  /**
   * Remove a critic by ID.
   */
  removeCritic(criticId: string): boolean {
    return this.critics.delete(criticId);
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
