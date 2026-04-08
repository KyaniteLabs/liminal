import { describe, it, expect } from 'vitest';
import { detectBPM, detectKey } from '../../../src/audio/BPMKeyDetector.js';

describe('BPMKeyDetector', () => {
  describe('detectBPM', () => {
    it('returns default 120 BPM for short input', () => {
      const result = detectBPM([0.1, 0.2, 0.3], 0.01);
      expect(result.bpm).toBe(120);
      expect(result.confidence).toBe(0);
    });

    it('returns default for empty array', () => {
      const result = detectBPM([], 0.01);
      expect(result.bpm).toBe(120);
    });

    it('detects tempo from 120 BPM pattern', () => {
      const rmsValues: number[] = [];
      for (let i = 0; i < 500; i++) {
        const beat = i % 50 === 0 ? 1.0 : 0.1;
        rmsValues.push(beat);
      }
      const result = detectBPM(rmsValues, 0.01);
      expect(result.bpm).toBeGreaterThanOrEqual(60);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns BPM clamped to [60, 200]', () => {
      const rmsValues: number[] = [];
      for (let i = 0; i < 500; i++) {
        const beat = i % 10 === 0 ? 1.0 : 0.1;
        rmsValues.push(beat);
      }
      const result = detectBPM(rmsValues, 0.01);
      expect(result.bpm).toBeLessThanOrEqual(200);
      expect(result.bpm).toBeGreaterThanOrEqual(60);
    });
  });

  describe('detectKey', () => {
    it('returns default C major for empty chroma', () => {
      const result = detectKey([]);
      expect(result.key).toBe('C major');
      expect(result.confidence).toBe(0);
    });

    it('returns default for short chroma', () => {
      const result = detectKey([0.1, 0.2, 0.3]);
      expect(result.key).toBe('C major');
    });

    it('detects C major from C major triad', () => {
      const chroma = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
      const result = detectKey(chroma);
      expect(result.key).toBe('C major');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects A minor from A minor triad', () => {
      const chroma = [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
      const result = detectKey(chroma);
      expect(result.key).toBe('A minor');
    });

    it('handles zero-sum chroma gracefully', () => {
      const chroma = new Array(12).fill(0);
      const result = detectKey(chroma);
      expect(result.key).toBe('C major');
      expect(result.confidence).toBe(0);
    });
  });
});
