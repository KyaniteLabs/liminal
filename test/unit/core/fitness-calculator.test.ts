/**
 * Tests for FitnessCalculator.
 */
import { FitnessCalculator } from '../../../src/core/FitnessCalculator.js';

describe('FitnessCalculator', () => {
  it('computes weighted average of dimension scores', () => {
    const calc = new FitnessCalculator();
    const result = calc.calculate({ technical: 0.8, aesthetic: 0.6 });
    // Equal weights: (0.8 + 0.6) / 2 = 0.7
    expect(result).toBeCloseTo(0.7, 6);
  });

  it('respects custom weights', () => {
    const calc = new FitnessCalculator({ technical: 2, aesthetic: 1 });
    // Weighted: (0.8*2 + 0.6*1) / (2+1) = 2.2/3 ≈ 0.733
    const result = calc.calculate({ technical: 0.8, aesthetic: 0.6 });
    expect(result).toBeCloseTo(0.7333, 3);
  });

  it('handles novelty dimension', () => {
    const calc = new FitnessCalculator({ novelty: 1 });
    const result = calc.calculate({ technical: 0.5, novelty: 0.9 });
    // (0.5 + 0.9) / 2 = 0.7
    expect(result).toBeCloseTo(0.7, 6);
  });

  it('returns 0 for empty scores', () => {
    const calc = new FitnessCalculator();
    expect(calc.calculate({})).toBe(0);
  });

  it('ignores undefined values', () => {
    const calc = new FitnessCalculator();
    const result = calc.calculate({ technical: 0.8, aesthetic: undefined as any });
    expect(result).toBeCloseTo(0.8, 6);
  });

  it('uses default weight for unknown dimensions', () => {
    const calc = new FitnessCalculator({ default: 0.5 });
    const result = calc.calculate({ technical: 0.8, custom: 0.6 });
    // (0.8*1 + 0.6*0.5) / (1+0.5) = 1.1/1.5 ≈ 0.733
    expect(result).toBeCloseTo(0.7333, 3);
  });

  it('getWeights returns current weights', () => {
    const calc = new FitnessCalculator({ technical: 3 });
    const weights = calc.getWeights();
    expect(weights.technical).toBe(3);
    expect(weights.aesthetic).toBe(1);
  });

  it('setWeights updates weights', () => {
    const calc = new FitnessCalculator();
    calc.setWeights({ technical: 0.5 });
    const result = calc.calculate({ technical: 0.8, aesthetic: 0.6 });
    // (0.8*0.5 + 0.6*1) / (0.5+1) = 1.0/1.5 ≈ 0.667
    expect(result).toBeCloseTo(0.6667, 3);
  });

  it('legacy() matches hardcoded 60/40 ratio', () => {
    expect(FitnessCalculator.legacy(1, 0)).toBeCloseTo(0.6, 6);
    expect(FitnessCalculator.legacy(0, 1)).toBeCloseTo(0.4, 6);
    expect(FitnessCalculator.legacy(0.5, 0.5)).toBeCloseTo(0.5, 6);
  });
});
