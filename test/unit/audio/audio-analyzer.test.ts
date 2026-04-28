import { describe, it, expect } from 'vitest';
import { AudioAnalyzer } from '../../../src/audio/AudioAnalyzer.js';

describe('AudioAnalyzer', () => {
  it('chains extractor, pitch, timbre into full result', () => {
    const analyzer = new AudioAnalyzer();
    const buffer = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = analyzer.analyze(buffer, 44100);
    expect(result.features.rms).toBeGreaterThan(0);
    expect(result.timbre.brightness).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('getVisualMapping returns VisualMappingParams', () => {
    const analyzer = new AudioAnalyzer();
    const buffer = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = analyzer.analyze(buffer, 44100);
    const mapping = analyzer.getVisualMapping(result);
    expect(mapping.palette).not.toBeNull();
    expect(mapping.motion).not.toBeNull();
    expect(mapping.form).not.toBeNull();
    expect(mapping.dynamics).not.toBeNull();
    expect(mapping.composition).not.toBeNull();
  });

  it('handles silent buffer gracefully', () => {
    const analyzer = new AudioAnalyzer();
    const buffer = new Float32Array(2048);
    const result = analyzer.analyze(buffer, 44100);
    expect(result.features.rms).toBeLessThan(0.01);
    expect(result.pitch).toBeNull();
  });
});
