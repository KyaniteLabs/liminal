import { describe, it, expect } from 'vitest';
import { isHonestFitnessScore } from '../../../src/core/fitnessHonesty.js';

describe('isHonestFitnessScore', () => {
  it('accepts a clean evaluator score (none, positive confidence)', () => {
    expect(isHonestFitnessScore(1, 'none')).toBe(true);
  });

  it('accepts a render-measured score (deterministic luminance is a real signal)', () => {
    expect(isHonestFitnessScore(0.8, 'render')).toBe(true);
  });

  it('rejects a scorer-failure fallback even with a high nominal score', () => {
    expect(isHonestFitnessScore(0, 'scorer')).toBe(false);
  });

  it('rejects an infra-failure fallback', () => {
    expect(isHonestFitnessScore(0, 'infra')).toBe(false);
  });

  it('rejects a validator failure (broken artifact must not be an exemplar)', () => {
    expect(isHonestFitnessScore(1, 'validator')).toBe(false);
  });

  it('rejects any class when confidence is zero', () => {
    expect(isHonestFitnessScore(0, 'none')).toBe(false);
    expect(isHonestFitnessScore(0, 'render')).toBe(false);
  });

  it('defaults undefined confidence/failureClass to honest (legacy clean-eval path)', () => {
    expect(isHonestFitnessScore(undefined, undefined)).toBe(true);
  });

  it('treats undefined confidence as confident but still rejects a degraded class', () => {
    expect(isHonestFitnessScore(undefined, 'scorer')).toBe(false);
  });
});
