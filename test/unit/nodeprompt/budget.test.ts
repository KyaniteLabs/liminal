import { describe, it, expect } from 'vitest';
import {
  computeBranchingFactor,
  allocateBudget,
  allocateLevelBudget,
} from '../../../src/nodeprompt/types/extraction.js';

// ── computeBranchingFactor ──

describe('computeBranchingFactor', () => {
  it('respects Miller\'s Law cap of 7', () => {
    // Even with very large N and small D, result must be <= 7
    const result = computeBranchingFactor(1000, 1);
    expect(result).toBe(7);
  });

  it('returns N when D equals N (single-child chain)', () => {
    // N^(1/N) for small N with D=N should ceil to small numbers
    const result = computeBranchingFactor(5, 5);
    expect(result).toBe(Math.min(7, Math.ceil(Math.pow(5, 1 / 5))));
    expect(result).toBe(2); // 5^(0.2) ~ 1.38, ceil = 2
  });

  it('returns correct value for D=1, N=5', () => {
    // 5^(1/1) = 5, min(7, 5) = 5
    expect(computeBranchingFactor(5, 1)).toBe(5);
  });

  it('returns correct value for D=2, N=15', () => {
    // 15^(1/2) ~ 3.87, ceil = 4
    expect(computeBranchingFactor(15, 2)).toBe(4);
  });

  it('returns correct value for D=3, N=15', () => {
    // 15^(1/3) ~ 2.47, ceil = 3
    expect(computeBranchingFactor(15, 3)).toBe(3);
  });

  it('returns 1 for N=1 regardless of D', () => {
    expect(computeBranchingFactor(1, 1)).toBe(1);
    expect(computeBranchingFactor(1, 3)).toBe(1);
  });

  it('returns 7 for large N with small D', () => {
    expect(computeBranchingFactor(50, 1)).toBe(7);
    expect(computeBranchingFactor(100, 2)).toBe(7); // 100^0.5 = 10, min(7,10) = 7
  });

  it('handles N=7, D=1 at the boundary', () => {
    expect(computeBranchingFactor(7, 1)).toBe(7);
  });

  it('handles N=8, D=1 exceeding the cap', () => {
    expect(computeBranchingFactor(8, 1)).toBe(7); // min(7, ceil(8)) = 7
  });
});

// ── allocateBudget ──

describe('allocateBudget', () => {
  it('allocates all nodes to pass1 when D=1', () => {
    const result = allocateBudget(15, 1);
    expect(result.pass1).toBe(15);
    expect(result.pass2).toBe(0);
    expect(result.pass3).toBe(0);
  });

  it('splits 35%/65% for D=2', () => {
    const result = allocateBudget(20, 2);
    // pass1 = max(2, min(branching+1, ceil(N*0.35)))
    // branching = min(7, ceil(20^0.5)) = min(7,5) = 5
    // pass1 = max(2, min(6, ceil(7))) = max(2, min(6,7)) = 6
    expect(result.pass1).toBe(6);
    expect(result.pass2).toBe(14); // N - pass1
    expect(result.pass3).toBe(0);
    expect(result.pass1 + result.pass2).toBe(20);
  });

  it('splits 25%/40%/35% for D=3', () => {
    const result = allocateBudget(15, 3);
    // branching = min(7, ceil(15^(1/3))) = min(7, 3) = 3
    // pass1 = max(2, min(5, ceil(3.75))) = max(2, min(5, 4)) = 4
    // pass2 = ceil(15*0.40) = 6
    // pass3 = max(0, 15 - 4 - 6) = 5
    expect(result.pass1).toBe(4);
    expect(result.pass2).toBe(6);
    expect(result.pass3).toBe(5);
    expect(result.pass1 + result.pass2 + result.pass3).toBe(15);
  });

  it('splits 25%/40%/35% for D=5', () => {
    const result = allocateBudget(30, 5);
    // D>=3 uses same formula
    expect(result.pass1 + result.pass2 + result.pass3).toBe(30);
    expect(result.pass1).toBeGreaterThan(0);
    expect(result.pass2).toBeGreaterThan(0);
    expect(result.pass3).toBeGreaterThanOrEqual(0);
  });

  it('ensures pass1 is at least 2 for D=2', () => {
    const result = allocateBudget(3, 2);
    expect(result.pass1).toBeGreaterThanOrEqual(2);
    expect(result.pass1 + result.pass2).toBe(3);
  });

  it('ensures pass1 is at least 2 for D=3', () => {
    const result = allocateBudget(5, 3);
    expect(result.pass1).toBeGreaterThanOrEqual(2);
    expect(result.pass1 + result.pass2 + result.pass3).toBe(5);
  });

  it('handles minimum viable budget N=2, D=2', () => {
    const result = allocateBudget(2, 2);
    expect(result.pass1).toBeGreaterThanOrEqual(2);
    expect(result.pass1 + result.pass2).toBe(2);
  });
});

// ── allocateLevelBudget ──

describe('allocateLevelBudget', () => {
  it('returns single level for D=1', () => {
    const levels = allocateLevelBudget(15, 1);
    expect(levels).toEqual([15]);
  });

  it('returns D levels for any D', () => {
    const levels3 = allocateLevelBudget(15, 3);
    expect(levels3).toHaveLength(3);

    const levels5 = allocateLevelBudget(25, 5);
    expect(levels5).toHaveLength(5);
  });

  it('sum equals N exactly for D=3', () => {
    const levels = allocateLevelBudget(20, 3);
    const sum = levels.reduce((a, b) => a + b, 0);
    expect(sum).toBe(20);
  });

  it('sum equals N exactly for D=5', () => {
    const levels = allocateLevelBudget(30, 5);
    const sum = levels.reduce((a, b) => a + b, 0);
    expect(sum).toBe(30);
  });

  it('caps L0 at branching factor + 1', () => {
    const levels = allocateLevelBudget(50, 3);
    const branching = computeBranchingFactor(50, 3);
    expect(levels[0]).toBeLessThanOrEqual(branching + 1);
  });

  it('ensures L0 is at least 2', () => {
    const levels = allocateLevelBudget(5, 3);
    expect(levels[0]).toBeGreaterThanOrEqual(2);
  });

  it('deeper levels get more nodes for D>=3', () => {
    // The weighting scheme: weights[i] = max(1, D - i), so level 1 gets D-1,
    // level 2 gets D-2, etc. For D=5: weights = [4, 3, 2, 1]
    const levels = allocateLevelBudget(30, 5);
    // Level 1 should have the most (highest weight after L0)
    expect(levels[1]).toBeGreaterThanOrEqual(levels[4]!);
  });

  it('handles D=2 correctly', () => {
    const levels = allocateLevelBudget(10, 2);
    expect(levels).toHaveLength(2);
    expect(levels[0] + levels[1]).toBe(10);
    expect(levels[0]).toBeGreaterThanOrEqual(2);
  });

  it('no level has zero nodes', () => {
    const levels = allocateLevelBudget(20, 4);
    for (const count of levels) {
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });
});
