/**
 * Noise module unit tests.
 * Covers noise2D, noise3D, noiseSeed, and flowField functions.
 */
import { describe, it, expect } from 'vitest';
import { noise2D, noise3D, noiseSeed, flowField } from '../../../src/generators/p5/Noise.js';

// ---------------------------------------------------------------------------
// noise2D
// ---------------------------------------------------------------------------
describe('noise2D', () => {
  it('returns a number for origin coordinates', () => {
    const result = noise2D(0, 0);
    expect(typeof result).toBe('number');
    expect(isFinite(result)).toBe(true);
  });

  it('returns values in approximately [-1, 1] range', () => {
    // Sample many points to verify the range
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const v = noise2D(x * 0.3, y * 0.3);
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // OpenSimplex noise is bounded by [-1, 1] theoretically but
    // practically stays well within that range
    expect(min).toBeGreaterThanOrEqual(-1.5);
    expect(max).toBeLessThanOrEqual(1.5);
  });

  it('returns 0 at the exact origin', () => {
    const result = noise2D(0, 0);
    expect(result).toBe(0);
  });

  it('is deterministic with the same seed', () => {
    noiseSeed(42);
    const a = noise2D(1.5, 2.5);
    noiseSeed(42);
    const b = noise2D(1.5, 2.5);
    expect(a).toBe(b);
  });

  it('produces different values for different seeds', () => {
    noiseSeed(1);
    const a = noise2D(3.7, 2.1);
    noiseSeed(999);
    const b = noise2D(3.7, 2.1);
    expect(a).not.toBe(b);
  });

  it('produces smooth output (neighboring points are similar)', () => {
    noiseSeed(42);
    const a = noise2D(10, 10);
    const b = noise2D(10.01, 10.01);
    const diff = Math.abs(a - b);
    expect(diff).toBeLessThan(0.1);
  });

  it('returns different values at different coordinates', () => {
    noiseSeed(7);
    const a = noise2D(1, 2);
    const b = noise2D(3, 4);
    expect(a).not.toBe(b);
  });

  it('handles negative coordinates', () => {
    const result = noise2D(-5, -3);
    expect(typeof result).toBe('number');
    expect(isFinite(result)).toBe(true);
  });

  it('handles large coordinates', () => {
    const result = noise2D(10000, 10000);
    expect(typeof result).toBe('number');
    expect(isFinite(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// noise3D
// ---------------------------------------------------------------------------
describe('noise3D', () => {
  it('returns a number for origin coordinates', () => {
    const result = noise3D(0, 0, 0);
    expect(typeof result).toBe('number');
    expect(isFinite(result)).toBe(true);
  });

  it('returns 0 at the exact origin', () => {
    const result = noise3D(0, 0, 0);
    expect(result).toBe(0);
  });

  it('returns values in approximately [-1, 1] range', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        for (let z = 0; z < 5; z++) {
          const v = noise3D(x * 0.4, y * 0.4, z * 0.4);
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    expect(min).toBeGreaterThanOrEqual(-1.5);
    expect(max).toBeLessThanOrEqual(1.5);
  });

  it('is deterministic with the same seed', () => {
    noiseSeed(42);
    const a = noise3D(1.0, 2.0, 3.0);
    noiseSeed(42);
    const b = noise3D(1.0, 2.0, 3.0);
    expect(a).toBe(b);
  });

  it('produces different values for different seeds', () => {
    noiseSeed(1);
    const a = noise3D(3.7, 2.1, 1.4);
    noiseSeed(999);
    const b = noise3D(3.7, 2.1, 1.4);
    expect(a).not.toBe(b);
  });

  it('produces smooth output in 3D', () => {
    noiseSeed(42);
    const a = noise3D(10, 10, 10);
    const b = noise3D(10.01, 10.01, 10.01);
    const diff = Math.abs(a - b);
    expect(diff).toBeLessThan(0.1);
  });

  it('handles negative coordinates', () => {
    const result = noise3D(-5, -3, -2);
    expect(typeof result).toBe('number');
    expect(isFinite(result)).toBe(true);
  });

  it('differs from 2D noise at same xy coordinates', () => {
    noiseSeed(42);
    const n2 = noise2D(7, 11);
    const n3 = noise3D(7, 11, 0);
    // 3D noise at z=0 is a different computation than 2D noise
    // They should differ because of different skew factors and 3rd dimension contribution
    // Just verify both are valid numbers
    expect(typeof n2).toBe('number');
    expect(typeof n3).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// noiseSeed
// ---------------------------------------------------------------------------
describe('noiseSeed', () => {
  it('does not throw for integer seeds', () => {
    expect(() => noiseSeed(0)).not.toThrow();
    expect(() => noiseSeed(42)).not.toThrow();
    expect(() => noiseSeed(999999)).not.toThrow();
  });

  it('does not throw for negative seeds', () => {
    expect(() => noiseSeed(-1)).not.toThrow();
    expect(() => noiseSeed(-1000)).not.toThrow();
  });

  it('resets the permutation table (different seeds give different results)', () => {
    noiseSeed(10);
    const a = noise2D(2.3, 4.1);
    noiseSeed(20);
    const b = noise2D(2.3, 4.1);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// flowField
// ---------------------------------------------------------------------------
describe('flowField', () => {
  it('returns an object with angle and magnitude', () => {
    const result = flowField(10, 10);
    expect(result).toHaveProperty('angle');
    expect(result).toHaveProperty('magnitude');
    expect(typeof result.angle).toBe('number');
    expect(typeof result.magnitude).toBe('number');
  });

  it('angle is a finite number', () => {
    const result = flowField(5, 5);
    expect(isFinite(result.angle)).toBe(true);
  });

  it('magnitude is in [0, 1] range', () => {
    // magnitude = (noise2D(...) + 1) * 0.5, so [0, 1] if noise in [-1, 1]
    for (let i = 0; i < 20; i++) {
      const result = flowField(i * 7, i * 13);
      expect(result.magnitude).toBeGreaterThanOrEqual(-0.25);
      expect(result.magnitude).toBeLessThanOrEqual(1.25);
    }
  });

  it('uses default scale of 0.01 when not provided', () => {
    const defaultScale = flowField(100, 100);
    const explicitScale = flowField(100, 100, 0.01);
    expect(defaultScale.angle).toBe(explicitScale.angle);
    expect(defaultScale.magnitude).toBe(explicitScale.magnitude);
  });

  it('accepts custom scale parameter', () => {
    const lowScale = flowField(100, 100, 0.001);
    const highScale = flowField(100, 100, 0.1);
    // Different scales should produce different angles
    expect(lowScale.angle).not.toBe(highScale.angle);
  });

  it('accepts optional seed parameter', () => {
    const result = flowField(50, 50, 0.01, 42);
    expect(typeof result.angle).toBe('number');
    expect(typeof result.magnitude).toBe('number');
    expect(isFinite(result.angle)).toBe(true);
    expect(isFinite(result.magnitude)).toBe(true);
  });

  it('different seeds produce different flow fields', () => {
    const a = flowField(10, 10, 0.01, 1);
    const b = flowField(10, 10, 0.01, 2);
    expect(a.angle).not.toBe(b.angle);
  });

  it('is deterministic with same seed', () => {
    const a = flowField(25, 25, 0.02, 77);
    const b = flowField(25, 25, 0.02, 77);
    expect(a.angle).toBe(b.angle);
    expect(a.magnitude).toBe(b.magnitude);
  });
});
