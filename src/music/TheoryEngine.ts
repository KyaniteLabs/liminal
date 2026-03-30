/**
 * TheoryEngine — Pure music theory utilities for scale, chord, and MIDI operations.
 *
 * Ported from Generative-Score-Lab (scales.ts + chords.ts).
 * No external dependencies. All functions are pure and deterministic.
 *
 * @module music/TheoryEngine
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The 12 chromatic note names using sharps.
 */
export const NOTES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

/**
 * Scale types mapped to their interval arrays (semitones from root).
 *
 * - **major** / **ionian**: W-W-H-W-W-W-H
 * - **minor** / **aeolian**: W-H-W-W-H-W-W
 * - **dorian**: W-H-W-W-W-H-W
 * - **phrygian**: H-W-W-W-H-W-W
 * - **lydian**: W-W-W-H-W-W-H
 * - **mixolydian**: W-W-H-W-W-H-W
 * - **locrian**: H-W-W-H-W-W-W
 * - **harmonicMinor**: W-H-W-W-H-m3-H
 * - **melodicMinor**: W-H-W-W-W-W-H  (ascending form)
 * - **pentatonicMajor**: W-W-m3-W-m3
 * - **pentatonicMinor**: m3-W-W-m3-W
 * - **blues**: m3-W-H-H-m3-W
 * - **chromatic**: all 12 semitones
 */
export const SCALE_INTERVALS: Record<string, readonly number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  minor:            [0, 2, 3, 5, 7, 8, 10],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  aeolian:          [0, 2, 3, 5, 7, 8, 10],
  locrian:          [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:     [0, 2, 3, 5, 7, 9, 11],
  pentatonicMajor:  [0, 2, 4, 7, 9],
  pentatonicMinor:  [0, 3, 5, 7, 10],
  blues:            [0, 3, 5, 6, 7, 10],
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;

/**
 * Chord types mapped to their interval arrays (semitones from root).
 */
export const CHORD_INTERVALS: Record<string, readonly number[]> = {
  major:      [0, 4, 7],
  minor:      [0, 3, 7],
  diminished: [0, 3, 6],
  augmented:  [0, 4, 8],
  major7:     [0, 4, 7, 11],
  minor7:     [0, 3, 7, 10],
  dominant7:  [0, 4, 7, 10],
} as const;

// ---------------------------------------------------------------------------
// Named chord progressions
// ---------------------------------------------------------------------------

/**
 * Degree-to-quality mapping for each degree of the major scale.
 * Index 0 = I, 1 = ii, 2 = iii, etc.
 */
const DEGREE_QUALITIES: readonly string[] = [
  'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
] as const;

/**
 * Common chord progressions expressed as scale degree indices (0-based).
 * Each entry is the degree index within a major key.
 */
const PROGRESSION_DEGREES: Record<string, readonly number[]> = {
  'I-IV-V-I':     [0, 3, 4, 0],
  'I-V-vi-IV':    [0, 4, 5, 3],
  'ii-V-I':       [1, 4, 0],
  'I-vi-IV-V':    [0, 5, 3, 4],
  'I-IV-I-V':     [0, 3, 0, 4],
} as const;

/**
 * The five built-in chord progression names.
 */
export const CHORD_PROGRESSIONS: readonly string[] = Object.keys(PROGRESSION_DEGREES);

// ---------------------------------------------------------------------------
// Note helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a note name (e.g. "C#", "Bb") to a chromatic index 0-11.
 * Accepts both sharp (#) and flat (b) spellings.
 *
 * @param note - Note name such as "C", "C#", "Db", "Bb"
 * @returns Chromatic index 0-11
 * @throws {Error} If the note name is unrecognised
 */
export function noteToIndex(note: string): number {
  // Normalise flats to sharps
  const flatToSharp: Record<string, string> = {
    Db: 'C#', Eb: 'D#', Fb: 'E',  Gb: 'F#',
    Ab: 'G#', Bb: 'A#', Cb: 'B',
  };
  const normalised = flatToSharp[note] ?? note;
  const idx = NOTES.indexOf(normalised);
  if (idx === -1) {
    throw new Error(`Unknown note name: "${note}"`);
  }
  return idx;
}

// ---------------------------------------------------------------------------
// MIDI conversions
// ---------------------------------------------------------------------------

/**
 * Convert a note name and octave to a MIDI note number.
 *
 * Standard tuning: A4 = 440 Hz = MIDI 69.
 * Middle C (C4) = MIDI 60.
 *
 * @param note   - Note name such as "C", "C#", "Db"
 * @param octave - Octave number (0-10 typically)
 * @returns MIDI note number (0-127)
 *
 * @example
 * ```ts
 * noteToMidi('A', 4)  // 69
 * noteToMidi('C', 4)  // 60
 * noteToMidi('C', -1) // 0
 * ```
 */
export function noteToMidi(note: string, octave: number): number {
  return noteToIndex(note) + (octave + 1) * 12;
}

/**
 * Convert a MIDI note number to a note name and octave.
 *
 * @param midi - MIDI note number (0-127)
 * @returns Object with `note` (e.g. "C#") and `octave` (e.g. 4)
 *
 * @example
 * ```ts
 * midiToNote(69)  // { note: 'A',  octave: 4 }
 * midiToNote(60)  // { note: 'C',  octave: 4 }
 * midiToNote(0)   // { note: 'C',  octave: -1 }
 * ```
 */
export function midiToNote(midi: number): { note: string; octave: number } {
  const noteIndex = ((midi % 12) + 12) % 12; // ensure positive modulo
  const octave = Math.floor(midi / 12) - 1;
  return { note: NOTES[noteIndex], octave };
}

// ---------------------------------------------------------------------------
// Scale operations
// ---------------------------------------------------------------------------

/**
 * Return all MIDI note numbers belonging to a scale within an octave range.
 *
 * @param root        - Root note name (e.g. "C", "F#")
 * @param scale       - Scale type name (must exist in {@link SCALE_INTERVALS})
 * @param startOctave - First octave to include
 * @param endOctave   - Last octave to include (inclusive)
 * @returns Sorted array of MIDI note numbers
 *
 * @example
 * ```ts
 * getScaleNotes('C', 'major', 4, 5)
 * // [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83]
 * ```
 */
export function getScaleNotes(
  root: string,
  scale: string,
  startOctave: number,
  endOctave: number,
): number[] {
  const intervals = SCALE_INTERVALS[scale];
  if (!intervals) {
    throw new Error(`Unknown scale type: "${scale}"`);
  }
  const rootIndex = noteToIndex(root);
  const notes: number[] = [];

  for (let octave = startOctave; octave <= endOctave; octave++) {
    const base = rootIndex + (octave + 1) * 12;
    for (const interval of intervals) {
      const midi = base + interval;
      if (midi >= 0 && midi <= 127) {
        notes.push(midi);
      }
    }
  }

  return notes.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Quantize
// ---------------------------------------------------------------------------

/**
 * Snap a MIDI note to the nearest note within a given scale.
 *
 * If the note is already in the scale it is returned unchanged.
 * For chromatic scales every note is in-scale so the input is always returned.
 *
 * @param midi       - Input MIDI note number
 * @param root       - Root note name
 * @param scale      - Scale type name
 * @param scaleNotes - Optional pre-computed scale notes (avoids recomputation)
 * @returns The nearest in-scale MIDI note number
 *
 * @example
 * ```ts
 * quantizeToScale(61, 'C', 'major')  // 60 or 62 (nearest)
 * quantizeToScale(60, 'C', 'major')  // 60 (already in scale)
 * ```
 */
export function quantizeToScale(
  midi: number,
  root: string,
  scale: string,
  scaleNotes?: number[],
): number {
  // Fast path for chromatic — everything is in-scale
  if (scale === 'chromatic') return midi;

  const notes = scaleNotes ?? expandScaleFullRange(root, scale);

  // If already in scale, return as-is
  if (notes.includes(midi)) return midi;

  // Find nearest by absolute distance; tie-break towards lower note
  let best = notes[0];
  let bestDist = Math.abs(midi - best);

  for (let i = 1; i < notes.length; i++) {
    const dist = Math.abs(midi - notes[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = notes[i];
    }
  }

  return best;
}

/**
 * Build the full 0-127 range of MIDI notes for a scale.
 * @internal
 */
function expandScaleFullRange(root: string, scale: string): number[] {
  const intervals = SCALE_INTERVALS[scale];
  if (!intervals) {
    throw new Error(`Unknown scale type: "${scale}"`);
  }
  const rootIndex = noteToIndex(root);
  const notes: number[] = [];

  for (let midi = 0; midi <= 127; midi++) {
    const semitonesFromRoot = ((midi - rootIndex) % 12 + 12) % 12;
    if ((intervals as readonly number[]).includes(semitonesFromRoot)) {
      notes.push(midi);
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Chord operations
// ---------------------------------------------------------------------------

/**
 * Return the MIDI note numbers for a chord rooted at the given note and octave.
 *
 * @param root   - Root note name (e.g. "C", "F#")
 * @param type   - Chord type name (must exist in {@link CHORD_INTERVALS})
 * @param octave - Octave for the root (default 4)
 * @returns Array of MIDI note numbers making up the chord
 *
 * @example
 * ```ts
 * getChordNotes('C', 'major', 4)       // [60, 64, 67]
 * getChordNotes('A', 'minor7', 3)      // [57, 60, 64, 67]
 * ```
 */
export function getChordNotes(
  root: string,
  type: string,
  octave: number = 4,
): number[] {
  const intervals = CHORD_INTERVALS[type];
  if (!intervals) {
    throw new Error(`Unknown chord type: "${type}"`);
  }
  const rootMidi = noteToMidi(root, octave);
  return intervals.map((interval: number) => rootMidi + interval);
}

// ---------------------------------------------------------------------------
// Chord progressions
// ---------------------------------------------------------------------------

/**
 * Get the scale degree notes (root + quality) for a given major key.
 *
 * @param key     - Key root note name
 * @param degree  - Scale degree index (0 = I, 1 = ii, ..., 6 = vii)
 * @returns Object with the root note name and chord quality
 * @internal
 */
function degreeToChord(
  key: string,
  degree: number,
): { root: string; type: string } {
  const keyIndex = noteToIndex(key);
  // Major scale intervals to find the root of each degree
  const majorIntervals = SCALE_INTERVALS.major;
  const semitones = majorIntervals[degree];
  const rootIndex = (keyIndex + semitones) % 12;
  return {
    root: NOTES[rootIndex],
    type: DEGREE_QUALITIES[degree],
  };
}

/**
 * Generate a chord progression by name in a given key.
 *
 * The progression is built from scale degrees of the major scale.
 * Each chord receives the quality (major/minor/diminished) that is
 * diatonic to the major scale.
 *
 * @param key            - Key root note name (e.g. "C", "G")
 * @param name           - Progression name (see {@link CHORD_PROGRESSIONS})
 * @param beatsPerChord  - Duration in beats per chord (default 4)
 * @returns Array of chord objects with root, type, and duration
 * @throws {Error} If the progression name is unknown
 *
 * @example
 * ```ts
 * generateProgression('C', 'I-IV-V-I', 4)
 * // [
 * //   { root: 'C',  type: 'major', duration: 4 },
 * //   { root: 'F',  type: 'major', duration: 4 },
 * //   { root: 'G',  type: 'major', duration: 4 },
 * //   { root: 'C',  type: 'major', duration: 4 },
 * // ]
 *
 * generateProgression('C', 'ii-V-I', 2)
 * // [
 * //   { root: 'D',  type: 'minor',      duration: 2 },
 * //   { root: 'G',  type: 'major',      duration: 2 },
 * //   { root: 'C',  type: 'major',      duration: 2 },
 * // ]
 * ```
 */
export function generateProgression(
  key: string,
  name: string,
  beatsPerChord: number = 4,
): Array<{ root: string; type: string; duration: number }> {
  const degrees = PROGRESSION_DEGREES[name];
  if (!degrees) {
    throw new Error(
      `Unknown progression: "${name}". ` +
      `Available: ${CHORD_PROGRESSIONS.join(', ')}`,
    );
  }

  return degrees.map((degree: number) => {
    const chord = degreeToChord(key, degree);
    return {
      root: chord.root,
      type: chord.type,
      duration: beatsPerChord,
    };
  });
}
