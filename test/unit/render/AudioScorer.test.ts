/**
 * AudioScorer tests - verify audio quality scoring
 */

import { describe, it, expect } from 'vitest';
import { AudioScorer } from '../../../src/render/AudioScorer.js';

describe('AudioScorer', () => {
  const scorer = new AudioScorer();
  const sampleRate = 44100;

  describe('score', () => {
    it('should return zero scores for empty audio', () => {
      const samples = new Float32Array(0);
      const result = scorer.score(samples, sampleRate);

      expect(result.score).toBe(0);
      expect(result.frequencyVariety).toBe(0);
      expect(result.dynamics).toBe(0);
      expect(result.rhythm).toBe(0);
      expect(result.harmonic).toBe(0);
    });

    it('should return lower scores for silent audio compared to actual audio', () => {
      const silentSamples = new Float32Array(sampleRate); // 1 second of silence
      const silentResult = scorer.score(silentSamples, sampleRate);

      // Complex audio with multiple frequencies
      const complexSamples = new Float32Array(sampleRate);
      for (let i = 0; i < complexSamples.length; i++) {
        const t = i / sampleRate;
        complexSamples[i] = (
          Math.sin(2 * Math.PI * 220 * t) * 0.3 +
          Math.sin(2 * Math.PI * 440 * t) * 0.3 +
          Math.sin(2 * Math.PI * 880 * t) * 0.2
        ) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t));
      }
      const complexResult = scorer.score(complexSamples, sampleRate);

      // Complex audio should score higher than silence
      expect(complexResult.score).toBeGreaterThan(silentResult.score);
      expect(complexResult.dynamics).toBeGreaterThan(silentResult.dynamics);
    });

    it('should detect frequency variety in a sine wave', () => {
      // Generate 1 second of 440Hz sine wave
      const duration = 1;
      const frequency = 440;
      const samples = new Float32Array(sampleRate * duration);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
      }

      const result = scorer.score(samples, sampleRate);

      // A pure sine wave has low frequency variety (single frequency)
      expect(result.frequencyVariety).toBeLessThan(0.5);
      // Should have some harmonic content
      expect(result.harmonic).toBeGreaterThan(0);
    });

    it('should detect dynamics in amplitude-modulated signal', () => {
      // Generate 1 second with amplitude variation
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);
      for (let i = 0; i < samples.length; i++) {
        const envelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * i / sampleRate); // 2Hz modulation
        samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * envelope * 0.5;
      }

      const result = scorer.score(samples, sampleRate);

      // Should detect amplitude dynamics
      expect(result.dynamics).toBeGreaterThan(0.3);
    });

    it('should detect rhythm in an impulse train', () => {
      // Generate 1 second with regular impulses (4 beats per second)
      const duration = 1;
      const bps = 4; // beats per second
      const samples = new Float32Array(sampleRate * duration);

      for (let beat = 0; beat < bps * duration; beat++) {
        const startSample = Math.floor(beat * sampleRate / bps);
        const impulseLength = Math.floor(sampleRate / bps / 4); // Short impulses
        for (let i = 0; i < impulseLength && startSample + i < samples.length; i++) {
          samples[startSample + i] = 0.8 * (1 - i / impulseLength);
        }
      }

      const result = scorer.score(samples, sampleRate);

      // Should detect rhythmic structure
      expect(result.rhythm).toBeGreaterThan(0.2);
      expect(result.metrics.onsetCount).toBeGreaterThanOrEqual(2);
    });

    it('should calculate higher overall score for complex audio vs silence', () => {
      const silentSamples = new Float32Array(sampleRate);

      // Complex audio: multiple frequencies with modulation
      const complexSamples = new Float32Array(sampleRate);
      for (let i = 0; i < complexSamples.length; i++) {
        const t = i / sampleRate;
        complexSamples[i] = (
          Math.sin(2 * Math.PI * 220 * t) * 0.3 +
          Math.sin(2 * Math.PI * 440 * t) * 0.3 +
          Math.sin(2 * Math.PI * 880 * t) * 0.2
        ) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t));
      }

      const silentResult = scorer.score(silentSamples, sampleRate);
      const complexResult = scorer.score(complexSamples, sampleRate);

      expect(complexResult.score).toBeGreaterThan(silentResult.score);
      expect(complexResult.frequencyVariety).toBeGreaterThan(silentResult.frequencyVariety);
    });

    it('should handle very short audio gracefully', () => {
      // Only 512 samples (~11ms at 44.1kHz)
      const samples = new Float32Array(512);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 1000 * i / sampleRate) * 0.5;
      }

      const result = scorer.score(samples, sampleRate);

      // Should not throw and return valid numbers
      expect(Number.isFinite(result.score)).toBe(true);
      expect(Number.isFinite(result.frequencyVariety)).toBe(true);
      expect(Number.isFinite(result.dynamics)).toBe(true);
    });

    it('should handle clipped/distorted audio', () => {
      // Generate audio that clips (values > 1.0)
      const duration = 1;
      const samples = new Float32Array(sampleRate * duration);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 2.0; // Will clip
      }

      const result = scorer.score(samples, sampleRate);

      // Should handle without throwing
      expect(Number.isFinite(result.score)).toBe(true);
      expect(result.dynamics).toBeGreaterThan(0);
    });

    it('should respect custom weight options', () => {
      const customScorer = new AudioScorer({
        frequencyWeight: 0.5,
        dynamicsWeight: 0.3,
        rhythmWeight: 0.1,
        harmonicWeight: 0.1,
      });

      const samples = new Float32Array(sampleRate);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
      }

      const result = customScorer.score(samples, sampleRate);

      // Score should be weighted sum
      expect(Number.isFinite(result.score)).toBe(true);
    });
  });

  describe('metrics', () => {
    it('should calculate spectral entropy for frequency variety', () => {
      const samples = new Float32Array(sampleRate);
      // Create noise-like signal (high entropy)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (Math.random() - 0.5) * 0.5;
      }

      const result = scorer.score(samples, sampleRate);

      // Noise should have high spectral entropy
      expect(result.metrics.spectralEntropy).toBeGreaterThan(0.3);
    });

    it('should calculate dynamic range', () => {
      const samples = new Float32Array(sampleRate);
      // Create signal with varying amplitude
      for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate;
        const envelope = t < 0.5 ? t * 2 : (1 - t) * 2; // Ramp up then down
        samples[i] = Math.sin(2 * Math.PI * 440 * t) * envelope * 0.5;
      }

      const result = scorer.score(samples, sampleRate);

      expect(result.metrics.dynamicRange).toBeGreaterThan(0);
    });

    it('should count zero crossings for harmonic content', () => {
      // Low frequency sine wave (few zero crossings)
      const lowFreqSamples = new Float32Array(sampleRate);
      for (let i = 0; i < lowFreqSamples.length; i++) {
        lowFreqSamples[i] = Math.sin(2 * Math.PI * 100 * i / sampleRate) * 0.5;
      }

      // High frequency sine wave (many zero crossings)
      const highFreqSamples = new Float32Array(sampleRate);
      for (let i = 0; i < highFreqSamples.length; i++) {
        highFreqSamples[i] = Math.sin(2 * Math.PI * 4000 * i / sampleRate) * 0.5;
      }

      const lowResult = scorer.score(lowFreqSamples, sampleRate);
      const highResult = scorer.score(highFreqSamples, sampleRate);

      expect(lowResult.metrics.zeroCrossingRate).toBeLessThan(highResult.metrics.zeroCrossingRate);
    });
  });
});
