import { describe, it, expect } from 'vitest';
import { fibonacciSphere } from '../../../src/nodeprompt/layout/fibonacciSphere.js';

describe('fibonacciSphere', () => {
  it('returns correct number of points', () => {
    expect(fibonacciSphere(10, 1)).toHaveLength(10);
    expect(fibonacciSphere(50, 1)).toHaveLength(50);
    expect(fibonacciSphere(1, 1)).toHaveLength(1);
  });

  it('returns empty array for n=0', () => {
    expect(fibonacciSphere(0, 1)).toEqual([]);
  });

  it('returns empty array for negative n', () => {
    expect(fibonacciSphere(-5, 1)).toEqual([]);
  });

  it('returns single point for n=1', () => {
    const points = fibonacciSphere(1, 5);
    expect(points).toHaveLength(1);
    // Single point should be on the sphere surface
    const p = points[0]!;
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    expect(dist).toBeCloseTo(5, 1);
  });

  it('places all points on sphere surface within tolerance', () => {
    const n = 100;
    const radius = 3;
    const points = fibonacciSphere(n, radius);
    for (const p of points) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      expect(dist).toBeCloseTo(radius, 1);
    }
  });

  it('places points on unit sphere surface', () => {
    const points = fibonacciSphere(20, 1);
    for (const p of points) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      expect(dist).toBeCloseTo(1, 1);
    }
  });

  it('scales points by radius', () => {
    const points1 = fibonacciSphere(10, 1);
    const points2 = fibonacciSphere(10, 5);
    for (let i = 0; i < 10; i++) {
      // Each coordinate should scale by factor of 5
      expect(points2[i]!.x).toBeCloseTo(points1[i]!.x * 5, 8);
      expect(points2[i]!.y).toBeCloseTo(points1[i]!.y * 5, 8);
      expect(points2[i]!.z).toBeCloseTo(points1[i]!.z * 5, 8);
    }
  });

  it('produces no extreme pole clustering (uniformity check)', () => {
    const points = fibonacciSphere(100, 1);
    // Count points in top and bottom 10% of y-range (y > 0.8 or y < -0.8)
    const topPole = points.filter(p => p.y > 0.8).length;
    const bottomPole = points.filter(p => p.y < -0.8).length;
    // With uniform distribution, expect ~10% at each pole cap
    // Allow generous range: between 2% and 20%
    expect(topPole).toBeGreaterThan(1);
    expect(topPole).toBeLessThan(25);
    expect(bottomPole).toBeGreaterThan(1);
    expect(bottomPole).toBeLessThan(25);
  });

  it('produces distinct points (no duplicates)', () => {
    const points = fibonacciSphere(20, 1);
    const keys = new Set(points.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`));
    // All points should be distinct
    expect(keys.size).toBe(20);
  });
});
