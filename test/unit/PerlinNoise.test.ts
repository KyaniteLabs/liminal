import { describe, it, expect } from 'vitest';
import { PerlinNoise } from '../../src/utils/PerlinNoise.js';

describe('PerlinNoise', () => {
  it('returns deterministic values for same seed', () => {
    const a = new PerlinNoise(42);
    const b = new PerlinNoise(42);
    expect(a.noise2D(1.5, 2.3)).toBe(b.noise2D(1.5, 2.3));
  });

  it('produces values in expected range for 2D noise', () => {
    const pn = new PerlinNoise(99);
    for (let i = 0; i < 20; i++) {
      const v = pn.noise2D(i * 0.3, i * 0.7);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('produces values in expected range for 3D noise', () => {
    const pn = new PerlinNoise(7);
    const v = pn.noise3D(1.1, 2.2, 3.3);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('octave noise returns values in range', () => {
    const pn = new PerlinNoise(10);
    const v = pn.octave2D(1, 1, 4, 0.5, 2.0);
    expect(Math.abs(v)).toBeLessThanOrEqual(1.01);
  });
});
