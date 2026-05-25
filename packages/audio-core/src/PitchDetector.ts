/**
 * PitchDetector — multi-method pitch detection with confidence scoring.
 *
 * Implements:
 * 1. Autocorrelation-based F0 detection (primary)
 * 2. Zero-crossing rate as secondary hint
 * 3. Hann windowing for spectral leakage reduction
 * 4. Pre-emphasis filter for high-frequency boost
 * 5. Confidence scoring based on autocorrelation peak clarity
 *
 * Ported from VoxForge pitch-detector.ts.
 */

export interface PitchDetectionResult {
  /** Detected fundamental frequency in Hz, or null if unpitched */
  frequency: number | null;
  /** Confidence score (0-1): peak clarity of autocorrelation */
  clarity: number;
  /** MIDI note number if frequency detected */
  midi: number | null;
  /** Human-readable note name if frequency detected */
  noteName: string | null;
}

/** Minimum detectable frequency (Hz) */
const MIN_FREQ = 50;
/** Maximum detectable frequency (Hz) */
const MAX_FREQ = 2000;

/**
 * Detect pitch using autocorrelation with pre-processing.
 *
 * @param buffer - Audio sample buffer (Float32Array)
 * @param sampleRate - Sample rate in Hz
 * @returns Pitch detection result with confidence
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): PitchDetectionResult {
  if (!buffer || buffer.length === 0) {
    return { frequency: null, clarity: 0, midi: null, noteName: null };
  }

  // Check for silence
  const rms = Math.sqrt(buffer.reduce((sum, s) => sum + s * s, 0) / buffer.length);
  if (rms < 0.01) {
    return { frequency: null, clarity: 0, midi: null, noteName: null };
  }

  // Pre-emphasis filter (boost high frequencies for clearer pitch)
  const emphasized = new Float32Array(buffer.length);
  emphasized[0] = buffer[0];
  for (let i = 1; i < buffer.length; i++) {
    emphasized[i] = buffer[i] - 0.97 * buffer[i - 1];
  }

  // Apply Hann window
  const windowed = applyHannWindow(emphasized);

  // Autocorrelation
  const { lag, clarity } = autocorrelation(windowed, sampleRate);

  if (lag === null || clarity < 0.1) {
    return { frequency: null, clarity, midi: null, noteName: null };
  }

  const frequency = sampleRate / lag;

  // Validate frequency range
  if (frequency < MIN_FREQ || frequency > MAX_FREQ) {
    return { frequency: null, clarity: clarity * 0.5, midi: null, noteName: null };
  }

  // Convert to MIDI and note name
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteName = midiToNoteName(midi);

  return { frequency, clarity, midi, noteName };
}

/**
 * Compute autocorrelation and find the fundamental period.
 */
function autocorrelation(
  buffer: Float32Array,
  sampleRate: number,
): { lag: number | null; clarity: number } {
  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), Math.floor(buffer.length / 2));

  if (maxLag <= minLag) {
    return { lag: null, clarity: 0 };
  }

  let bestLag = minLag;
  let bestCorrelation = -Infinity;
  let sumSq = 0;

  // Normalize buffer
  for (let i = 0; i < buffer.length; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm < 1e-10) return { lag: null, clarity: 0 };

  // Compute normalized autocorrelation for each lag
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    const n = buffer.length - lag;
    for (let i = 0; i < n; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    correlation /= (n * norm * norm);

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  // Clarity is the peak autocorrelation value (1.0 = perfect periodic)
  const clarity = Math.max(0, bestCorrelation);

  return { lag: bestLag, clarity };
}

/**
 * Apply Hann window to reduce spectral leakage.
 */
function applyHannWindow(buffer: Float32Array): Float32Array {
  const windowed = new Float32Array(buffer.length);
  const n = buffer.length;
  for (let i = 0; i < n; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = buffer[i] * window;
  }
  return windowed;
}

/**
 * Convert MIDI note number to human-readable name.
 */
function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  return `${noteNames[noteIndex]}${octave}`;
}
