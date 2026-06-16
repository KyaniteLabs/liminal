/**
 * BPMKeyDetector — detect tempo (BPM) and musical key from audio features.
 *
 * BPM detection uses onset-based autocorrelation on RMS energy envelopes.
 * Key detection uses chroma vector analysis (pitch class distribution).
 *
 * Ported from VoxForge BPM/Key detection logic.
 */

export interface TempoResult {
  /** Detected tempo in BPM */
  bpm: number;
  /** Confidence of detection (0-1) */
  confidence: number;
}

export interface KeyResult {
  /** Detected key (e.g., 'C major', 'A minor') */
  key: string;
  /** Root pitch class (0-11) */
  root: number;
  /** Mode: 'major' or 'minor' */
  mode: 'major' | 'minor';
  /** Confidence of detection (0-1) */
  confidence: number;
}

/** Krumhansl-Schmuckler key profiles for major and minor */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Detect BPM from a sequence of RMS energy values.
 *
 * Uses onset detection followed by autocorrelation of the onset
 * function to find the dominant periodicity.
 *
 * @param rmsValues - Array of RMS energy values (one per analysis frame)
 * @param hopDuration - Duration between frames in seconds
 * @returns Detected tempo with confidence
 */
export function detectBPM(rmsValues: number[], hopDuration: number = 0.01): TempoResult {
  if (rmsValues.length < 10) {
    return { bpm: 120, confidence: 0 }; // default fallback
  }

  // Compute spectral flux (onset detection function)
  const onsetFunction: number[] = [];
  for (let i = 1; i < rmsValues.length; i++) {
    onsetFunction.push(Math.max(0, rmsValues[i] - rmsValues[i - 1]));
  }

  // Autocorrelate the onset function
  const minBPM = 60;
  const maxBPM = 200;
  const minLag = Math.floor(60 / (maxBPM * hopDuration));
  const maxLag = Math.floor(60 / (minBPM * hopDuration));

  let bestLag = minLag;
  let bestCorrelation = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, onsetFunction.length / 2); lag++) {
    let correlation = 0;
    const n = onsetFunction.length - lag;
    for (let i = 0; i < n; i++) {
      correlation += onsetFunction[i] * onsetFunction[i + lag];
    }
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  const bpm = Math.round(60 / (bestLag * hopDuration));
  const confidence = Math.min(1, bestCorrelation / (rmsValues.length * 0.01));

  return { bpm: Math.max(minBPM, Math.min(maxBPM, bpm)), confidence };
}

/**
 * Detect musical key from a chroma vector (12 pitch class energies).
 *
 * Uses the Krumhansl-Schmuckler algorithm: correlates the chroma
 * vector against major and minor key profiles for all 24 keys,
 * and picks the highest correlation.
 *
 * @param chroma - 12-element chroma vector (pitch class energies)
 * @returns Detected key with confidence
 */
export function detectKey(chroma: number[]): KeyResult {
  if (!chroma || chroma.length < 12) {
    return { key: 'C major', root: 0, mode: 'major', confidence: 0 };
  }

  // Normalize chroma vector
  const chromaSum = chroma.reduce((a, b) => a + b, 0);
  if (chromaSum < 1e-10) {
    return { key: 'C major', root: 0, mode: 'major', confidence: 0 };
  }
  const normalizedChroma = chroma.map(c => c / chromaSum);

  let bestRoot = 0;
  let bestMode: 'major' | 'minor' = 'major';
  let bestCorrelation = -Infinity;

  // Test all 24 keys (12 major + 12 minor)
  for (let root = 0; root < 12; root++) {
    // Rotate chroma vector to test this root
    const rotated = new Array(12);
    for (let i = 0; i < 12; i++) {
      rotated[i] = normalizedChroma[(i + root) % 12];
    }

    // Correlate with major profile
    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr;
      bestRoot = root;
      bestMode = 'major';
    }

    // Correlate with minor profile
    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr;
      bestRoot = root;
      bestMode = 'minor';
    }
  }

  const key = `${NOTE_NAMES[bestRoot]} ${bestMode}`;
  const confidence = Math.max(0, bestCorrelation);

  return { key, root: bestRoot, mode: bestMode, confidence };
}

/**
 * Compute Pearson correlation coefficient between two arrays.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den < 1e-10 ? 0 : num / den;
}
