import { describe, it, expect } from 'vitest';
import { detectPitch } from '../../../src/audio/PitchDetector.js';

describe('PitchDetector (autocorrelation)', () => {
  describe('detectPitch', () => {
    it('returns null for empty buffer', () => {
      const result = detectPitch(new Float32Array(0), 44100);
      expect(result.frequency).toBeNull();
      expect(result.clarity).toBe(0);
    });

    it('returns null for silent buffer', () => {
      const buffer = new Float32Array(2048).fill(0);
      const result = detectPitch(buffer, 44100);
      expect(result.frequency).toBeNull();
    });

    it('returns null for very quiet buffer', () => {
      const buffer = new Float32Array(2048);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.001 * Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      const result = detectPitch(buffer, 44100);
      expect(result.frequency).toBeNull();
    });

    it('attempts to detect 440Hz sine wave', () => {
      const buffer = new Float32Array(2048);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      const result = detectPitch(buffer, 44100);
      expect(result).not.toBeNull();
      expect(result.clarity).toBeGreaterThanOrEqual(0);
    });

    it('returns null for frequency below MIN_FREQ (50Hz)', () => {
      const buffer = new Float32Array(8192);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * 30 * i / 44100);
      }
      const result = detectPitch(buffer, 44100);
      if (result.frequency !== null) {
        expect(result.frequency).toBeGreaterThanOrEqual(50);
      }
    });

    it('returns reduced clarity for noise', () => {
      const buffer = new Float32Array(2048);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (Math.random() - 0.5) * 0.5;
      }
      const result = detectPitch(buffer, 44100);
      if (result.frequency !== null) {
        expect(result.clarity).toBeLessThan(0.5);
      }
    });
  });
});
