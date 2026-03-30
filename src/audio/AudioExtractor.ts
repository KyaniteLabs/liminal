import type { AudioFeatures } from './types.js';

/**
 * Synchronous Meyda access. On first call this performs a dynamic
 * import and caches the result. Subsequent calls are synchronous
 * because the module is already cached by Node's module system.
 *
 * We use a two-phase approach: the first call triggers the async load,
 * but for the synchronous `extractFeatures` API we fall back to a
 * require-based path.
 */
let MeydaSync: any = null;
let meydaLoaded = false;

function getMeydaSync(): any {
  if (meydaLoaded) return MeydaSync;
  try {
    // Dynamic require via createRequire for ESM compatibility
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRequire } = require('module') as any;
    const req = createRequire(import.meta.url);
    const mod = req('meyda');
    MeydaSync = mod.default || mod;
    meydaLoaded = true;
    return MeydaSync;
  } catch {
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
    const features = [
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

    const result = M.extract(features, buffer);

    if (!result) return { ...DEFAULTS, chroma: new Float32Array(12) };

    // loudness is an object { total, specific } — extract the total value
    // and convert to a dB-like negative scale (Meyda returns positive loudness).
    const loudnessTotal =
      typeof result.loudness === 'object' && result.loudness !== null
        ? (result.loudness as any).total ?? 0
        : (result.loudness as number) ?? 0;
    // Convert to approximate dB scale.
    // Meyda's loudness.total is a sone-like positive value. We convert to a
    // dB-like scale relative to a reference that keeps typical signals negative,
    // matching the AudioFeatures contract ("perceived loudness in dB").
    const LOUDNESS_REFERENCE = 100;
    const loudnessDb = loudnessTotal > 0
      ? 20 * Math.log10(loudnessTotal / LOUDNESS_REFERENCE)
      : -100;

    return {
      rms: (result.rms as number) ?? 0,
      energy: (result.energy as number) ?? 0,
      spectralCentroid: (result.spectralCentroid as number) ?? 0,
      spectralFlatness: (result.spectralFlatness as number) ?? 0,
      zcr: (result.zcr as number) ?? 0,
      mfcc: Array.isArray(result.mfcc) ? (result.mfcc as number[]) : [],
      loudness: loudnessDb,
      spectralFlux: 0, // requires inter-frame state, not available in single-frame extraction
      chroma: result.chroma
        ? new Float32Array(result.chroma as number[])
        : new Float32Array(12),
      perceptualSharpness: (result.perceptualSharpness as number) ?? 0,
    };
  } catch {
    return { ...DEFAULTS, chroma: new Float32Array(12) };
  }
}
