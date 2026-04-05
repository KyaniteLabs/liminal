/**
 * ForgettingCurve — Ebbinghaus-inspired retention decay for memory items.
 *
 * Provides a shared, reusable retention computation that works across all
 * intuition components: ThompsonSampler arms, IntuitionCache entries,
 * DomainPrototype centroids, CreativeWorldModel observations, and
 * MemoryConsolidator patterns.
 *
 * The forgetting curve follows Ebbinghaus: R(t) = exp(-t / S)
 * where t = time elapsed since last reinforcement, S = stability constant.
 *
 * A higher stability means slower forgetting. Items that are "reinforced"
 * (updated with new data) get their clock reset, following the spacing effect:
 * well-distributed reinforcement builds stronger retention.
 *
 * Also supports:
 *   - **Decay scheduling**: Pre-compute when items will hit a given retention threshold
 *   - **Reinforcement bonus**: Items reinforced multiple times decay slower (stability increases)
 *   - **Composite value**: retention * quality for budget-gated pruning decisions
 *
 * @module intuition/ForgettingCurve
 */

import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An item that can be decayed — must have a timestamp and quality signal. */
export interface DecayableItem {
  /** When this item was last updated/reinforced (ISO 8601) */
  lastUpdated: string;
  /** Quality score (0-1) — used for composite value computation */
  quality: number;
  /** Number of times this item has been reinforced (optional, default 1) */
  reinforcementCount?: number;
}

/** Result of a decay computation. */
export interface DecayResult {
  /** Retention score after applying decay (0-1) */
  retention: number;
  /** Days since last update */
  daysSinceUpdate: number;
  /** Effective stability constant (may be boosted by reinforcement) */
  effectiveStability: number;
  /** Composite value: retention * quality */
  value: number;
  /** Whether this item should be pruned (below threshold) */
  shouldPrune: boolean;
}

/** Configuration for the forgetting curve. */
export interface ForgettingCurveConfig {
  /** Base stability constant S (days). Higher = slower decay. Default: 10 */
  stability?: number;
  /** Retention threshold below which items are prune candidates. Default: 0.05 */
  pruneThreshold?: number;
  /** Maximum age in days regardless of retention. Default: 90 */
  maxAgeDays?: number;
  /** Whether reinforcement increases stability (spacing effect). Default: true */
  spacingEffect?: boolean;
  /** How much each reinforcement increases stability (multiplier). Default: 0.2 */
  reinforcementBoost?: number;
  /** Maximum stability cap (prevents infinite stability). Default: 100 */
  maxStability?: number;
}

/** Summary statistics of decay across a collection of items. */
export interface DecaySummary {
  /** Total items analyzed */
  totalItems: number;
  /** Items with retention >= 0.5 */
  strongItems: number;
  /** Items with 0.05 <= retention < 0.5 */
  weakItems: number;
  /** Items with retention < 0.05 (prune candidates) */
  criticalItems: number;
  /** Average retention across all items */
  avgRetention: number;
  /** Average composite value */
  avgValue: number;
}

// ---------------------------------------------------------------------------
// ForgettingCurve
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<ForgettingCurveConfig> = {
  stability: 10,
  pruneThreshold: 0.05,
  maxAgeDays: 90,
  spacingEffect: true,
  reinforcementBoost: 0.2,
  maxStability: 100,
};

export class ForgettingCurve {
  private readonly config: Required<ForgettingCurveConfig>;

  constructor(config?: ForgettingCurveConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Core decay computation
  // ---------------------------------------------------------------------------

  /**
   * Compute retention for a single item.
   *
   * R(t) = exp(-t / S) where:
   *   t = days since lastUpdate
   *   S = stability * (1 + reinforcementBoost * reinforcementCount)
   */
  computeRetention(item: DecayableItem): DecayResult {
    const now = Date.now();
    const lastUpdate = new Date(item.lastUpdated).getTime();
    const daysSinceUpdate = Math.max(0, (now - lastUpdate) / (1000 * 60 * 60 * 24));

    // Effective stability with spacing effect
    const reinforcements = item.reinforcementCount ?? 1;
    let effectiveStability = this.config.stability;
    if (this.config.spacingEffect && reinforcements > 1) {
      effectiveStability *= (1 + this.config.reinforcementBoost * (reinforcements - 1));
      effectiveStability = Math.min(effectiveStability, this.config.maxStability);
    }

    const retention = Math.exp(-daysSinceUpdate / effectiveStability);
    const value = retention * item.quality;
    const shouldPrune = retention < this.config.pruneThreshold
      || daysSinceUpdate > this.config.maxAgeDays;

    return { retention, daysSinceUpdate, effectiveStability, value, shouldPrune };
  }

  /**
   * Compute retention for a batch of items.
   * Returns results keyed by index.
   */
  computeRetentionBatch(items: DecayableItem[]): DecayResult[] {
    return items.map(item => this.computeRetention(item));
  }

  // ---------------------------------------------------------------------------
  // Decay scheduling
  // ---------------------------------------------------------------------------

  /**
   * Compute when an item will hit a given retention threshold.
   * Returns the date (as ISO string) when retention drops to the threshold.
   * Returns null if the item is already below threshold.
   */
  timeToThreshold(item: DecayableItem, threshold: number = 0.5): string | null {
    const current = this.computeRetention(item);
    if (current.retention <= threshold) return null;

    // Solve: threshold = exp(-t / S) → t = -S * ln(threshold)
    const daysToThreshold = -current.effectiveStability * Math.log(threshold);
    const targetDate = new Date(
      new Date(item.lastUpdated).getTime() + daysToThreshold * 24 * 60 * 60 * 1000
    );

    return targetDate.toISOString();
  }

  /**
   * Compute how many days until an item hits the prune threshold.
   */
  daysUntilPrune(item: DecayableItem): number {
    const reinforcements = item.reinforcementCount ?? 1;
    let effectiveStability = this.config.stability;
    if (this.config.spacingEffect && reinforcements > 1) {
      effectiveStability *= (1 + this.config.reinforcementBoost * (reinforcements - 1));
      effectiveStability = Math.min(effectiveStability, this.config.maxStability);
    }

    const days = -effectiveStability * Math.log(this.config.pruneThreshold);
    const daysSinceUpdate = (Date.now() - new Date(item.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, days - daysSinceUpdate);
  }

  // ---------------------------------------------------------------------------
  // Batch analysis
  // ---------------------------------------------------------------------------

  /**
   * Analyze a collection of items and return summary statistics.
   */
  summarize(items: DecayableItem[]): DecaySummary {
    if (items.length === 0) {
      return { totalItems: 0, strongItems: 0, weakItems: 0, criticalItems: 0, avgRetention: 0, avgValue: 0 };
    }

    const results = this.computeRetentionBatch(items);
    let strong = 0, weak = 0, critical = 0;
    let retentionSum = 0, valueSum = 0;

    for (const r of results) {
      retentionSum += r.retention;
      valueSum += r.value;
      if (r.retention >= 0.5) strong++;
      else if (r.retention >= this.config.pruneThreshold) weak++;
      else critical++;
    }

    return {
      totalItems: items.length,
      strongItems: strong,
      weakItems: weak,
      criticalItems: critical,
      avgRetention: retentionSum / items.length,
      avgValue: valueSum / items.length,
    };
  }

  /**
   * Rank items by composite value (retention * quality), descending.
   * Items with highest value are most worth keeping.
   */
  rankByValue(items: DecayableItem[]): Array<{ item: DecayableItem; result: DecayResult }> {
    return items
      .map(item => ({ item, result: this.computeRetention(item) }))
      .sort((a, b) => b.result.value - a.result.value);
  }

  /**
   * Identify items that should be pruned.
   * Returns items sorted by value ascending (worst first).
   */
  findPruneCandidates(items: DecayableItem[]): Array<{ item: DecayableItem; result: DecayResult }> {
    return this.rankByValue(items).filter(({ result }) => result.shouldPrune);
  }

  // ---------------------------------------------------------------------------
  // Reinforcement
  // ---------------------------------------------------------------------------

  /**
   * Compute the stability boost from reinforcement count.
   * More reinforcements → slower forgetting.
   */
  getEffectiveStability(reinforcementCount: number): number {
    let stability = this.config.stability;
    if (this.config.spacingEffect && reinforcementCount > 1) {
      stability *= (1 + this.config.reinforcementBoost * (reinforcementCount - 1));
      stability = Math.min(stability, this.config.maxStability);
    }
    return stability;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /** Get current config. */
  getConfig(): Required<ForgettingCurveConfig> {
    return { ...this.config };
  }

  /**
   * Static helper: compute retention for a raw timestamp gap.
   * Useful for one-off calculations without instantiating the class.
   */
  static retention(daysSinceUpdate: number, stability: number = 10): number {
    return Math.exp(-daysSinceUpdate / stability);
  }

  /**
   * Static helper: compute days until retention hits a threshold.
   */
  static daysToThreshold(stability: number, threshold: number = 0.5): number {
    return -stability * Math.log(threshold);
  }
}
