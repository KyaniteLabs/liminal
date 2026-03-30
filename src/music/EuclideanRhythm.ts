/**
 * EuclideanRhythm — Pure Euclidean rhythm generator using Bjorklund's algorithm.
 *
 * Distributes N pulses across M steps as evenly as possible, producing
 * rhythmic patterns common in West African, Latin, and electronic music.
 * Supports pattern rotation and conversion to structured note sequences.
 *
 * No external dependencies. Pure functions only.
 *
 * @module music/EuclideanRhythm
 */

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** A single Euclidean pattern is an array of 0s (rests) and 1s (pulses). */
export type EuclideanPattern = number[];

/** Configuration for converting a pattern into a note sequence. */
export interface NoteSequenceOptions {
  /** MIDI pitch for every note. Default 60 (middle C). */
  pitch?: number;
  /** Duration of each step in seconds. Default 0.25 (16th note at 120 BPM). */
  stepDuration?: number;
  /** Duration of each triggered note in seconds. Default: `stepDuration * 0.8`. */
  noteDuration?: number;
  /** MIDI velocity (0-127). Default 100. */
  velocity?: number;
}

/** A single note event in a sequenced timeline. */
export interface NoteEvent {
  /** Onset time in seconds from the start of the sequence. */
  time: number;
  /** MIDI pitch (0-127). */
  pitch: number;
  /** Duration of the note in seconds. */
  duration: number;
  /** MIDI velocity (0-127). */
  velocity: number;
}

/** Result of converting a pattern to a note sequence. */
export interface NoteSequence {
  /** Ordered note events for every pulse in the pattern. */
  notes: NoteEvent[];
  /** Total duration of the sequence in seconds (steps * stepDuration). */
  duration: number;
}

// ---------------------------------------------------------------------------
// Bjorklund's Algorithm
// ---------------------------------------------------------------------------

/**
 * Generate a Euclidean rhythm pattern using Bjorklund's algorithm.
 *
 * The algorithm distributes `pulses` onsets as evenly as possible across
 * `steps` positions. For example, E(3, 8) produces `[1,0,1,0,1,0,0,0]`
 * which is the classic Cuban tresillo rhythm.
 *
 * How it works:
 * 1. Start with `pulses` groups of `[1]` and `steps - pulses` groups of `[0]`.
 * 2. Repeatedly concatenate the smaller tail groups onto the larger head
 *    groups until the remaining tail groups can no longer be evenly distributed.
 * 3. Flatten and trim to exactly `steps` entries.
 *
 * @param steps  - Total number of steps in the pattern (must be >= 1).
 * @param pulses - Number of pulses / onsets to place (must be >= 0 and <= steps).
 * @returns An array of length `steps` containing only 0s and 1s.
 * @throws {RangeError} If steps < 1, pulses < 0, or pulses > steps.
 *
 * @example
 * ```ts
 * generateEuclideanPattern(8, 3); // => [1, 0, 1, 0, 1, 0, 0, 0]
 * generateEuclideanPattern(8, 5); // => [1, 0, 1, 1, 0, 1, 1, 0]
 * generateEuclideanPattern(4, 0); // => [0, 0, 0, 0]
 * generateEuclideanPattern(4, 4); // => [1, 1, 1, 1]
 * ```
 */
export function generateEuclideanPattern(steps: number, pulses: number): EuclideanPattern {
  // --- Input validation ---
  if (!Number.isInteger(steps) || steps < 1) {
    throw new RangeError(`steps must be a positive integer, got ${steps}`);
  }
  if (!Number.isInteger(pulses) || pulses < 0) {
    throw new RangeError(`pulses must be a non-negative integer, got ${pulses}`);
  }
  if (pulses > steps) {
    throw new RangeError(`pulses (${pulses}) must not exceed steps (${steps})`);
  }

  // --- Trivial cases ---
  if (pulses === 0) {
    return new Array<number>(steps).fill(0);
  }
  if (pulses === steps) {
    return new Array<number>(steps).fill(1);
  }

  // --- Bjorklund's algorithm ---
  // Initialise groups: each pulse is [1], each rest is [0].
  const groups: number[][] = [];
  for (let i = 0; i < pulses; i++) {
    groups.push([1]);
  }
  for (let i = 0; i < steps - pulses; i++) {
    groups.push([0]);
  }

  // Iteratively merge the smaller tail into the larger head.
  // After each pass, the number of remaining groups is reduced.
  let remainderHeadCount = pulses;
  let remainderTailCount = steps - pulses;

  while (remainderTailCount > 1) {
    // Number of groups we can merge in this pass
    const mergeCount = Math.min(remainderHeadCount, remainderTailCount);

    for (let i = 0; i < mergeCount; i++) {
      // Concatenate tail group onto corresponding head group
      const headIdx = remainderHeadCount - 1 - i;
      const tailIdx = remainderHeadCount + remainderTailCount - 1 - i;
      groups[headIdx] = [...groups[headIdx], ...groups[tailIdx]];
    }

    // Update counters for the next iteration
    if (remainderHeadCount >= remainderTailCount) {
      remainderHeadCount = remainderTailCount;
      remainderTailCount = remainderHeadCount - remainderTailCount;
    } else {
      remainderTailCount = remainderTailCount - remainderHeadCount;
    }
  }

  // Flatten all groups into a single pattern array
  const flat: number[] = groups.flat();

  // Safety: trim or pad to exactly `steps` length
  return flat.slice(0, steps);
}

// ---------------------------------------------------------------------------
// Pattern Rotation
// ---------------------------------------------------------------------------

/**
 * Rotate a Euclidean pattern (or any binary array) by a given offset.
 *
 * Positive rotations shift elements to the right (later in time),
 * wrapping around to the beginning. Negative rotations shift left.
 * Rotation is performed modulo the pattern length, so rotating by the
 * pattern length returns an identical pattern.
 *
 * @param pattern  - The pattern array to rotate.
 * @param rotation - Number of positions to rotate (positive = rightward shift).
 * @returns A new array with the rotated values. The original is not mutated.
 *
 * @example
 * ```ts
 * rotatePattern([1, 0, 1, 0, 1, 0, 0, 0], 1); // => [0, 1, 0, 1, 0, 1, 0, 0]
 * rotatePattern([1, 0, 1, 0, 1, 0, 0, 0], -1); // => [0, 1, 0, 1, 0, 0, 0, 1]
 * ```
 */
export function rotatePattern(pattern: EuclideanPattern, rotation: number): EuclideanPattern {
  if (pattern.length === 0) {
    return [];
  }

  const len = pattern.length;
  // Normalise rotation to [0, len)
  const offset = ((rotation % len) + len) % len;

  if (offset === 0) {
    return [...pattern];
  }

  const tail = pattern.slice(len - offset);
  const head = pattern.slice(0, len - offset);
  return [...tail, ...head];
}

// ---------------------------------------------------------------------------
// Pattern to Note Sequence
// ---------------------------------------------------------------------------

/**
 * Convert a Euclidean pattern into a structured note sequence with timing
 * information suitable for MIDI rendering or audio scheduling.
 *
 * Each pulse (`1`) in the pattern becomes a note event at its corresponding
 * time position. Rests (`0`) are skipped. The total sequence duration equals
 * `pattern.length * stepDuration`.
 *
 * @param pattern - A binary pattern array (e.g. from `generateEuclideanPattern`).
 * @param options - Optional configuration for pitch, timing, and velocity.
 * @returns A `NoteSequence` with ordered note events and total duration.
 *
 * @example
 * ```ts
 * const pattern = generateEuclideanPattern(8, 3);
 * const seq = euclideanToNoteSequence(pattern, { pitch: 60, stepDuration: 0.25 });
 * // seq.notes.length === 3
 * // seq.duration === 2.0  (8 steps * 0.25s)
 * // seq.notes[0] === { time: 0, pitch: 60, duration: 0.2, velocity: 100 }
 * ```
 */
export function euclideanToNoteSequence(
  pattern: EuclideanPattern,
  options: NoteSequenceOptions = {},
): NoteSequence {
  const {
    pitch = 60,
    stepDuration = 0.25,
    noteDuration = stepDuration * 0.8,
    velocity = 100,
  } = options;

  const totalDuration = pattern.length * stepDuration;
  const notes: NoteEvent[] = [];

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 1) {
      notes.push({
        time: i * stepDuration,
        pitch,
        duration: noteDuration,
        velocity,
      });
    }
  }

  return { notes, duration: totalDuration };
}
