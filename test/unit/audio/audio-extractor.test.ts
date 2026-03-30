import { describe, it, expect } from 'vitest';
import { extractFeatures } from '../../../src/audio/AudioExtractor.js';

describe('AudioExtractor', () => {
  it('returns near-zero rms for silent buffer', () => {
    const buffer = new Float32Array(512);
    const result = extractFeatures(buffer);
    expect(result.rms).toBeLessThan(0.01);
    expect(result.energy).toBeLessThan(0.01);
  });

  it('returns non-zero features for a sine wave', () => {
    const buffer = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = extractFeatures(buffer);
    expect(result.rms).toBeGreaterThan(0);
    expect(result.spectralCentroid).toBeGreaterThan(0);
    expect(result.spectralFlatness).toBeGreaterThanOrEqual(0);
    expect(result.zcr).toBeGreaterThan(0);
    expect(result.loudness).toBeLessThan(0);
  });

  it('returns all required AudioFeatures fields', () => {
    const buffer = new Float32Array(512);
    for (let i = 0; i < 512; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = extractFeatures(buffer);
    expect(result).toHaveProperty('rms');
    expect(result).toHaveProperty('energy');
    expect(result).toHaveProperty('spectralCentroid');
    expect(result).toHaveProperty('spectralFlatness');
    expect(result).toHaveProperty('zcr');
    expect(result).toHaveProperty('mfcc');
    expect(result).toHaveProperty('loudness');
    expect(result).toHaveProperty('spectralFlux');
    expect(result).toHaveProperty('perceptualSharpness');
  });

  it('handles buffers of different valid lengths', () => {
    for (const len of [512, 1024, 2048]) {
      const buffer = new Float32Array(len).fill(0).map((_, i) => Math.sin(i * 0.1));
      const result = extractFeatures(buffer);
      expect(result.rms).toBeGreaterThanOrEqual(0);
    }
  });
});
