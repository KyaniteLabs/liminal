import { describe, it, expect } from 'vitest';
import { TIERS, classifyTier, getNextTierGoal } from '../../src/evolution/ProgressiveDesignTiers.js';

describe('ProgressiveDesignTiers', () => {
  it('exports five tiers with increasing levels', () => {
    expect(TIERS).toHaveLength(5);
    expect(TIERS[0].name).toBe('glitch');
    expect(TIERS[4].name).toBe('perfect');
  });

  it('classifies score 0 as glitch tier', () => {
    expect(classifyTier(0).name).toBe('glitch');
  });

  it('classifies score 0.5 as functional tier', () => {
    expect(classifyTier(0.5).name).toBe('functional');
  });

  it('classifies score 0.95 as perfect tier', () => {
    expect(classifyTier(0.95).name).toBe('perfect');
  });

  it('returns null for next tier beyond max', () => {
    expect(getNextTierGoal(4)).toBeNull();
  });

  it('returns the next tier for valid levels', () => {
    const next = getNextTierGoal(0);
    expect(next).not.toBeNull();
    expect(next!.level).toBe(1);
  });
});
