/**
 * TasteModelTrainer — Phase 15
 *
 * Trains a local taste model from preference pairs.
 * Uses a simple weighted distance model (no ML framework dependency).
 *
 * The model learns a weight vector over descriptor axes that
 * maximizes agreement with observed preferences. This is essentially
 * learning which descriptor dimensions matter most to the user.
 */

import type { PreferencePair } from './PreferenceDatasetBuilder.js';

export interface TasteModelWeights {
  /** Per-axis weights (aligned with descriptor values order) */
  axisWeights: number[];
  /** Quality weight (how much quality score matters vs descriptor) */
  qualityWeight: number;
  /** Training metadata */
  trainedAt: string;
  /** Number of training pairs */
  pairCount: number;
  /** Agreement rate on training data */
  trainingAgreement: number;
}

export interface TasteModelTrainerConfig {
  /** Learning rate (default: 0.1) */
  learningRate?: number;
  /** Number of training epochs (default: 50) */
  epochs?: number;
  /** Regularization to prevent overfitting (default: 0.01) */
  regularization?: number;
}

const DEFAULT_LR = 0.1;
const DEFAULT_EPOCHS = 50;
const DEFAULT_REG = 0.01;

export class TasteModelTrainer {
  private readonly lr: number;
  private readonly epochs: number;
  private readonly reg: number;

  constructor(config: TasteModelTrainerConfig = {}) {
    this.lr = config.learningRate ?? DEFAULT_LR;
    this.epochs = config.epochs ?? DEFAULT_EPOCHS;
    this.reg = config.regularization ?? DEFAULT_REG;
  }

  /**
   * Train a taste model from preference pairs.
   * Returns learned weights over descriptor dimensions.
   */
  train(pairs: PreferencePair[]): TasteModelWeights {
    if (pairs.length === 0) {
      return {
        axisWeights: [],
        qualityWeight: 0.5,
        trainedAt: new Date().toISOString(),
        pairCount: 0,
        trainingAgreement: 0,
      };
    }

    const dimCount = pairs[0].winner.descriptor.length;
    const axisWeights = new Array(dimCount).fill(1 / dimCount);
    let qualityWeight = 0.5;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      // Shuffle pairs each epoch
      const shuffled = [...pairs].sort(() => Math.random() - 0.5);

      for (const pair of shuffled) {
        const predW = this.predict(axisWeights, qualityWeight, pair.winner);
        const predL = this.predict(axisWeights, qualityWeight, pair.loser);

        // Margin-based loss: we want predW > predL
        const margin = predW - predL;
        if (margin > 0.1) continue; // Already correct with margin

        // Gradient update: push weights toward preferring winner's dimensions
        const grad = Math.min(1, (0.1 - margin)) * pair.confidence;
        for (let i = 0; i < dimCount; i++) {
          const diff = pair.winner.descriptor[i] - pair.loser.descriptor[i];
          axisWeights[i] += this.lr * grad * diff;
          // L2 regularization
          axisWeights[i] -= this.reg * axisWeights[i];
        }

        // Quality weight gradient
        const qDiff = pair.winner.quality - pair.loser.quality;
        qualityWeight += this.lr * grad * qDiff;
        qualityWeight -= this.reg * (qualityWeight - 0.5);
      }

      // Normalize weights to sum to 1 (keep quality separate)
      const sum = axisWeights.reduce((a, b) => a + Math.abs(b), 0);
      if (sum > 0) {
        for (let i = 0; i < dimCount; i++) axisWeights[i] /= sum;
      }
      qualityWeight = Math.max(0, Math.min(1, qualityWeight));
    }

    const agreement = this.computeAgreement(axisWeights, qualityWeight, pairs);

    return {
      axisWeights,
      qualityWeight,
      trainedAt: new Date().toISOString(),
      pairCount: pairs.length,
      trainingAgreement: agreement,
    };
  }

  predict(
    axisWeights: number[],
    qualityWeight: number,
    artifact: { descriptor: number[]; quality: number },
  ): number {
    const descScore = axisWeights.reduce(
      (sum, w, i) => sum + w * (artifact.descriptor[i] ?? 0), 0,
    );
    return (descScore * (1 - qualityWeight)) + (artifact.quality * qualityWeight);
  }

  private computeAgreement(
    axisWeights: number[],
    qualityWeight: number,
    pairs: PreferencePair[],
  ): number {
    let correct = 0;
    for (const pair of pairs) {
      const predW = this.predict(axisWeights, qualityWeight, pair.winner);
      const predL = this.predict(axisWeights, qualityWeight, pair.loser);
      if (predW >= predL) correct++;
    }
    return pairs.length > 0 ? correct / pairs.length : 0;
  }
}
