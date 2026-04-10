import { describe, it, expect } from 'vitest';
import { classifyRhyme, getRhymeScore } from '../../../src/music/RhymeEngine.js';

describe('classifyRhyme', () => {
  describe('perfect rhymes (score 1.0)', () => {
    it('classifies cat/hat as perfect', () => {
      const result = classifyRhyme('cat', 'hat');
      expect(result.type).toBe('perfect');
      expect(result.score).toBe(1.0);
    });

    it('classifies day/play as perfect', () => {
      const result = classifyRhyme('day', 'play');
      expect(result.type).toBe('perfect');
      expect(result.score).toBe(1.0);
    });

    it('classifies cat/mat as perfect', () => {
      const result = classifyRhyme('cat', 'mat');
      expect(result.type).toBe('perfect');
      expect(result.score).toBe(1.0);
    });

    it('classifies play/stay as perfect', () => {
      const result = classifyRhyme('play', 'stay');
      expect(result.type).toBe('perfect');
      expect(result.score).toBe(1.0);
    });

    it('classifies seat/beat as perfect', () => {
      const result = classifyRhyme('seat', 'beat');
      expect(result.type).toBe('perfect');
      expect(result.score).toBe(1.0);
    });
  });

  describe('slant rhymes (score 0.7)', () => {
    it('classifies cat/bad as slant (same vowel group, different consonants)', () => {
      const result = classifyRhyme('cat', 'bad');
      expect(result.type).toBe('slant');
      expect(result.score).toBe(0.7);
    });

    it('classifies back/hat as slant', () => {
      const result = classifyRhyme('back', 'hat');
      expect(result.type).toBe('slant');
      expect(result.score).toBe(0.7);
    });

    it('classifies love/dove as slant (same vowel group, different trailing consonants)', () => {
      const result = classifyRhyme('love', 'dove');
      expect(result.type).toBe('slant');
      expect(result.score).toBe(0.7);
    });

    it('classifies make/take as slant (same vowel group, different trailing consonants)', () => {
      const result = classifyRhyme('make', 'take');
      expect(result.type).toBe('slant');
      expect(result.score).toBe(0.7);
    });
  });

  describe('no rhyme (score 0.0)', () => {
    it('classifies cat/dog as none (different vowel groups)', () => {
      const result = classifyRhyme('cat', 'dog');
      expect(result.type).toBe('none');
      expect(result.score).toBe(0.0);
    });

    it('classifies day/night as none', () => {
      const result = classifyRhyme('day', 'night');
      expect(result.type).toBe('none');
      expect(result.score).toBe(0.0);
    });

    it('returns none for the same word (prevents score inflation)', () => {
      const result = classifyRhyme('cat', 'cat');
      expect(result.type).toBe('none');
      expect(result.score).toBe(0.0);
    });

    it('returns none for the same word with different casing', () => {
      const result = classifyRhyme('Cat', 'CAT');
      expect(result.type).toBe('none');
      expect(result.score).toBe(0.0);
    });
  });
});

describe('getRhymeScore', () => {
  it('returns close to 1.0 for all perfect rhymes', () => {
    // cat/hat = perfect (1.0), hat/rat = perfect (1.0)
    // alternating: cat/rat = perfect (1.0)
    // total: 3.0 / 3 pairs = 1.0
    const lines = ['The cat', 'A hat', 'The rat'];
    const score = getRhymeScore(lines);
    expect(score).toBe(1.0);
  });

  it('returns 0.0 when no words rhyme', () => {
    // cat/dog = none, dog/sun = none, cat/sun = none
    const lines = ['The cat', 'A dog', 'The sun'];
    const score = getRhymeScore(lines);
    expect(score).toBe(0.0);
  });

  it('returns 0.0 for empty array', () => {
    expect(getRhymeScore([])).toBe(0.0);
  });

  it('returns 0.0 for single line', () => {
    expect(getRhymeScore(['The cat'])).toBe(0.0);
  });

  it('returns intermediate score for mixed quality lines', () => {
    // Line endings: cat, dog, hat
    // Consecutive pairs: cat/dog = none (0.0), dog/hat = none (0.0)
    // Alternating pair: cat/hat = perfect (1.0)
    // Total: 1.0 / 3 pairs = 0.333...
    const lines = ['The cat', 'A dog', 'A hat'];
    const score = getRhymeScore(lines);
    expect(score).toBeCloseTo(1.0 / 3, 4);
    expect(score).toBeGreaterThan(0.0);
    expect(score).toBeLessThan(1.0);
  });

  it('scores AABB pattern correctly', () => {
    // Endings: cat, hat, dog, log
    // Consecutive: cat/hat=1.0, hat/dog=0.0, dog/log=1.0 → sum=2.0, 3 pairs
    // Alternating: cat/dog=0.0, dog/(none, i=2, words[4] doesn't exist)
    //   → only cat/dog=0.0, 1 pair
    // Total: 2.0 + 0.0 = 2.0 / 4 pairs = 0.5
    const lines = ['The cat', 'A hat', 'The dog', 'A log'];
    const score = getRhymeScore(lines);
    expect(score).toBe(0.5);
  });

  it('handles two-line input', () => {
    // Only one consecutive pair, no alternating pairs possible
    const lines = ['The cat', 'A hat'];
    const score = getRhymeScore(lines);
    expect(score).toBe(1.0);
  });
});
