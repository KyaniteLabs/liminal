/**
 * Arpeggiator Generator
 *
 * Creates arpeggiated note sequences from a set of base pitches using
 * one of five modes: up, down, up-down, down-up, or random.
 *
 * Ported from Generative-Score-Lab (`src/lib/generators/arpeggiator.ts`),
 * refactored into a standalone pure function with no framework coupling.
 *
 * @module music/Arpeggiator
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The five supported arpeggiation modes.
 *
 * - `'up'`     — ascend through the base notes, then repeat from the bottom.
 * - `'down'`   — descend through the base notes, then repeat from the top.
 * - `'upDown'` — ascend then descend (excluding duplicated endpoints).
 * - `'downUp'` — descend then ascend (excluding duplicated endpoints).
 * - `'random'` — pick a random base note each step.
 */
export type ArpMode = 'up' | 'down' | 'upDown' | 'downUp' | 'random';

/**
 * Parameters that shape the arpeggio pattern.
 */
export interface ArpParams {
  /** Arpeggiation direction/mode. */
  mode: ArpMode;

  /**
   * Number of octaves the arpeggio spans (clamped to 1-4).
   * The caller is responsible for expanding `baseNotes` across the desired
   * octave range before passing them in.
   */
  octaveRange: number;

  /**
   * Subdivisions per beat (1-16).
   * Together with `totalNotes` this determines rhythmic density.
   */
  notesPerBeat: number;

  /**
   * MIDI pitch numbers that form the harmonic material of the arpeggio.
   * Typically the notes of a chord or scale, optionally spread across
   * multiple octaves by the caller.
   */
  baseNotes: number[];
}

/**
 * A single note event in the generated arpeggio.
 */
export interface ArpNote {
  /** Onset time in beats (0-based). */
  time: number;

  /** MIDI pitch number (0-127). */
  pitch: number;

  /** Duration in beats. */
  duration: number;

  /** Velocity / loudness (0-1). */
  velocity: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number into the inclusive range `[min, max]`.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and normalise `ArpParams`, returning a sanitised copy.
 *
 * @throws {Error} If `baseNotes` is empty.
 */
function validateParams(params: ArpParams): ArpParams {
  if (params.baseNotes.length === 0) {
    throw new Error('Arpeggiator requires at least one base note');
  }

  return {
    mode: params.mode,
    octaveRange: clamp(params.octaveRange, 1, 4),
    notesPerBeat: clamp(params.notesPerBeat, 1, 16),
    baseNotes: params.baseNotes,
  };
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Tile an array to reach the desired length by cycling from the start.
 *
 * @example
 * ```ts
 * repeatToArray([1, 2, 3], 7); // [1, 2, 3, 1, 2, 3, 1]
 * ```
 */
function repeatToArray(arr: readonly number[], length: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(arr[i % arr.length]);
  }
  return result;
}

/**
 * Build the single-cycle pitch sequence for a given mode.
 *
 * - `up`      → `[a, b, c]`
 * - `down`    → `[c, b, a]`
 * - `upDown`  → `[a, b, c, b]`  (up then back, excluding the repeated top)
 * - `downUp`  → `[c, b, a, b]`  (down then back, excluding the repeated bottom)
 * - `random`  → returns an empty array (handled separately)
 */
function buildCycle(notes: readonly number[], mode: ArpMode): number[] {
  switch (mode) {
    case 'up':
      return [...notes];

    case 'down':
      return [...notes].reverse();

    case 'upDown': {
      // Ascend through all notes, then descend skipping the top and bottom
      // to avoid duplicating the endpoints.
      // e.g. [C, E, G] -> [C, E, G, E]
      const ascending = [...notes];
      const descending = notes.slice(1, -1).reverse();
      return [...ascending, ...descending];
    }

    case 'downUp': {
      // Descend through all notes, then ascend skipping the bottom and top.
      // e.g. [C, E, G] -> [G, E, C, E]
      const descending = [...notes].reverse();
      const ascending = notes.slice(1, -1);
      return [...descending, ...ascending];
    }

    case 'random':
      return []; // handled in generateArpeggio

    default:
      return [...notes];
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate an arpeggiated note sequence.
 *
 * Given a set of base pitches, a mode, and timing information, this function
 * produces an array of {@link ArpNote} objects representing the arpeggio.
 *
 * The arpeggio cycles through the base notes according to the selected mode:
 *
 * | Mode       | Cycle pattern (for notes `[C, E, G]`) |
 * |------------|----------------------------------------|
 * | `up`       | `C E G  C E G  C E G ...`             |
 * | `down`     | `G E C  G E C  G E C ...`             |
 * | `upDown`   | `C E G E  C E G E  ...`               |
 * | `downUp`   | `G E C E  G E C E  ...`               |
 * | `random`   | random pick from `{C, E, G}` each step|
 *
 * @param params     - Arpeggio configuration (mode, base notes, etc.).
 * @param totalNotes - How many note events to generate.
 * @param noteDuration - Duration of each note in beats (e.g. `0.25` for
 *                       sixteenth notes at the given subdivision).
 * @returns An array of {@link ArpNote} objects sorted by `time`.
 *
 * @example
 * ```ts
 * const notes = generateArpeggio(
 *   { mode: 'up', octaveRange: 1, notesPerBeat: 4, baseNotes: [60, 64, 67] },
 *   32,
 *   0.25,
 * );
 * // notes.length === 32, each with time increasing by 0.25
 * ```
 */
export function generateArpeggio(
  params: ArpParams,
  totalNotes: number,
  noteDuration: number,
): ArpNote[] {
  const { mode, baseNotes } = validateParams(params);

  // Guard against zero-length output.
  if (totalNotes <= 0) {
    return [];
  }

  // Determine the pitch for each step.
  let pitches: number[];

  if (mode === 'random') {
    // Random mode: independently sample a base note for each step.
    pitches = Array.from({ length: totalNotes }, () => {
      const index = Math.floor(Math.random() * baseNotes.length);
      return baseNotes[index];
    });
  } else {
    // Deterministic modes: build one cycle and tile it.
    const cycle = buildCycle(baseNotes, mode);
    pitches = repeatToArray(cycle, totalNotes);
  }

  // Convert pitches to ArpNote objects.
  // Velocity is set to a fixed musical default (0.7). The caller can
  // post-process velocity if dynamics are needed.
  const noteOutputDuration = noteDuration * 0.8; // slight gap between notes
  const velocity = 0.7;

  const notes: ArpNote[] = pitches.map((pitch, index) => ({
    time: index * noteDuration,
    pitch,
    duration: noteOutputDuration,
    velocity,
  }));

  return notes;
}
