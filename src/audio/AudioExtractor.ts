import type { AudioFeatures } from './types.js';
import { Logger } from '../utils/Logger.js';

/**
 * Meyda extraction result with known feature types
 */
interface MeydaExtractResult {
  rms?: unknown;
  energy?: unknown;
  spectralCentroid?: unknown;
  spectralFlatness?: unknown;
  zcr?: unknown;
  mfcc?: unknown;
  loudness?: unknown;
  chroma?: unknown;
  perceptualSharpness?: unknown;
  [key: string]: unknown;
}

/**
 * Meyda module interface for type-safe access
 */
interface MeydaModule {
  bufferSize: number;
  extract: (features: readonly string[], buffer: Float32Array) => MeydaExtractResult | null;
}

/**
 * Loudness result from Meyda extract
 */
interface LoudnessResult {
  total?: number;
  specific?: number[];
}

/** Type guard for LoudnessResult */
function isLoudnessResult(value: unknown): value is LoudnessResult {
  return typeof value === 'object' && value !== null && 'total' in value;
}

/** Safely extract number from unknown value */
function extractNumber(value: unknown, defaultValue = 0): number {
  return typeof value === 'number' ? value : defaultValue;
}

/** Safely extract number array from unknown value */
function extractNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : [];
}

/**
 * Synchronous Meyda access. On first call this performs a dynamic
 * import and caches the result. Subsequent calls are synchronous
 * because the module is already cached by Node's module system.
 *
 * We use a two-phase approach: the first call triggers the async load,
 * but for the synchronous `extractFeatures` API we fall back to a
 * require-based path.
 */
let MeydaSync: MeydaModule | null = null;
let meydaLoaded = false;

function getMeydaSync(): MeydaModule | null {
  if (meydaLoaded) return MeydaSync;
  try {
    // Dynamic require via createRequire for ESM compatibility
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRequire } = require('module') as { createRequire: (url: string) => (id: string) => unknown };
    const req = createRequire(import.meta.url);
    const mod = req('meyda') as { default?: MeydaModule } & MeydaModule;
    MeydaSync = mod.default ?? mod;
    meydaLoaded = true;
    return MeydaSync;
  } catch (err) {
    Logger.warn('AudioExtractor', 'Meyda not available. Audio features will return defaults. Install with: npm install meyda');
    return null;
  }
}

/** Default values when extraction fails or buffer is too short. */
const DEFAULTS: AudioFeatures = {
  rms: 0,
  energy: 0,
  spectralCentroid: 0,
  spectralFlatness: 0,
  zcr: 0,
  mfcc: [],
  loudness: -100,
  spectralFlux: 0,
  chroma: new Float32Array(12),
  perceptualSharpness: 0,
};

/** Feature names for Meyda extraction */
const FEATURES = [
  'rms',
  'energy',
  'spectralCentroid',
  'spectralFlatness',
  'zcr',
  'mfcc',
  'loudness',
  'chroma',
  'perceptualSharpness',
] as const;

/**
 * Extract audio features from a mono Float32Array sample buffer using Meyda.
 *
 * @param buffer - Mono audio samples (Float32Array, typically 512-2048 samples).
 * @returns AudioFeatures with all fields populated, or defaults on failure.
 */
export function extractFeatures(buffer: Float32Array): AudioFeatures {
  if (buffer.length < 2) return { ...DEFAULTS, chroma: new Float32Array(12) };

  const M = getMeydaSync();
  if (!M) return { ...DEFAULTS, chroma: new Float32Array(12) };

  try {
    // Meyda requires bufferSize to match the input buffer length
    if (M.bufferSize !== buffer.length) {
      M.bufferSize = buffer.length;
    }

    // spectralFlux requires previous spectrum state, so we exclude it
    // from the single-frame extraction and default to 0.
    const result = M.extract(FEATURES, buffer);

    if (!result) return { ...DEFAULTS, chroma: new Float32Array(12) };

    // loudness is an object { total, specific } — extract the total value
    // and convert to a dB-like negative scale (Meyda returns positive loudness).
    const loudnessRaw = result.loudness;
    let loudnessTotal = 0;
    if (isLoudnessResult(loudnessRaw)) {
      loudnessTotal = loudnessRaw.total ?? 0;
    } else if (typeof loudnessRaw === 'number') {
      loudnessTotal = loudnessRaw;
    }
    // Convert to approximate dB scale.
    // Meyda's loudness.total is a sone-like positive value. We convert to a
    // dB-like scale relative to a reference that keeps typical signals negative,
    // matching the AudioFeatures contract ("perceived loudness in dB").
    const LOUDNESS_REFERENCE = 100;
    const loudnessDb = loudnessTotal > 0
      ? 20 * Math.log10(loudnessTotal / LOUDNESS_REFERENCE)
      : -100;

    const chromaArray = extractNumberArray(result.chroma);

    return {
      rms: extractNumber(result.rms),
      energy: extractNumber(result.energy),
      spectralCentroid: extractNumber(result.spectralCentroid),
      spectralFlatness: extractNumber(result.spectralFlatness),
      zcr: extractNumber(result.zcr),
      mfcc: extractNumberArray(result.mfcc),
      loudness: loudnessDb,
      spectralFlux: 0, // requires inter-frame state, not available in single-frame extraction
      chroma: chromaArray.length > 0
        ? new Float32Array(chromaArray)
        : new Float32Array(12),
      perceptualSharpness: extractNumber(result.perceptualSharpness),
    };
  } catch (err) {
    Logger.warn('AudioExtractor', 'Feature extraction failed, returning defaults:', err instanceof Error ? err.message : err);
    return { ...DEFAULTS, chroma: new Float32Array(12) };
  }
}
