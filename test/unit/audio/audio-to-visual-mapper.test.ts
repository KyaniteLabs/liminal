import { describe, it, expect } from 'vitest';
import { mapToVisualParams } from '../../../src/audio/AudioToVisualMapper.js';
import type { AudioFeatures, PitchData, TimbreData } from '../../../src/audio/types.js';

function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    rms: 0.5, energy: 0.5, spectralCentroid: 3000,
    spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3, 4, 5],
    loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12),
    perceptualSharpness: 0.4, ...overrides
  };
}

function makePitch(overrides: Partial<PitchData> = {}): PitchData {
  return { frequency: 440, clarity: 0.9, midi: 69, noteName: 'A4', ...overrides };
}

function makeTimbre(overrides: Partial<TimbreData> = {}): TimbreData {
  return { brightness: 0.5, roughness: 0.3, warmth: 0.5, noisiness: 0.2, ...overrides };
}

describe('AudioToVisualMapper', () => {
  it('returns VisualMappingParams with all sub-objects', () => {
    const result = mapToVisualParams(makeFeatures(), makePitch(), makeTimbre());
    expect(result.palette).not.toBeNull();
    expect(result.motion).not.toBeNull();
    expect(result.form).not.toBeNull();
    expect(result.dynamics).not.toBeNull();
    expect(result.composition).not.toBeNull();
  });

  it('pitch maps to chromatic-circle hues via pitch class', () => {
    // 440Hz = A4 → pitch class 9 → hue 270° → normalized 0.75
    const result = mapToVisualParams(makeFeatures(), makePitch({ frequency: 440, midi: 69 }));
    expect(result.palette.hues[0]).toBeCloseTo(270 / 360, 1);
  });

  it('low C maps to red hue (pitch class 0 → 0°)', () => {
    // 130Hz ≈ C3 → pitch class 0 → hue 0°
    const result = mapToVisualParams(makeFeatures(), makePitch({ frequency: 130, midi: 48 }));
    expect(result.palette.hues[0]).toBeCloseTo(0, 1);
  });

  it('high energy maps to high dynamics.energy', () => {
    const result = mapToVisualParams(makeFeatures({ rms: 0.9, energy: 0.9 }), makePitch(), makeTimbre());
    expect(result.dynamics.energy).toBeGreaterThan(0.7);
  });

  it('high spectral flux maps to high turbulence', () => {
    const result = mapToVisualParams(makeFeatures({ spectralFlux: 0.9 }), makePitch(), makeTimbre());
    expect(result.motion.turbulence).toBeGreaterThan(0.5);
  });

  it('high spectral flatness maps to smooth form', () => {
    const result = mapToVisualParams(makeFeatures({ spectralFlatness: 0.9 }), makePitch(), makeTimbre());
    expect(result.form.sharpness).toBeLessThan(0.5); // flat = smooth
  });

  it('all outputs are clamped to [0, 1]', () => {
    const extreme = makeFeatures({ rms: 10, energy: 10, spectralCentroid: 50000, spectralFlatness: 10, zcr: 100000, loudness: 100, spectralFlux: 10, perceptualSharpness: 10 });
    const result = mapToVisualParams(extreme, makePitch({ frequency: 20000 }), makeTimbre({ brightness: 10, roughness: 10, warmth: 10, noisiness: 10 }));
    // Check numeric values in range
    const checkRange = (v: number) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); };
    checkRange(result.motion.speed);
    checkRange(result.motion.turbulence);
    checkRange(result.form.complexity);
    checkRange(result.form.sharpness);
    checkRange(result.form.scale);
    checkRange(result.dynamics.energy);
    checkRange(result.composition.focalWeight);
    checkRange(result.composition.balance);
  });

  it('null pitch produces sensible defaults', () => {
    const result = mapToVisualParams(makeFeatures(), null, makeTimbre());

    expect(result.palette.hues?.length).toBeGreaterThan(0);
  });

  it('rhythm is one of smooth, pulsing, chaotic', () => {
    const result = mapToVisualParams(makeFeatures(), makePitch(), makeTimbre());
    expect(['smooth', 'pulsing', 'chaotic']).toContain(result.motion.rhythm);
  });
});
