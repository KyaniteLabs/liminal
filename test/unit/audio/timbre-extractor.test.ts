import { describe, it, expect } from 'vitest';
import { extractTimbre } from '../../../src/audio/TimbreExtractor.js';
import type { AudioFeatures } from '../../../src/audio/types.js';

function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    rms: 0.5, energy: 0.5, spectralCentroid: 3000,
    spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3],
    loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12),
    perceptualSharpness: 0.4, ...overrides
  };
}

describe('TimbreExtractor', () => {
  it('high spectral centroid + low flatness = bright timbre', () => {
    const timbre = extractTimbre(makeFeatures({ spectralCentroid: 7000, spectralFlatness: 0.1 }));
    expect(timbre.brightness).toBeGreaterThan(0.7);
  });

  it('high ZCR + high flatness = noisy timbre', () => {
    const timbre = extractTimbre(makeFeatures({ zcr: 500, spectralFlatness: 0.9 }));
    expect(timbre.noisiness).toBeGreaterThan(0.7);
  });

  it('high energy + low spectral centroid = warm timbre', () => {
    const timbre = extractTimbre(makeFeatures({ energy: 0.9, spectralCentroid: 800 }));
    expect(timbre.warmth).toBeGreaterThan(0.7);
  });

  it('all outputs clamped to [0, 1]', () => {
    const extreme = makeFeatures({ spectralCentroid: 50000, spectralFlatness: 10, zcr: 100000, energy: 10 });
    const timbre = extractTimbre(extreme);
    expect(timbre.brightness).toBeLessThanOrEqual(1);
    expect(timbre.roughness).toBeLessThanOrEqual(1);
    expect(timbre.warmth).toBeLessThanOrEqual(1);
    expect(timbre.noisiness).toBeLessThanOrEqual(1);
    expect(timbre.brightness).toBeGreaterThanOrEqual(0);
  });
});
