/**
 * ReplayBiasPolicy — Phase 15
 *
 * Biases archive replay and candidate selection using the taste model.
 * When a taste model is loaded, high-scoring artifacts get priority
 * for replay, branching, and recombination.
 */

import type { ArchiveEntry } from '../emergence/types.js';
import type { TasteModelWeights } from './TasteModelTrainer.js';
import { TasteModelRuntime } from './TasteModelRuntime.js';

export interface ReplayBiasConfig {
  /** How strongly to bias toward taste (0 = no bias, 1 = full taste rank) */
  biasStrength?: number;
  /** Minimum taste score for priority replay (default: 0.5) */
  minTasteScore?: number;
}

const DEFAULT_BIAS_STRENGTH = 0.7;
const DEFAULT_MIN_TASTE = 0.5;

export class ReplayBiasPolicy {
  private readonly runtime: TasteModelRuntime;
  private readonly biasStrength: number;
  private readonly minTasteScore: number;

  constructor(config: ReplayBiasConfig = {}) {
    this.runtime = new TasteModelRuntime();
    this.biasStrength = config.biasStrength ?? DEFAULT_BIAS_STRENGTH;
    this.minTasteScore = config.minTasteScore ?? DEFAULT_MIN_TASTE;
  }

  loadModel(weights: TasteModelWeights): void {
    this.runtime.load(weights);
  }

  isModelLoaded(): boolean {
    return this.runtime.isLoaded();
  }

  /**
   * Select candidates for replay, biased by taste model.
   * Returns entries sorted by blended taste+fertility score.
   */
  selectForReplay(entries: ArchiveEntry[], count: number): ArchiveEntry[] {
    if (!this.runtime.isLoaded()) {
      // No model loaded — fall back to fertility + quality
      return entries
        .sort((a, b) => (b.signals.fertility + b.qualityScore) - (a.signals.fertility + a.qualityScore))
        .slice(0, count);
    }

    return entries
      .map(entry => ({
        entry,
        blendedScore: this.blendedScore(entry),
      }))
      .sort((a, b) => b.blendedScore - a.blendedScore)
      .filter(x => x.blendedScore >= this.minTasteScore)
      .slice(0, count)
      .map(x => x.entry);
  }

  /**
   * Compute a blended score combining taste preference with emergence signals.
   */
  blendedScore(entry: ArchiveEntry): number {
    const tasteScore = this.runtime.score(entry);
    const emergenceScore = (entry.signals.fertility * 0.4) + (entry.signals.novelty * 0.3) + (entry.qualityScore * 0.3);

    return (tasteScore * this.biasStrength) + (emergenceScore * (1 - this.biasStrength));
  }

  /**
   * Check if an artifact meets the taste threshold for priority handling.
   */
  isTasteAligned(entry: ArchiveEntry): boolean {
    if (!this.runtime.isLoaded()) return true; // No model = no filtering
    return this.runtime.score(entry) >= this.minTasteScore;
  }
}
