import type { AudioFeatures, TimbreData } from './types.js';

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normalize(v: number, min: number, max: number): number {
  return clamp((v - min) / (max - min));
}

/**
 * Derive timbre characteristics from already-extracted audio features.
 *
 * This is a pure function with no external dependencies — it maps spectral
 * descriptors onto perceptual timbre axes.
 *
 * @param features - AudioFeatures from AudioExtractor.
 * @returns TimbreData with all values clamped to [0, 1].
 */
export function extractTimbre(features: AudioFeatures): TimbreData {
  return {
    brightness: normalize(features.spectralCentroid, 200, 8000),
    roughness: normalize(features.perceptualSharpness, 0, 1),
    warmth:
      normalize(features.energy, 0, 1) *
      (1 - normalize(features.spectralCentroid, 200, 8000)),
    noisiness:
      normalize(features.zcr, 0, 500) * 0.5 +
      normalize(features.spectralFlatness, 0, 1) * 0.5,
  };
}
