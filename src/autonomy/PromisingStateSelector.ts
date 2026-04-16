/**
 * PromisingStateSelector — Phase 13E
 *
 * Selects promising archive entries for replay or branching.
 * Uses emergence signals, user preferences, and niche occupancy
 * to identify which states are worth revisiting.
 */

import type {
  ArchiveEntry,
  PromisingState,
} from '../emergence/types.js';
import { Logger } from '../utils/Logger.js';

export interface PromisingStateSelectorConfig {
  /** Weight for fertility in scoring (default: 0.3) */
  fertilityWeight?: number;
  /** Weight for user preference signals (default: 0.3) */
  preferenceWeight?: number;
  /** Weight for niche exploration value (default: 0.2) */
  nicheWeight?: number;
  /** Weight for stagnation recovery (default: 0.2) */
  stagnationWeight?: number;
}

export class PromisingStateSelector {
  private readonly weights: {
    fertility: number;
    preference: number;
    niche: number;
    stagnation: number;
  };

  /** Track how many times each artifact has been selected for replay. */
  private replayCount: Map<string, number> = new Map();

  constructor(config: PromisingStateSelectorConfig = {}) {
    this.weights = {
      fertility: config.fertilityWeight ?? 0.3,
      preference: config.preferenceWeight ?? 0.3,
      niche: config.nicheWeight ?? 0.2,
      stagnation: config.stagnationWeight ?? 0.2,
    };
  }

  /**
   * Select the most promising states from the archive for replay/branching.
   * Returns up to `maxResults` states sorted by promise score.
   */
  select(
    elites: ArchiveEntry[],
    preferenceCounts: Map<string, { positive: number; negative: number }>,
    maxResults = 5,
  ): PromisingState[] {
    const candidates: PromisingState[] = elites
      .map(entry => this.scoreEntry(entry, preferenceCounts))
      .filter((p): p is PromisingState => p.promiseScore > 0.2);

    // Sort by promise score (descending)
    candidates.sort((a, b) => b.promiseScore - a.promiseScore);

    // Penalize heavily-replayed entries
    for (const candidate of candidates) {
      const count = this.replayCount.get(candidate.entry.id) ?? 0;
      candidate.promiseScore *= Math.max(0.1, 1 - count * 0.2);
    }

    // Re-sort after penalty
    candidates.sort((a, b) => b.promiseScore - a.promiseScore);

    const selected = candidates.slice(0, maxResults);

    // Record selection
    for (const s of selected) {
      this.replayCount.set(s.entry.id, (this.replayCount.get(s.entry.id) ?? 0) + 1);
    }

    Logger.info('PromisingStateSelector', `Selected ${selected.length} promising states (top: ${selected[0]?.entry.id ?? 'none'}, score: ${selected[0]?.promiseScore.toFixed(2) ?? 'N/A'})`);
    return selected;
  }

  /**
   * Score a single archive entry for promise.
   */
  private scoreEntry(
    entry: ArchiveEntry,
    preferenceCounts: Map<string, { positive: number; negative: number }>,
  ): PromisingState {
    const signals = entry.signals;
    const prefs = preferenceCounts.get(entry.id) ?? { positive: 0, negative: 0 };

    // Fertility score: high fertility = good for branching
    const fertilityScore = signals.fertility;

    // Preference score: user-liked artifacts are more promising
    const totalPref = prefs.positive + prefs.negative;
    const prefScore = totalPref > 0
      ? prefs.positive / totalPref
      : 0.5; // Neutral if no preferences

    // Niche score: artifacts in sparse regions are more valuable to explore
    const nicheScore = signals.novelty;

    // Stagnation score: lineage depth matters — deeper lineages that are
    // still fertile are interesting, shallow ones are fine too
    const parentCount = entry.lineage.parentIds.length;
    const stagnationScore = parentCount === 0
      ? 0.6 // Fresh root — moderate interest
      : signals.fertility > 0.5 ? 0.8 : 0.3;

    // Weighted combination
    const promiseScore =
      (fertilityScore * this.weights.fertility) +
      (prefScore * this.weights.preference) +
      (nicheScore * this.weights.niche) +
      (stagnationScore * this.weights.stagnation);

    // Determine primary reason
    const reason = this.determineReason(
      fertilityScore,
      prefScore,
      nicheScore,
      stagnationScore,
      prefs,
    );

    return {
      entry,
      reason,
      promiseScore: Math.min(1, promiseScore),
    };
  }

  private determineReason(
    fertility: number,
    _pref: number,
    niche: number,
    _stagnation: number,
    prefs: { positive: number; negative: number },
  ): PromisingState['reason'] {
    if (prefs.positive > 0) return 'user-pinned';
    if (fertility > 0.7) return 'high-fertility';
    if (niche > 0.7) return 'unexplored-niche';
    return 'stagnant-lineage';
  }

  /**
   * Get replay statistics.
   */
  getStats(): { totalReplays: number; mostReplayed: string | null; maxReplays: number } {
    let maxReplays = 0;
    let mostReplayed: string | null = null;

    for (const [id, count] of this.replayCount) {
      if (count > maxReplays) {
        maxReplays = count;
        mostReplayed = id;
      }
    }

    return {
      totalReplays: Array.from(this.replayCount.values()).reduce((a, b) => a + b, 0),
      mostReplayed,
      maxReplays,
    };
  }
}
