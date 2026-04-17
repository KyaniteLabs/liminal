import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  dotProduct,
  findKNearestNeighbors,
} from '../../../src/utils/vectors.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns 0 for zero-norm vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1])).toThrow('Vector length mismatch');
  });

  it('handles fractional similarity', () => {
    const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    expect(result).toBeGreaterThan(0.9);
    expect(result).toBeLessThan(1);
  });
});

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('calculates distance correctly', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
  });

  it('pads shorter vector with zeros', () => {
    const result = euclideanDistance([1, 2], [1, 2, 3]);
    expect(result).toBeCloseTo(3);
  });

  it('handles empty vectors', () => {
    expect(euclideanDistance([], [])).toBe(0);
  });
});

describe('normalizeVector', () => {
  it('normalizes to unit length', () => {
    const result = normalizeVector([3, 4]);
    expect(result[0]).toBeCloseTo(0.6);
    expect(result[1]).toBeCloseTo(0.8);
  });

  it('returns zero vector unchanged', () => {
    expect(normalizeVector([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('preserves direction of unit vectors', () => {
    const result = normalizeVector([1, 0]);
    expect(result).toEqual([1, 0]);
  });
});

describe('dotProduct', () => {
  it('calculates dot product correctly', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('handles different-length vectors', () => {
    expect(dotProduct([1, 2, 3], [4, 5])).toBe(14);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(dotProduct([1, 0], [0, 1])).toBe(0);
  });
});

describe('findKNearestNeighbors', () => {
  const vectors = [
    [1, 0],
    [0, 1],
    [1, 1],
    [-1, 0],
  ];

  it('finds nearest neighbor', () => {
    const result = findKNearestNeighbors([1, 0.1], vectors, 1);
    expect(result).toEqual([0]);
  });

  it('finds k nearest neighbors sorted by similarity', () => {
    const result = findKNearestNeighbors([1, 0.9], vectors, 2);
    expect(result[0]).toBe(2);
  });

  it('returns all when k exceeds count', () => {
    const result = findKNearestNeighbors([1, 0], vectors, 10);
    expect(result.length).toBe(4);
  });
});
