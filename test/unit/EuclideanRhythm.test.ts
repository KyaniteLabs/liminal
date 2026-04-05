import { describe, it, expect } from 'vitest';
import { generateEuclideanPattern, rotatePattern, euclideanToNoteSequence } from '../../src/music/EuclideanRhythm.js';

describe('EuclideanRhythm', () => {
  it('generates the tresillo pattern E(3,8)', () => {
    const p = generateEuclideanPattern(8, 3);
    expect(p).toHaveLength(8);
    expect(p.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('returns all zeros when pulses is 0', () => {
    const p = generateEuclideanPattern(4, 0);
    expect(p).toEqual([0, 0, 0, 0]);
  });

  it('rotates pattern without mutating original', () => {
    const original = [1, 0, 1, 0];
    const rotated = rotatePattern(original, 1);
    expect(rotated).toEqual([0, 1, 0, 1]);
    expect(original).toEqual([1, 0, 1, 0]);
  });

  it('converts pattern to note sequence', () => {
    const seq = euclideanToNoteSequence([1, 0, 1]);
    expect(seq.notes).toHaveLength(2);
    expect(seq.duration).toBeCloseTo(0.75);
  });

  it('throws on invalid steps', () => {
    expect(() => generateEuclideanPattern(0, 1)).toThrow(RangeError);
  });
});
