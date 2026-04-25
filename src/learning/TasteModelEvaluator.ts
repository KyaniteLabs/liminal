/**
 * TasteModelEvaluator — Phase 15
 *
 * Evaluates taste model quality using held-out preference pairs.
 * Measures ranking correlation, agreement rate, and calibration.
 */

import type { PreferencePair } from './PreferenceDatasetBuilder.js';
import type { TasteModelWeights } from './TasteModelTrainer.js';
import { TasteModelRuntime } from './TasteModelRuntime.js';

export interface TasteEvaluationResult {
  /** Fraction of held-out pairs correctly predicted */
  agreement: number;
  /** Kendall tau rank correlation between predicted and actual preferences */
  kendallTau: number;
  /** How many high-confidence predictions were correct */
  calibration: number;
  /** Number of evaluation pairs */
  pairCount: number;
  /** Whether the model is better than baseline (quality-only ranking) */
  beatsBaseline: boolean;
}

export interface TasteModelEvaluatorConfig {
  /** Fraction of data to hold out for evaluation (default: 0.2) */
  holdoutFraction?: number;
}

const DEFAULT_HOLDOUT = 0.2;

export class TasteModelEvaluator {
  private readonly holdoutFraction: number;

  constructor(config: TasteModelEvaluatorConfig = {}) {
    this.holdoutFraction = config.holdoutFraction ?? DEFAULT_HOLDOUT;
  }

  /**
   * Split pairs into train/test, evaluate model on test set.
   */
  evaluate(
    pairs: PreferencePair[],
    weights: TasteModelWeights,
  ): TasteEvaluationResult {
    if (pairs.length < 4) {
      return { agreement: 0, kendallTau: 0, calibration: 0, pairCount: 0, beatsBaseline: false };
    }

    // Deterministic split: use pair index
    const testPairs = pairs.filter((_, i) => i % Math.round(1 / this.holdoutFraction) === 0);

    if (testPairs.length === 0) {
      return { agreement: 0, kendallTau: 0, calibration: 0, pairCount: 0, beatsBaseline: false };
    }

    const runtime = new TasteModelRuntime();
    runtime.load(weights);

    // Agreement: fraction of pairs where model prefers the winner
    let modelCorrect = 0;
    let baselineCorrect = 0;
    let highConfCorrect = 0;
    let highConfTotal = 0;
    let concordant = 0;
    let discordant = 0;

    for (const pair of testPairs) {
      const predW = runtime.score({
        descriptor: { values: pair.winner.descriptor.map((v) => ({ axis: 'order-chaos' as const, value: v })), source: 'eval', extractedAt: '' },
        qualityScore: pair.winner.quality,
      });
      const predL = runtime.score({
        descriptor: { values: pair.loser.descriptor.map((v) => ({ axis: 'order-chaos' as const, value: v })), source: 'eval', extractedAt: '' },
        qualityScore: pair.loser.quality,
      });

      if (predW >= predL) modelCorrect++;

      // Baseline: quality-only prediction
      if (pair.winner.quality >= pair.loser.quality) baselineCorrect++;

      // High-confidence check
      const margin = Math.abs(predW - predL);
      if (margin > 0.1) {
        highConfTotal++;
        if (predW >= predL) highConfCorrect++;
      }

      // Concordance for Kendall tau
      const actualDir = 1; // winner > loser by definition
      const predDir = predW >= predL ? 1 : -1;
      if (actualDir * predDir > 0) concordant++;
      else discordant++;
    }

    const agreement = modelCorrect / testPairs.length;
    const baselineAgreement = baselineCorrect / testPairs.length;
    const calibration = highConfTotal > 0 ? highConfCorrect / highConfTotal : 0;
    const tau = (concordant - discordant) / (concordant + discordant);

    return {
      agreement,
      kendallTau: tau,
      calibration,
      pairCount: testPairs.length,
      beatsBaseline: agreement > baselineAgreement,
    };
  }

  /**
   * Get the holdout split for external training.
   */
  split(pairs: PreferencePair[]): { train: PreferencePair[]; test: PreferencePair[] } {
    const test: PreferencePair[] = [];
    const train: PreferencePair[] = [];
    const step = Math.round(1 / this.holdoutFraction);

    for (let i = 0; i < pairs.length; i++) {
      if (i % step === 0) test.push(pairs[i]);
      else train.push(pairs[i]);
    }

    return { train, test };
  }
}
