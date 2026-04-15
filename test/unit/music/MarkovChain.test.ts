import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MIN_MARKOV_ORDER,
  MAX_MARKOV_ORDER,
  buildTransitionMatrix,
  generateMarkovMelody,
  type TransitionMatrix,
} from '../../../src/music/MarkovChain.js';

// ---------------------------------------------------------------------------
// buildTransitionMatrix
// ---------------------------------------------------------------------------

describe('buildTransitionMatrix', () => {
  // ---- Deterministic output from known input ----

  describe('order-1 with seed [60, 62, 64, 62, 60]', () => {
    const seed = [60, 62, 64, 62, 60];
    const matrix = buildTransitionMatrix(seed, 1);

    it('"60" maps to {62: 1.0} — only one outgoing transition', () => {
      const transitions = matrix.get('60');
      expect(transitions).toBeDefined();
      expect(transitions!.get(62)).toBeCloseTo(1.0);
      expect(transitions!.size).toBe(1);
    });

    it('"62" maps to {64: 0.5, 60: 0.5}', () => {
      const transitions = matrix.get('62');
      expect(transitions).toBeDefined();
      expect(transitions!.get(64)).toBeCloseTo(0.5);
      expect(transitions!.get(60)).toBeCloseTo(0.5);
      expect(transitions!.size).toBe(2);
    });

    it('"64" maps to {62: 1.0}', () => {
      const transitions = matrix.get('64');
      expect(transitions).toBeDefined();
      expect(transitions!.get(62)).toBeCloseTo(1.0);
      expect(transitions!.size).toBe(1);
    });

    it('contains exactly 3 states', () => {
      expect(matrix.size).toBe(3);
    });

    it('probabilities for each state sum to 1.0', () => {
      matrix.forEach((transitions) => {
        const sum = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0);
      });
    });
  });

  describe('order-2 with seed [60, 62, 64, 62, 60]', () => {
    const seed = [60, 62, 64, 62, 60];
    const matrix = buildTransitionMatrix(seed, 2);

    it('"60,62" maps to {64: 1.0}', () => {
      const transitions = matrix.get('60,62');
      expect(transitions).toBeDefined();
      expect(transitions!.get(64)).toBeCloseTo(1.0);
    });

    it('"62,64" maps to {62: 1.0}', () => {
      const transitions = matrix.get('62,64');
      expect(transitions).toBeDefined();
      expect(transitions!.get(62)).toBeCloseTo(1.0);
    });

    it('"64,62" maps to {60: 1.0}', () => {
      const transitions = matrix.get('64,62');
      expect(transitions).toBeDefined();
      expect(transitions!.get(60)).toBeCloseTo(1.0);
    });

    it('contains exactly 3 states', () => {
      expect(matrix.size).toBe(3);
    });
  });

  describe('repeated notes are merged into single entry', () => {
    it('seed [60, 60, 60] order 1: "60" maps to {60: 1.0}', () => {
      const matrix = buildTransitionMatrix([60, 60, 60], 1);
      const transitions = matrix.get('60');
      expect(transitions).toBeDefined();
      expect(transitions!.size).toBe(1);
      expect(transitions!.get(60)).toBeCloseTo(1.0);
    });
  });

  // ---- Error paths ----

  describe('error cases', () => {
    it('throws for order 0', () => {
      expect(() => buildTransitionMatrix([60, 62, 64], 0)).toThrow(
        'Markov order must be between 1 and 4, got 0',
      );
    });

    it('throws for order 5', () => {
      expect(() => buildTransitionMatrix([60, 62, 64, 65, 67, 69], 5)).toThrow(
        'Markov order must be between 1 and 4, got 5',
      );

    });

    it('throws for negative order', () => {
      expect(() => buildTransitionMatrix([60, 62, 64], -1)).toThrow(
        'Markov order must be between 1 and 4, got -1',
      );
    });

    it('throws for seed shorter than order+1 (order 1, 1 note)', () => {
      expect(() => buildTransitionMatrix([60], 1)).toThrow(
        'Seed melody must contain at least 2 notes for order-1 Markov chain, got 1',
      );
    });

    it('throws for seed shorter than order+1 (order 3, 3 notes)', () => {
      expect(() => buildTransitionMatrix([60, 62, 64], 3)).toThrow(
        'Seed melody must contain at least 4 notes for order-3 Markov chain, got 3',
      );
    });

    it('throws for empty seed melody', () => {
      expect(() => buildTransitionMatrix([], 1)).toThrow(
        'Seed melody must contain at least 2 notes for order-1 Markov chain, got 0',
      );
    });
  });

  // ---- Boundary: minimum valid seed ----

  describe('minimum valid inputs', () => {
    it('order 4 works with exactly 5 notes', () => {
      const matrix = buildTransitionMatrix([60, 62, 64, 65, 67], 4);
      expect(matrix.size).toBe(1);
      const transitions = matrix.get('60,62,64,65');
      expect(transitions).toBeDefined();
      expect(transitions!.get(67)).toBeCloseTo(1.0);
    });

    it('order 1 works with exactly 2 notes', () => {
      const matrix = buildTransitionMatrix([60, 62], 1);
      expect(matrix.size).toBe(1);
      expect(matrix.get('60')!.get(62)).toBeCloseTo(1.0);
    });
  });
});

// ---------------------------------------------------------------------------
// generateMarkovMelody
// ---------------------------------------------------------------------------

describe('generateMarkovMelody', () => {
  const seed = [60, 62, 64, 62, 60];

  describe('deterministic generation via Math.random mock', () => {
    let randomSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Always pick the first candidate in the transition map (random <= cumulative on first entry)
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      randomSpy.mockRestore();
    });

    it('produces output of requested length', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      const melody = generateMarkovMelody(seed, matrix, 12, 1);
      expect(melody.length).toBe(12);
    });

    it('output starts with the first `order` notes of the seed', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      const melody = generateMarkovMelody(seed, matrix, 10, 1);
      expect(melody[0]).toBe(seed[0]);
    });

    it('order-2 output starts with first 2 seed notes', () => {
      const matrix = buildTransitionMatrix(seed, 2);
      const melody = generateMarkovMelody(seed, matrix, 10, 2);
      expect(melody.slice(0, 2)).toEqual(seed.slice(0, 2));
    });

    it('order-3 output starts with first 3 seed notes', () => {
      const longerSeed = [60, 62, 64, 65, 64, 62, 60];
      const matrix = buildTransitionMatrix(longerSeed, 3);
      const melody = generateMarkovMelody(longerSeed, matrix, 10, 3);
      expect(melody.slice(0, 3)).toEqual(longerSeed.slice(0, 3));
    });

    it('generated notes come from the transition matrix', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      const melody = generateMarkovMelody(seed, matrix, 20, 1);
      // Every note beyond the initial state should be a valid pitch from the seed
      const uniqueSeed = new Set(seed);
      for (const note of melody) {
        expect(uniqueSeed.has(note)).toBe(true);
      }
    });

    it('length=1 returns just the initial state note', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      const melody = generateMarkovMelody(seed, matrix, 1, 1);
      expect(melody).toEqual([60]);
    });

    it('length=order returns the initial state without walking', () => {
      const matrix = buildTransitionMatrix(seed, 2);
      const melody = generateMarkovMelody(seed, matrix, 2, 2);
      expect(melody).toEqual([60, 62]);
    });
  });

  describe('probabilistic walk produces varied output', () => {
    it('different random values produce different melodies', () => {
      const matrix = buildTransitionMatrix(seed, 1);

      // Walk with random=0 (always picks first entry)
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const melodyA = generateMarkovMelody(seed, matrix, 20, 1);

      // Walk with random=0.999 (always picks last entry)
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      const melodyB = generateMarkovMelody(seed, matrix, 20, 1);

      vi.restoreAllMocks();

      // They share the first note (initial state) but likely diverge
      expect(melodyA[0]).toBe(melodyB[0]);
      // With 20 notes and probabilistic branching, some should differ
      const differences = melodyA.filter((n, i) => n !== melodyB[i]);
      expect(differences.length).toBeGreaterThan(0);
    });
  });

  describe('fallback to random seed note when state missing', () => {
    it('uses seed note when state is not in matrix', () => {
      const matrix: TransitionMatrix = new Map();
      // Empty matrix — every step falls back to random seed note

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const melody = generateMarkovMelody(seed, matrix, 8, 1);
      vi.restoreAllMocks();

      expect(melody.length).toBe(8);
      // First note is seed[0], rest are seed notes via fallback
      const uniqueSeed = new Set(seed);
      for (const note of melody) {
        expect(uniqueSeed.has(note)).toBe(true);
      }
    });

    it('uses injected rng for deterministic output', () => {
      const matrix: TransitionMatrix = new Map();
      const rng = () => 0;

      const melody = generateMarkovMelody(seed, matrix, 8, 1, rng);

      // With rng always returning 0, fallback always picks seed[0]
      expect(melody).toEqual([60, 60, 60, 60, 60, 60, 60, 60]);
    });
  });

  describe('error cases', () => {
    it('throws for length 0', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      expect(() => generateMarkovMelody(seed, matrix, 0, 1)).toThrow(
        'Length must be at least 1, got 0',
      );
    });

    it('throws for negative length', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      expect(() => generateMarkovMelody(seed, matrix, -5, 1)).toThrow(
        'Length must be at least 1, got -5',
      );
    });

    it('throws for order 0', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      expect(() => generateMarkovMelody(seed, matrix, 10, 0)).toThrow(
        'Markov order must be between 1 and 4, got 0',
      );
    });

    it('throws for order 5', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      expect(() => generateMarkovMelody(seed, matrix, 10, 5)).toThrow(
        'Markov order must be between 1 and 4, got 5',
      );
    });

    it('throws when seed shorter than order', () => {
      const matrix = buildTransitionMatrix(seed, 1);
      expect(() => generateMarkovMelody([60], matrix, 10, 2)).toThrow(
        'Seed must contain at least 2 notes for order-2 chain, got 1',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('exported constants', () => {
  it('MIN_MARKOV_ORDER is 1', () => {
    expect(MIN_MARKOV_ORDER).toBe(1);
  });

  it('MAX_MARKOV_ORDER is 4', () => {
    expect(MAX_MARKOV_ORDER).toBe(4);
  });
});
