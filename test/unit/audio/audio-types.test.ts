import { describe, it, expect } from 'vitest';
import type {
  AudioFeatures, PitchData, TimbreData,
  AudioAnalysisResult, VisualMappingParams
} from '../../../src/audio/types.js';

describe('Audio types', () => {
  it('AudioFeatures has required fields', () => {
    const features: AudioFeatures = {
      rms: 0.5, energy: 0.6, spectralCentroid: 2000,
      spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3],
      loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12),
      perceptualSharpness: 0.4
    };
    expect(features.rms).toBe(0.5);
    expect(features.mfcc).toHaveLength(3);
    expect(features.chroma).toHaveLength(12);
  });

  it('PitchData has required fields', () => {
    const pitch: PitchData = { frequency: 440, clarity: 0.95, midi: 69, noteName: 'A4' };
    expect(pitch.midi).toBe(69);
  });

  it('TimbreData has required fields', () => {
    const timbre: TimbreData = { brightness: 0.7, roughness: 0.3, warmth: 0.5, noisiness: 0.2 };
    expect(timbre.brightness).toBeGreaterThanOrEqual(0);
  });

  it('AudioAnalysisResult composes features, pitch, timbre', () => {
    const result: AudioAnalysisResult = {
      features: { rms: 0.5, energy: 0.6, spectralCentroid: 2000, spectralFlatness: 0.3, zcr: 100, mfcc: [1, 2, 3], loudness: -10, spectralFlux: 0.2, chroma: new Float32Array(12), perceptualSharpness: 0.4 },
      pitch: { frequency: 440, clarity: 0.95, midi: 69, noteName: 'A4' },
      timbre: { brightness: 0.7, roughness: 0.3, warmth: 0.5, noisiness: 0.2 },
      timestamp: Date.now()
    };
    expect(result.pitch?.noteName).toBe('A4');
  });

  it('VisualMappingParams maps audio to visual properties', () => {
    const params: VisualMappingParams = {
      palette: { hues: [0.1, 0.3], saturations: [0.5, 0.7], lightness: [0.6, 0.8] },
      motion: { speed: 0.5, turbulence: 0.3, rhythm: 'smooth' },
      form: { complexity: 0.6, sharpness: 0.4, scale: 0.7 },
      dynamics: { energy: 0.8, envelope: [0.5, 0.6, 0.7], onsets: [100, 500] },
      composition: { focalWeight: 0.6, balance: 0.5 }
    };
    expect(params.motion.rhythm).toBe('smooth');
  });
});
