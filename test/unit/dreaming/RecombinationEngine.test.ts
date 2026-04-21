/**
 * Unit tests for RecombinationEngine — Phase 15
 *
 * Tests 4 recombination strategies: interpolate, extrapolate, crossover, mutation.
 */

import { describe, it, expect } from 'vitest';
import { RecombinationEngine } from '../../../src/dreaming/RecombinationEngine.js';

describe('RecombinationEngine', () => {
  const parentA = { id: 'a', descriptor: [0.2, 0.4, 0.6, 0.8] };
  const parentB = { id: 'b', descriptor: [0.8, 0.6, 0.4, 0.2] };

  it('interpolate produces weighted average of parents', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB, 'interpolate');
    // Default blend 0.5 → midpoint
    for (let i = 0; i < result.descriptor.length; i++) {
      expect(result.descriptor[i]).toBeCloseTo(0.5, 1);
    }
    expect(result.strategy).toBe('interpolate');
  });

  it('extrapolate extends beyond midpoint', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB, 'extrapolate');
    expect(result.strategy).toBe('extrapolate');
    expect(result.descriptor).toHaveLength(4);
    // All values clamped to [0, 1]
    for (const v of result.descriptor) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('crossover swaps segments between parents', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB, 'crossover');
    expect(result.strategy).toBe('crossover');
    // First half from A, second half from B (crossPoint = dim/2 = 2)
    expect(result.descriptor[0]).toBe(0.2);
    expect(result.descriptor[1]).toBe(0.4);
    expect(result.descriptor[2]).toBe(0.4);
    expect(result.descriptor[3]).toBe(0.2);
  });

  it('mutation perturbs with random noise', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB, 'mutation');
    expect(result.strategy).toBe('mutation');
    expect(result.descriptor).toHaveLength(parentA.descriptor.length);
  });

  it('default strategy is interpolate', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB);
    expect(result.strategy).toBe('interpolate');
  });

  it('computes novelty as distance from parents', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB, 'interpolate');
    expect(result.noveltyScore).toBeGreaterThan(0);
    expect(result.noveltyScore).toBeLessThanOrEqual(1);
  });

  it('includes parent IDs in result', () => {
    const engine = new RecombinationEngine();
    const result = engine.recombine(parentA, parentB);
    expect(result.parentIds).toEqual(['a', 'b']);
  });

  it('handles single-dimension descriptors', () => {
    const engine = new RecombinationEngine();
    const singleA = { id: 'a', descriptor: [0.3] };
    const singleB = { id: 'b', descriptor: [0.7] };
    const result = engine.recombine(singleA, singleB, 'interpolate');
    expect(result.descriptor).toHaveLength(1);
    expect(result.descriptor[0]).toBeCloseTo(0.5, 1);
  });
});
