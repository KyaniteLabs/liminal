/**
 * Noise API tests
 */

import { noise2D, noise3D, noiseSeed, flowField } from '../../src/generators/p5/Noise.js';

describe('Noise', () => {
  it('noise2D returns values in [-1, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const val = noise2D(i * 0.1, i * 0.2);
      expect(val).toBeGreaterThanOrEqual(-1);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('noise2D is deterministic with seed', () => {
    noiseSeed(42);
    const a = noise2D(1.5, 2.5);
    noiseSeed(42);
    const b = noise2D(1.5, 2.5);
    expect(a).toBe(b);
  });

  it('noise2D produces different values for different inputs', () => {
    noiseSeed(0);
    const a = noise2D(0, 0);
    const b = noise2D(100, 100);
    expect(a).not.toBe(b);
  });

  it('noise2D is smooth (nearby inputs produce nearby outputs)', () => {
    noiseSeed(123);
    const a = noise2D(10.0, 10.0);
    const b = noise2D(10.01, 10.0);
    expect(Math.abs(a - b)).toBeLessThan(0.5);
  });

  it('noise3D returns values in [-1, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const val = noise3D(i * 0.1, i * 0.2, i * 0.05);
      expect(val).toBeGreaterThanOrEqual(-1);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('noise3D is deterministic with seed', () => {
    noiseSeed(99);
    const a = noise3D(1, 2, 3);
    noiseSeed(99);
    const b = noise3D(1, 2, 3);
    expect(a).toBe(b);
  });

  it('flowField returns angle and magnitude', () => {
    noiseSeed(0);
    const result = flowField(100, 200, 0.01);
    expect(result).toHaveProperty('angle');
    expect(result).toHaveProperty('magnitude');
    expect(typeof result.angle).toBe('number');
    expect(typeof result.magnitude).toBe('number');
    expect(result.magnitude).toBeGreaterThanOrEqual(0);
    expect(result.magnitude).toBeLessThanOrEqual(1);
  });

  it('flowField is deterministic with same seed', () => {
    const a = flowField(50, 50, 0.01, 42);
    const b = flowField(50, 50, 0.01, 42);
    expect(a.angle).toBe(b.angle);
    expect(a.magnitude).toBe(b.magnitude);
  });

  it('flowField returns different vectors for different positions', () => {
    const a = flowField(0, 0, 0.01, 0);
    const b = flowField(500, 500, 0.01, 0);
    expect(a.angle).not.toBe(b.angle);
  });
});
