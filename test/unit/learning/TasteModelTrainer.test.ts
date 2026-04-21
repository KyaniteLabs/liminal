/**
 * Unit tests for TasteModelTrainer — Phase 15
 *
 * Tests margin-based SGD training over descriptor dimensions.
 */

import { describe, it, expect } from 'vitest';
import { TasteModelTrainer } from '../../../src/learning/TasteModelTrainer.js';
import type { PreferencePair } from '../../../src/learning/PreferenceDatasetBuilder.js';

function makePair(
  winnerDesc: number[], winnerQuality: number,
  loserDesc: number[], loserQuality: number,
  confidence: number = 0.9,
): PreferencePair {
  return {
    winner: { id: 'winner', descriptor: winnerDesc, quality: winnerQuality },
    loser: { id: 'loser', descriptor: loserDesc, quality: loserQuality },
    source: 'pairwise-a',
    confidence,
    capturedAt: new Date().toISOString(),
  };
}

describe('TasteModelTrainer', () => {
  it('returns empty weights for zero pairs', () => {
    const trainer = new TasteModelTrainer();
    const weights = trainer.train([]);
    expect(weights.axisWeights).toEqual([]);
    expect(weights.qualityWeight).toBe(0.5);
    expect(weights.pairCount).toBe(0);
    expect(weights.trainingAgreement).toBe(0);
  });

  it('learns axis weights from training pairs', () => {
    const trainer = new TasteModelTrainer({ epochs: 200, learningRate: 0.3, regularization: 0.001 });
    // Equal quality forces model to learn from descriptors alone
    const pairs = Array.from({ length: 20 }, () =>
      makePair([0.9, 0.1], 0.5, [0.1, 0.9], 0.5),
    );
    const weights = trainer.train(pairs);
    expect(weights.axisWeights).toHaveLength(2);
    // First axis weight should exceed second (winner always high on dim 0)
    expect(weights.axisWeights[0]).toBeGreaterThan(weights.axisWeights[1]);
  });

  it('predict produces consistent scores', () => {
    const trainer = new TasteModelTrainer();
    const axisWeights = [0.6, 0.4];
    const qualityWeight = 0.3;
    const artifact = { descriptor: [0.8, 0.2], quality: 0.7 };
    const score = trainer.predict(axisWeights, qualityWeight, artifact);
    const expected = (0.6 * 0.8 + 0.4 * 0.2) * (1 - 0.3) + 0.7 * 0.3;
    expect(score).toBeCloseTo(expected, 5);
  });

  it('predict shows winner > loser after training', () => {
    const trainer = new TasteModelTrainer({ epochs: 100 });
    const pairs = Array.from({ length: 20 }, () =>
      makePair([0.9, 0.1], 0.9, [0.1, 0.9], 0.1),
    );
    const weights = trainer.train(pairs);
    const predW = trainer.predict(weights.axisWeights, weights.qualityWeight, pairs[0].winner);
    const predL = trainer.predict(weights.axisWeights, weights.qualityWeight, pairs[0].loser);
    expect(predW).toBeGreaterThan(predL);
  });

  it('trainingAgreement reflects correct predictions on training data', () => {
    const trainer = new TasteModelTrainer({ epochs: 100 });
    const pairs = Array.from({ length: 20 }, () =>
      makePair([0.9, 0.1], 0.9, [0.1, 0.9], 0.1),
    );
    const weights = trainer.train(pairs);
    expect(weights.trainingAgreement).toBeGreaterThan(0.5);
  });

  it('applies regularization to prevent overfitting', () => {
    const trainer = new TasteModelTrainer({ epochs: 50, regularization: 0.1 });
    const pairs = Array.from({ length: 10 }, () =>
      makePair([0.8, 0.2], 0.7, [0.2, 0.8], 0.4),
    );
    const weights = trainer.train(pairs);
    // With strong regularization, weights should stay moderate
    for (const w of weights.axisWeights) {
      expect(w).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it('zero-confidence pairs have minimal impact', () => {
    const trainer = new TasteModelTrainer({ epochs: 50 });
    const pairs = Array.from({ length: 10 }, () =>
      makePair([0.9, 0.1], 0.9, [0.1, 0.9], 0.1, 0.0),
    );
    const weights = trainer.train(pairs);
    // With zero confidence, weights should remain near uniform
    expect(weights.axisWeights[0]).toBeCloseTo(weights.axisWeights[1], 1);
  });
});
