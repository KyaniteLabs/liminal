import { describe, it, expect } from 'vitest';
import { estimateFormants, formantsToGeometry } from '../../../src/audio/FormantAnalyzer.js';

describe('FormantAnalyzer', () => {
  describe('estimateFormants', () => {
    it('returns defaults for empty MFCC array', () => {
      const result = estimateFormants([]);
      expect(result.f1).toBe(500);
      expect(result.f2).toBe(1500);
      expect(result.openness).toBe(0.5);
      expect(result.frontness).toBe(0.5);
      expect(result.phonemeCategory).toBe('neutral');
    });

    it('returns defaults for short MFCC array (< 6)', () => {
      const result = estimateFormants([1, 2, 3, 4, 5]);
      expect(result.f1).toBe(500);
      expect(result.openness).toBe(0.5);
    });

    it('estimates formants from valid MFCC data', () => {
      const mfcc = [1, 0, 5, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = estimateFormants(mfcc);
      expect(result.f1).toBeGreaterThanOrEqual(200);
      expect(result.f1).toBeLessThanOrEqual(1000);
      expect(result.f2).toBeGreaterThanOrEqual(600);
      expect(result.f2).toBeLessThanOrEqual(2800);
      expect(result.openness).toBeGreaterThanOrEqual(0);
      expect(result.openness).toBeLessThanOrEqual(1);
    });

    it('classifies open-front vowels', () => {
      const mfcc = [1, -5, 5, 8, 5, 3, 0];
      const result = estimateFormants(mfcc);
      expect(result.phonemeCategory).toBe('open-front');
    });

    it('classifies open-back vowels', () => {
      const mfcc = [1, -5, 5, -5, -3, -2, 0];
      const result = estimateFormants(mfcc);
      expect(result.phonemeCategory).toBe('open-back');
    });

    it('classifies closed-front vowels', () => {
      const mfcc = [1, 5, -5, 5, 3, 2, 0];
      const result = estimateFormants(mfcc);
      expect(result.phonemeCategory).toBe('closed-front');
    });

    it('classifies closed-back vowels', () => {
      const mfcc = [1, 5, -5, -5, -3, -2, 0];
      const result = estimateFormants(mfcc);
      expect(result.phonemeCategory).toBe('closed-back');
    });
  });

  describe('formantsToGeometry', () => {
    it('maps neutral formants to mid-range geometry', () => {
      const formants = { f1: 500, f2: 1500, openness: 0.5, frontness: 0.5, phonemeCategory: 'neutral' as const };
      const geometry = formantsToGeometry(formants);
      expect(geometry.heightMultiplier).toBeCloseTo(1.25, 1);
      expect(geometry.taperRatio).toBeCloseTo(0.65, 1);
      expect(geometry.roundness).toBeCloseTo(0.6, 1);
    });

    it('maps open vowels to taller shapes', () => {
      const formants = { f1: 900, f2: 1500, openness: 1.0, frontness: 0.5, phonemeCategory: 'open-front' as const };
      const geometry = formantsToGeometry(formants);
      expect(geometry.heightMultiplier).toBe(2.0);
    });

    it('maps closed vowels to shorter shapes', () => {
      const formants = { f1: 250, f2: 1500, openness: 0.0, frontness: 0.5, phonemeCategory: 'closed-front' as const };
      const geometry = formantsToGeometry(formants);
      expect(geometry.heightMultiplier).toBe(0.5);
    });

    it('maps front vowels to high taper ratio', () => {
      const formants = { f1: 500, f2: 2500, openness: 0.5, frontness: 1.0, phonemeCategory: 'open-front' as const };
      const geometry = formantsToGeometry(formants);
      expect(geometry.taperRatio).toBe(1.0);
    });

    it('maps back vowels to low taper ratio', () => {
      const formants = { f1: 500, f2: 800, openness: 0.5, frontness: 0.0, phonemeCategory: 'open-back' as const };
      const geometry = formantsToGeometry(formants);
      expect(geometry.taperRatio).toBe(0.3);
    });
  });
});
