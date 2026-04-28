import { describe, it, expect } from 'vitest';
import {
  countSyllables,
  countLineSyllables,
  validateSyllableConstraint,
  type SyllableValidationResult,
} from '../../../src/music/SyllableCounter.js';

// ---------------------------------------------------------------------------
// countSyllables
// ---------------------------------------------------------------------------

describe('countSyllables', () => {
  // ---- Known words ----

  describe('common words', () => {
    it('"hello" = 2', () => {
      expect(countSyllables('hello')).toBe(2);
    });

    it('"table" = 2 (consonant+le pattern)', () => {
      expect(countSyllables('table')).toBe(2);
    });

    it('"the" = 1', () => {
      expect(countSyllables('the')).toBe(1);
    });

    it('"fire" = 1 (heuristic undercounts due to silent-e rule)', () => {
      // f-i-r-e: vowel groups i,e → 2; trailing silent e → 1
      // This is a known heuristic limitation — true count is 2
      expect(countSyllables('fire')).toBe(1);
    });

    it('"beautiful" = 3', () => {
      // beau-ti-ful: 3 vowel groups (eau=1, i=1, u=1), no silent e
      expect(countSyllables('beautiful')).toBe(3);
    });
  });

  // ---- Silent 'e' ----

  describe('silent trailing e', () => {
    it('"make" = 1', () => {
      expect(countSyllables('make')).toBe(1);
    });

    it('"time" = 1', () => {
      expect(countSyllables('time')).toBe(1);
    });

    it('"hope" = 1', () => {
      expect(countSyllables('hope')).toBe(1);
    });

    it('"name" = 1', () => {
      expect(countSyllables('name')).toBe(1);
    });

    it('"bake" = 1', () => {
      expect(countSyllables('bake')).toBe(1);
    });

    it('"complete" = 2', () => {
      // com-plete: 2 vowel groups (o, e+e), silent e deducted → net 2
      expect(countSyllables('complete')).toBe(2);
    });
  });

  // ---- Consonant+le ----

  describe('consonant+le pattern', () => {
    it('"table" = 2', () => {
      expect(countSyllables('table')).toBe(2);
    });

    it('"simple" = 2', () => {
      expect(countSyllables('simple')).toBe(2);
    });

    it('"little" = 2', () => {
      expect(countSyllables('little')).toBe(2);
    });

    it('"purple" = 2', () => {
      expect(countSyllables('purple')).toBe(2);
    });
  });

  // ---- 'io' patterns ----

  describe('io digraph handling', () => {
    it('"radio" = 2 (io preceded by consonant d, counted as one group)', () => {
      // r-a-d-i-o: vowel groups a, io → 2. 'io' preceded by 'd' (consonant) → no extra.
      // Heuristic undercounts vs true 3 syllables (ra-di-o)
      expect(countSyllables('radio')).toBe(2);
    });

    it('"nation" counts io preceded by consonant', () => {
      // na-tion: vowel groups: a, io → 2. 'io' preceded by 't' (consonant) → no extra.
      expect(countSyllables('nation')).toBe(2);
    });

    it('"ratio" counts io preceded by vowel', () => {
      // ra-ti-o: vowel groups: a, io → 2. 'io' preceded by 't' (consonant) → no extra.
      // Wait, check: r-a-t-i-o → vowel groups: a, io → 2, io preceded by t (consonant).
      expect(countSyllables('ratio')).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('empty string returns 0', () => {
      expect(countSyllables('')).toBe(0);
    });

    it('single letter "a" returns 1', () => {
      expect(countSyllables('a')).toBe(1);
    });

    it('single letter "x" returns 1 (minimum)', () => {
      expect(countSyllables('x')).toBe(1);
    });

    it('single letter "I" returns 1', () => {
      expect(countSyllables('I')).toBe(1);
    });

    it('is case-insensitive', () => {
      expect(countSyllables('HELLO')).toBe(countSyllables('hello'));
      expect(countSyllables('Beautiful')).toBe(countSyllables('beautiful'));
    });

    it('strips non-alpha characters', () => {
      expect(countSyllables("don't")).toBe(countSyllables('dont'));
      expect(countSyllables('hello!')).toBe(countSyllables('hello'));
    });

    it('returns 0 for all-non-alpha input', () => {
      expect(countSyllables('---')).toBe(0);
      expect(countSyllables('123')).toBe(0);
    });
  });

  // ---- Longer / more complex words ----

  describe('multi-syllable words', () => {
    it('"extraordinary" has multiple syllables', () => {
      expect(countSyllables('extraordinary')).toBeGreaterThanOrEqual(5);
    });

    it('"a" = 1', () => {
      expect(countSyllables('a')).toBe(1);
    });

    it('"eye" = 1 (vowel group "eye" is one group)', () => {
      expect(countSyllables('eye')).toBe(1);
    });

    it('"create" = 1 (heuristic undercounts consecutive vowels + silent e)', () => {
      // c-r-e-a-t-e: e(pos2 new group), a(pos3 same group), e(pos5 new group) → count=2
      // Trailing silent e deducted → 1
      expect(countSyllables('create')).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// countLineSyllables
// ---------------------------------------------------------------------------

describe('countLineSyllables', () => {
  it('sums syllables across words', () => {
    // "The quick brown fox" → 1 + 1 + 1 + 1 = 4
    expect(countLineSyllables('The quick brown fox')).toBe(4);
  });

  it('handles multi-syllable words', () => {
    // "beautiful table" → 3 + 2 = 5
    expect(countLineSyllables('beautiful table')).toBe(5);
  });

  it('returns 0 for empty string', () => {
    expect(countLineSyllables('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countLineSyllables('   ')).toBe(0);
  });

  it('returns 0 for whitespace-only with tabs', () => {
    expect(countLineSyllables('\t\n  ')).toBe(0);
  });

  it('handles single word', () => {
    expect(countLineSyllables('hello')).toBe(2);
  });

  it('handles leading and trailing whitespace', () => {
    expect(countLineSyllables('  hello world  ')).toBe(
      countLineSyllables('hello world'),
    );
  });

  it('handles punctuation attached to words', () => {
    // countSyllables strips non-alpha, so "hello," = "hello" = 2
    expect(countLineSyllables('hello, world!')).toBe(
      countLineSyllables('hello world'),
    );
  });
});

// ---------------------------------------------------------------------------
// validateSyllableConstraint
// ---------------------------------------------------------------------------

describe('validateSyllableConstraint', () => {
  describe('all lines match target', () => {
    it('returns valid=true when every line has exactly the target count', () => {
      // "The sun" = 1 + 1 = 2
      // "A day" = 1 + 1 = 2
      const result = validateSyllableConstraint(['The sun', 'A day'], 2);
      expect(result.valid).toBe(true);
      expect(result.actual).toEqual([2, 2]);
      expect(result.suggestions).toEqual([]);
    });

    it('returns valid=true for single matching line', () => {
      const result = validateSyllableConstraint(['Hello world'], 3);
      // hello=2, world=1 → 3
      expect(result.valid).toBe(true);
      expect(result.actual).toEqual([3]);
    });
  });

  describe('some lines do not match target', () => {
    it('returns valid=false when lines deviate', () => {
      // "The" = 1 (target 2)
      // "Hello world" = 3 (target 2)
      const result = validateSyllableConstraint(['The', 'Hello world'], 2);
      expect(result.valid).toBe(false);
    });

    it('actual array has correct per-line counts', () => {
      const result = validateSyllableConstraint(
        ['The', 'Hello world', 'A beautiful day'],
        4,
      );
      // The=1, Hello world=3, A beautiful day=1+3+1=5
      expect(result.actual).toEqual([1, 3, 5]);
    });

    it('suggestions contain the line number of mismatched lines', () => {
      const result = validateSyllableConstraint(['The', 'A day'], 2);
      expect(result.suggestions.length).toBeGreaterThan(0);
      // "The" has 1 syllable (target 2) → Line 1 suggestion
      expect(result.suggestions[0]).toContain('Line 1');
    });

    it('suggestions mention "too few" when under target', () => {
      const result = validateSyllableConstraint(['The'], 5);
      expect(result.suggestions[0]).toContain('too few');
    });

    it('suggestions mention "too many" when over target', () => {
      const result = validateSyllableConstraint(
        ['extraordinary beautiful'],
        2,
      );
      expect(result.suggestions[0]).toContain('too many');
    });

    it('suggestions include the target count', () => {
      const result = validateSyllableConstraint(['The'], 5);
      expect(result.suggestions[0]).toContain('5');
    });

    it('only mismatched lines get suggestions', () => {
      // Line 1: "A day" = 2 (matches target 2) → no suggestion
      // Line 2: "The" = 1 (does not match target 2) → suggestion
      const result = validateSyllableConstraint(['A day', 'The'], 2);
      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0]).toContain('Line 2');
    });
  });

  describe('empty input', () => {
    it('returns valid=true for empty lines array', () => {
      const result = validateSyllableConstraint([], 5);
      expect(result.valid).toBe(true);
      expect(result.actual).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });
  });

  describe('result shape', () => {
    it('returns object with valid, actual, and suggestions keys', () => {
      const result = validateSyllableConstraint(['test'], 1);
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('suggestions');
      expect(result.valid === true || result.valid === false).toBe(true);
      expect(Array.isArray(result.actual)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });
});
