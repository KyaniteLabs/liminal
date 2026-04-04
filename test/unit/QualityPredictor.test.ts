import { describe, it, expect } from 'vitest';
import { QualityPredictor, type RoutingFeatures } from '../../src/routing/QualityPredictor.js';

describe('QualityPredictor', () => {
  it('predicts quality and recommends a model', () => {
    const qp = new QualityPredictor();
    const features: RoutingFeatures = {
      promptLength: 200, codeComplexity: 'simple', domain: 'code',
      previousScore: null, modelTier: 'local',
    };
    const pred = qp.predictQuality(features);
    expect(pred.predictedScore).toBeGreaterThanOrEqual(0);
    expect(pred.predictedScore).toBeLessThanOrEqual(1);
    expect(pred.recommendedModel).toBeTruthy();
    expect(pred.reasoning).toBeTruthy();
  });

  it('records outcomes and adjusts rankings', () => {
    const qp = new QualityPredictor();
    qp.recordOutcome('local', 'code', 0.9);
    qp.recordOutcome('cloud', 'code', 0.7);
    const ranking = qp.getModelRanking('code');
    expect(ranking).toHaveLength(2);
    expect(ranking[0].model).toBe('local');
  });

  it('getRecommendedModel returns string', () => {
    const qp = new QualityPredictor();
    const model = qp.getRecommendedModel({
      promptLength: 500, codeComplexity: 'complex', domain: 'visual',
      previousScore: null, modelTier: 'cloud',
    });
    expect(typeof model).toBe('string');
  });
});
