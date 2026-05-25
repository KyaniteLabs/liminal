const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a frequency in Hz to a MIDI note number.
 * A4 (440 Hz) maps to MIDI 69.
 */
export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Convert a MIDI note number to a frequency in Hz.
 * MIDI 69 maps to A4 (440 Hz).
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert a frequency in Hz to a human-readable note name with octave.
 * e.g. 440 → "A4", 261.63 → "C4"
 */
export function frequencyToNoteName(freq: number): string {
  const midi = Math.round(frequencyToMidi(freq));
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

/**
 * Clamp a frequency to the audible range [20, 8000] Hz.
 */
export function clampFrequency(freq: number): number {
  return Math.max(20, Math.min(8000, freq));
}
