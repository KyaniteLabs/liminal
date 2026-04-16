/**
 * TasteModelRuntime — Phase 15
 *
 * Runtime for applying a trained taste model to rank candidates.
 * Provides pairwise comparison, ranking, and scoring.
 */

import type { ArchiveEntry } from '../emergence/types.js';
import type { TasteModelWeights } from './TasteModelTrainer.js';

export interface RankedCandidate {
  entry: ArchiveEntry;
  tasteScore: number;
  rank: number;
}

export class TasteModelRuntime {
  private weights: TasteModelWeights | null = null;

  load(weights: TasteModelWeights): void {
    this.weights = weights;
  }

  isLoaded(): boolean {
    return this.weights !== null && this.weights.axisWeights.length > 0;
  }

  /**
   * Score a single artifact using the loaded taste model.
   */
  score(entry: ArchiveEntry): number {
    if (!this.weights) return entry.qualityScore;

    const descValues = entry.descriptor.values.map(v => v.value);
    const descScore = this.weights.axisWeights.reduce(
      (sum, w, i) => sum + w * (descValues[i] ?? 0), 0,
    );
    const qw = this.weights.qualityWeight;
    return (descScore * (1 - qw)) + (entry.qualityScore * qw);
  }

  /**
   * Rank candidates by taste score (descending).
   */
  rank(entries: ArchiveEntry[]): RankedCandidate[] {
    const scored = entries.map(entry => ({
      entry,
      tasteScore: this.score(entry),
      rank: 0,
    }));

    scored.sort((a, b) => b.tasteScore - a.tasteScore);
    for (let i = 0; i < scored.length; i++) {
      scored[i].rank = i + 1;
    }
    return scored;
  }

  /**
   * Compare two artifacts pairwise. Returns positive if a preferred, negative if b.
   */
  compare(a: ArchiveEntry, b: ArchiveEntry): number {
    return this.score(a) - this.score(b);
  }

  /**
   * Pre-rank candidates for archive replay bias.
   * Returns top-N candidates sorted by taste score.
   */
  topN(entries: ArchiveEntry[], n: number): RankedCandidate[] {
    return this.rank(entries).slice(0, n);
  }

  getWeights(): TasteModelWeights | null {
    return this.weights;
  }
}
