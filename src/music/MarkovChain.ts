/**
 * Markov Chain Melody Generator
 *
 * Pure functional Markov chain implementation for melodic generation.
 * Supports Order-1 through Order-4 chains with probabilistic note selection.
 *
 * Ported from Generative-Score-Lab `src/lib/generators/markov.ts`.
 *
 * @module music/MarkovChain
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Transition matrix mapping state strings (comma-joined note sequences) to
 * maps of next-note candidates and their normalised probabilities (0..1).
 *
 * Example (Order-2, seed [60, 62, 64, 62]):
 * ```
 * "60,62" -> { 64 -> 1.0 }
 * "62,64" -> { 62 -> 1.0 }
 * "64,62" -> { ... }  (if more context exists)
 * ```
 */
export type TransitionMatrix = Map<string, Map<number, number>>;

/**
 * Options for {@link generateMarkovMelody}.
 */
export interface MarkovGenerateOptions {
  /** The seed melody used to seed the output and walk the chain. */
  seed: number[];
  /** The pre-built transition matrix (from {@link buildTransitionMatrix}). */
  matrix: TransitionMatrix;
  /** Desired output melody length in notes (must be >= 1). */
  length: number;
  /** Markov chain order (1-4). Must match the matrix's order. */
  order: number;
}

/**
 * Bounds for the Markov order parameter.
 */
export const MIN_MARKOV_ORDER = 1 as const;
export const MAX_MARKOV_ORDER = 4 as const;

// ---------------------------------------------------------------------------
// buildTransitionMatrix
// ---------------------------------------------------------------------------

/**
 * Build a Markov chain transition matrix from a seed melody.
 *
 * For each contiguous window of `order` notes, the function records the
 * following note and increments its count. After scanning the full melody
 * all counts are normalised to probabilities that sum to 1 per state.
 *
 * @param seedMelody - Array of note values (e.g. MIDI pitch numbers).
 * @param order      - Markov order (1-4). Higher orders capture more context
 *                     but require longer seed melodies.
 * @returns Normalised transition matrix.
 * @throws {Error} If order is not between 1 and 4 inclusive.
 * @throws {Error} If the seed melody is too short for the given order
 *                 (requires at least `order + 1` notes).
 *
 * @example
 * ```ts
 * const matrix = buildTransitionMatrix([60, 62, 64, 62, 60], 1);
 * // matrix.get("60") -> Map { 62 -> 0.5, 62 -> ... (merged) }
 * // matrix.get("62") -> Map { 64 -> 0.5, 60 -> 0.5 }
 * // matrix.get("64") -> Map { 62 -> 1.0 }
 * ```
 */
export function buildTransitionMatrix(
  seedMelody: number[],
  order: number,
): TransitionMatrix {
  if (order < MIN_MARKOV_ORDER || order > MAX_MARKOV_ORDER) {
    throw new Error(
      `Markov order must be between ${MIN_MARKOV_ORDER} and ${MAX_MARKOV_ORDER}, got ${order}`,
    );
  }

  if (seedMelody.length < order + 1) {
    throw new Error(
      `Seed melody must contain at least ${order + 1} notes for order-${order} Markov chain, got ${seedMelody.length}`,
    );
  }

  const matrix: TransitionMatrix = new Map();

  // Count transitions
  for (let i = 0; i < seedMelody.length - order; i++) {
    const state = seedMelody.slice(i, i + order).join(',');
    const nextNote = seedMelody[i + order];

    let transitions = matrix.get(state);
    if (transitions === undefined) {
      transitions = new Map<number, number>();
      matrix.set(state, transitions);
    }

    transitions.set(nextNote, (transitions.get(nextNote) ?? 0) + 1);
  }

  // Normalise counts to probabilities
  matrix.forEach((transitions) => {
    const total = Array.from(transitions.values()).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (total > 0) {
      transitions.forEach((count, note) => {
        transitions.set(note, count / total);
      });
    }
  });

  return matrix;
}

// ---------------------------------------------------------------------------
// generateMarkovMelody
// ---------------------------------------------------------------------------

/**
 * Generate a melody by walking a Markov chain probabilistically.
 *
 * The output begins with the first `order` notes of the seed (the initial
 * state) and then appends notes one at a time by looking up the current
 * state in the transition matrix and picking a successor using cumulative
 * probability sampling.
 *
 * If the current state has no entry in the matrix the generator falls back
 * to a uniformly random note from the seed melody, ensuring the chain never
 * stalls.
 *
 * @param seed   - The seed melody (also provides the initial state).
 * @param matrix - Transition matrix built by {@link buildTransitionMatrix}.
 * @param length - Desired output length (must be >= 1).
 * @param order  - Markov order (1-4), must match the matrix.
 * @returns Generated melody array of the requested length.
 * @throws {Error} If length is less than 1.
 * @throws {Error} If order is not between 1 and 4.
 * @throws {Error} If the seed is shorter than `order`.
 *
 * @example
 * ```ts
 * const seed = [60, 62, 64, 65, 64, 62, 60];
 * const matrix = buildTransitionMatrix(seed, 2);
 * const melody = generateMarkovMelody(seed, matrix, 24, 2);
 * // melody.length === 24
 * ```
 */
export function generateMarkovMelody(
  seed: number[],
  matrix: TransitionMatrix,
  length: number,
  order: number,
): number[] {
  if (order < MIN_MARKOV_ORDER || order > MAX_MARKOV_ORDER) {
    throw new Error(
      `Markov order must be between ${MIN_MARKOV_ORDER} and ${MAX_MARKOV_ORDER}, got ${order}`,
    );
  }

  if (length < 1) {
    throw new Error(`Length must be at least 1, got ${length}`);
  }

  if (seed.length < order) {
    throw new Error(
      `Seed must contain at least ${order} notes for order-${order} chain, got ${seed.length}`,
    );
  }

  // Start with the initial state from the seed
  const melody: number[] = seed.slice(0, order);

  while (melody.length < length) {
    const state = melody.slice(-order).join(',');
    const transitions = matrix.get(state);

    // Fallback: no transition recorded for this state
    if (transitions === undefined || transitions.size === 0) {
      melody.push(seed[Math.floor(Math.random() * seed.length)]);
      continue;
    }

    // Pick next note via cumulative probability
    const random = Math.random();
    let cumulative = 0;
    let nextNote = melody[melody.length - 1]; // default to last note

    const entries = Array.from(transitions.entries());
    for (let ei = 0; ei < entries.length; ei++) {
      const [note, probability] = entries[ei];
      cumulative += probability;
      if (random <= cumulative) {
        nextNote = note;
        break;
      }
    }

    melody.push(nextNote);
  }

  return melody;
}
