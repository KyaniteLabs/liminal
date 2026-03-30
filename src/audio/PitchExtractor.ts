import type { PitchData } from './types.js';
import { frequencyToMidi, frequencyToNoteName, clampFrequency } from './PitchUtils.js';

/**
 * pitchfinder YIN detector — loaded lazily to avoid top-level side-effects.
 */
let yinDetector: ((buffer: Float32Array) => number | null) | null = null;
let lastSampleRate = 0;

function getYinDetector(
  sampleRate: number,
): (buffer: Float32Array) => number | null {
  if (yinDetector && lastSampleRate === sampleRate) return yinDetector;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createRequire } = require('module') as any;
  const req = createRequire(import.meta.url);
  const pitchfinder = req('pitchfinder');
  yinDetector = pitchfinder.YIN({ sampleRate, threshold: 0.2 });
  lastSampleRate = sampleRate;
  return yinDetector!;
}

/**
 * Detect the fundamental pitch of a mono Float32Array sample buffer.
 *
 * @param buffer    - Mono audio samples (Float32Array, typically >= 2048 samples).
 * @param sampleRate - Sample rate in Hz (e.g. 44100).
 * @returns PitchData with frequency, clarity, midi, and noteName, or null for silence / no pitch.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): PitchData | null {
  // Check if buffer is mostly silence
  const rms = Math.sqrt(
    buffer.reduce((sum, s) => sum + s * s, 0) / buffer.length,
  );
  if (rms < 0.01) return null;

  try {
    const detect = getYinDetector(sampleRate);
    const freq = detect(buffer);

    if (!freq || freq < 20 || freq > 8000) return null;

    const clampedFreq = clampFrequency(freq);
    const midi = frequencyToMidi(clampedFreq);
    const noteName = frequencyToNoteName(clampedFreq);
    const clarity = Math.min(1, rms * 3); // rough clarity estimate

    return { frequency: clampedFreq, clarity, midi, noteName };
  } catch {
    return null;
  }
}
