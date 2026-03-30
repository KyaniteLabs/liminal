import { describe, it, expect } from 'vitest';
import { detectPitch } from '../../../src/audio/PitchExtractor.js';

describe('PitchExtractor', () => {
  it('detects 440Hz sine wave as A4', () => {
    const buffer = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = detectPitch(buffer, 44100);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeCloseTo(440, -1); // within ~50Hz
    expect(result!.noteName).toBe('A4');
  });

  it('returns null for silent buffer', () => {
    const buffer = new Float32Array(2048);
    const result = detectPitch(buffer, 44100);
    expect(result).toBeNull();
  });

  it('detects 261.63Hz as C4', () => {
    const buffer = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) buffer[i] = Math.sin(2 * Math.PI * 261.63 * i / 44100);
    const result = detectPitch(buffer, 44100);
    expect(result).not.toBeNull();
    expect(result!.frequency).toBeCloseTo(261.63, -1);
  });
});
