/**
 * ConfidenceSynthesizer tests — behavioral assertions on critic score merging.
 *
 * Tests synthesize() with known inputs and checks specific output values.
 * Tests agreement detection, confidence calculation, and dimension merging.
 */
import { describe, it, expect } from 'vitest';
import { synthesize, isTrustworthy } from '../../../src/evaluation/ConfidenceSynthesizer.js';
import type { ScoringResult } from '../../../src/core/ScoringEngine.js';
import type { AestheticReport } from '../../../src/aesthetic/types.js';
import type { ConfidenceReport } from '../../../src/evaluation/types.js';

// ── Fixtures ──

function makeScoringResult(overrides: Partial<ScoringResult> = {}): ScoringResult {
  return {
    score: 0.8,
    dimensions: { technical: 0.85, creative: 0.75 },
    issues: [],
    strategy: 'comprehensive',
    ...overrides,
  };
}

function makeAestheticReport(overrides: Partial<AestheticReport> = {}): AestheticReport {
  return {
    score: 0.7,
    violations: [],
    passed: true,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('ConfidenceSynthesizer', () => {
  // ── synthesize() core ──

  describe('synthesize()', () => {
    it('produces correct quality from default weights', () => {
      const scoring = makeScoringResult({ score: 0.8 });
      const aesthetic = makeAestheticReport({ score: 0.6 });

      const report = synthesize(scoring, aesthetic);

      // Default: 0.6 * 0.8 + 0.4 * 0.6 = 0.48 + 0.24 = 0.72
      expect(report.quality).toBe(0.72);
    });

    it('produces correct quality from custom weights', () => {
      const scoring = makeScoringResult({ score: 1.0 });
      const aesthetic = makeAestheticReport({ score: 0.0 });

      const report = synthesize(scoring, aesthetic, { scoring: 0.8, aesthetic: 0.2 });

      // 0.8 * 1.0 + 0.2 * 0.0 = 0.8
      expect(report.quality).toBe(0.8);
    });

    it('detects consensus when scores are close', () => {
      const scoring = makeScoringResult({ score: 0.75 });
      const aesthetic = makeAestheticReport({ score: 0.80 });

      const report = synthesize(scoring, aesthetic);

      // Delta = 0.05, below 0.15 threshold
      expect(report.agreement).toBe('consensus');
      expect(report.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects minor divergence', () => {
      const scoring = makeScoringResult({ score: 0.8 });
      const aesthetic = makeAestheticReport({ score: 0.6 });

      const report = synthesize(scoring, aesthetic);

      // Delta = 0.2, between 0.15 and 0.3
      expect(report.agreement).toBe('minor-divergence');
      expect(report.confidence).toBeLessThan(0.9);
      expect(report.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('detects major divergence', () => {
      const scoring = makeScoringResult({ score: 0.9 });
      const aesthetic = makeAestheticReport({ score: 0.2 });

      const report = synthesize(scoring, aesthetic);

      // Delta = 0.7, above 0.3
      expect(report.agreement).toBe('major-divergence');
      expect(report.confidence).toBeLessThan(0.5);
    });

    it('merges dimensions from both sources', () => {
      const scoring = makeScoringResult({
        score: 0.7,
        dimensions: { technical: 0.8, creative: 0.6, novelty: 0.5 },
      });
      const aesthetic = makeAestheticReport({ score: 0.75 });

      const report = synthesize(scoring, aesthetic);

      const dimNames = report.dimensions.map(d => d.name);
      expect(dimNames).toContain('technical');
      expect(dimNames).toContain('creative');
      expect(dimNames).toContain('novelty');
      expect(dimNames).toContain('aesthetic');
    });

    it('labels dimension sources correctly', () => {
      const scoring = makeScoringResult({
        dimensions: { technical: 0.7 },
      });
      const aesthetic = makeAestheticReport({ score: 0.65 });

      const report = synthesize(scoring, aesthetic);

      const techDim = report.dimensions.find(d => d.name === 'technical');
      expect(techDim?.source).toBe('scoring-engine');

      const aestDim = report.dimensions.find(d => d.name === 'aesthetic');
      expect(aestDim?.source).toBe('aesthetic-critic');
    });

    it('merges issues from both sources', () => {
      const scoring = makeScoringResult({
        issues: ['Low code complexity', 'Repetitive patterns'],
      });
      const aesthetic = makeAestheticReport({
        violations: [
          { rule: 'color-contrast', severity: 'warning' as const, message: 'Low contrast ratio' },
          { rule: 'layout-balance', severity: 'error' as const, message: 'Unbalanced layout' },
        ],
      });

      const report = synthesize(scoring, aesthetic);

      expect(report.issues).toContain('Low code complexity');
      expect(report.issues).toContain('warning: Low contrast ratio');
      expect(report.issues).toContain('error: Unbalanced layout');
    });

    it('preserves raw results in report', () => {
      const scoring = makeScoringResult({ score: 0.8 });
      const aesthetic = makeAestheticReport({ score: 0.7 });

      const report = synthesize(scoring, aesthetic);

      expect(report.scoringResult.score).toBe(0.8);
      expect(report.aestheticReport.score).toBe(0.7);
    });

    it('clamps quality to 0-1 range', () => {
      const scoring = makeScoringResult({ score: 1.0 });
      const aesthetic = makeAestheticReport({ score: 1.0 });

      const report = synthesize(scoring, aesthetic);
      expect(report.quality).toBeLessThanOrEqual(1.0);
      expect(report.quality).toBeGreaterThanOrEqual(0.0);
    });
  });

  // ── isTrustworthy() ──

  describe('isTrustworthy()', () => {
    it('returns true for consensus results', () => {
      const report: ConfidenceReport = {
        confidence: 0.95,
        quality: 0.8,
        dimensions: [],
        agreement: 'consensus',
        issues: [],
        scoringResult: makeScoringResult(),
        aestheticReport: makeAestheticReport(),
      };
      expect(isTrustworthy(report)).toBe(true);
    });

    it('returns false for very low confidence', () => {
      const report: ConfidenceReport = {
        confidence: 0.15,
        quality: 0.5,
        dimensions: [],
        agreement: 'major-divergence',
        issues: [],
        scoringResult: makeScoringResult(),
        aestheticReport: makeAestheticReport(),
      };
      expect(isTrustworthy(report)).toBe(false);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty scoring dimensions', () => {
      const scoring = makeScoringResult({ dimensions: {} });
      const aesthetic = makeAestheticReport({ score: 0.5 });

      const report = synthesize(scoring, aesthetic);

      // Only the aesthetic dimension should be present
      expect(report.dimensions).toHaveLength(1);
      expect(report.dimensions[0].name).toBe('aesthetic');
    });

    it('handles undefined scoring dimension values', () => {
      const scoring = makeScoringResult({
        dimensions: { technical: 0.7, creative: undefined as any },
      });
      const aesthetic = makeAestheticReport({ score: 0.6 });

      const report = synthesize(scoring, aesthetic);

      // undefined dimension should be filtered out
      const dimNames = report.dimensions.map(d => d.name);
      expect(dimNames).not.toContain('creative');
      expect(dimNames).toContain('technical');
    });

    it('handles zero scores from both critics', () => {
      const scoring = makeScoringResult({ score: 0 });
      const aesthetic = makeAestheticReport({ score: 0 });

      const report = synthesize(scoring, aesthetic);

      expect(report.quality).toBe(0);
      expect(report.agreement).toBe('consensus'); // Both agree it's bad
    });

    it('handles perfect scores from both critics', () => {
      const scoring = makeScoringResult({ score: 1.0 });
      const aesthetic = makeAestheticReport({ score: 1.0 });

      const report = synthesize(scoring, aesthetic);

      expect(report.quality).toBe(1.0);
      expect(report.agreement).toBe('consensus');
    });
  });
});
