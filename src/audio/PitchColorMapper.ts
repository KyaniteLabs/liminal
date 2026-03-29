/**
 * PitchColorMapper — maps musical pitch classes to HSL colors.
 *
 * Uses the chromatic circle where each of the 12 pitch classes
 * gets a 30° hue step: C=0°(Red), C#=30°, D=60°, D#=90°, E=120°(Yellow),
 * F=150°, F#=180°(Cyan), G=210°, G#=240°(Blue), A=270°, A#=300°(Purple), B=330°.
 *
 * Supports scale quantization to snap arbitrary frequencies to the nearest
 * scale degree before color mapping.
 *
 * Ported from voice-to-sculpture-app audioTheory.ts.
 */

/** Note names in chromatic order */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export type NoteName = (typeof NOTE_NAMES)[number];

/** HSL color representation */
export interface HSLColor {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

/** Common scale intervals as semitone offsets from root */
export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** Degrees per pitch class (360 / 12 = 30) */
const HUE_PER_SEMITONE = 30;

/**
 * Convert a frequency in Hz to a MIDI note number.
 * A4 (440 Hz) = MIDI 69.
 */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Get the pitch class (0-11) from a MIDI note number.
 */
export function midiToPitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

/**
 * Get the note name from a pitch class.
 */
export function pitchClassName(pitchClass: number): NoteName {
  return NOTE_NAMES[((pitchClass % 12) + 12) % 12];
}

/**
 * Map a pitch class (0-11) to a hue value (0-360).
 * C=0°, C#=30°, D=60°, ..., B=330°.
 */
export function pitchClassToHue(pitchClass: number): number {
  return ((pitchClass % 12) + 12) % 12 * HUE_PER_SEMITONE;
}

/**
 * Quantize a frequency to the nearest degree in a given scale.
 *
 * @param frequency - Input frequency in Hz
 * @param scale - Scale intervals (e.g., SCALES.major)
 * @param root - Root pitch class (0=C, 2=D, etc.)
 * @returns Quantized MIDI note number
 */
export function quantizeToScale(frequency: number, scale: number[], root: number = 0): number {
  const midi = frequencyToMidi(frequency);
  const roundedMidi = Math.round(midi);
  const pitchClass = midiToPitchClass(roundedMidi);

  // Transpose to root-relative pitch class
  const relative = ((pitchClass - root) % 12 + 12) % 12;

  // Find nearest scale degree
  let bestDegree = scale[0];
  let bestDistance = Math.abs(relative - scale[0]);

  for (const degree of scale) {
    const dist = Math.min(
      Math.abs(relative - degree),
      12 - Math.abs(relative - degree),
    );
    if (dist < bestDistance) {
      bestDistance = dist;
      bestDegree = degree;
    }
  }

  // Return the quantized MIDI note
  const octave = Math.floor(roundedMidi / 12);
  return octave * 12 + ((bestDegree + root) % 12);
}

/**
 * Map a frequency directly to an HSL color.
 *
 * @param frequency - Frequency in Hz
 * @param saturation - Saturation (0-1, default 0.8)
 * @param lightness - Lightness (0-1, default 0.55)
 * @returns HSL color
 */
export function frequencyToColor(
  frequency: number,
  saturation: number = 0.8,
  lightness: number = 0.55,
): HSLColor {
  const midi = frequencyToMidi(frequency);
  const pitchClass = midiToPitchClass(midi);
  const hue = pitchClassToHue(pitchClass);
  return { h: hue, s: saturation, l: lightness };
}

/**
 * Map a frequency to a scale-quantized HSL color.
 *
 * @param frequency - Frequency in Hz
 * @param scale - Scale name or interval array
 * @param root - Root pitch class (0=C)
 * @param saturation - Saturation (0-1)
 * @param lightness - Lightness (0-1)
 * @returns HSL color quantized to scale
 */
export function frequencyToScaleColor(
  frequency: number,
  scale: string | number[] = 'pentatonic',
  root: number = 0,
  saturation: number = 0.8,
  lightness: number = 0.55,
): HSLColor {
  const intervals = typeof scale === 'string' ? (SCALES[scale] ?? SCALES.chromatic) : scale;
  const quantizedMidi = quantizeToScale(frequency, intervals, root);
  const pitchClass = midiToPitchClass(quantizedMidi);
  const hue = pitchClassToHue(pitchClass);
  return { h: hue, s: saturation, l: lightness };
}

/**
 * Get a palette of colors for all notes in a scale.
 */
export function scaleToPalette(
  scale: string | number[] = 'pentatonic',
  root: number = 0,
  saturation: number = 0.8,
  lightness: number = 0.55,
): HSLColor[] {
  const intervals = typeof scale === 'string' ? (SCALES[scale] ?? SCALES.chromatic) : scale;
  return intervals.map(interval => {
    const pitchClass = (interval + root) % 12;
    return { h: pitchClassToHue(pitchClass), s: saturation, l: lightness };
  });
}
