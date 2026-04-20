/**
 * PromotionGate tests — behavioral assertions on regression detection.
 */
import { describe, it, expect } from 'vitest';
import { PromotionGate } from '../../../src/release/PromotionGate.js';
import type { GoldenSuiteResult, GoldenCaseResult } from '../../../src/evaluation/types.js';

function makeCaseResult(caseId: string, score: number, minScore: number): GoldenCaseResult {
  return {
    caseId,
    candidate: { code: 'test' },
    judgment: {
      score,
      passed: score >= minScore,
      confidence: { confidence: 0.9, quality: score, dimensions: [], agreement: 'consensus', issues: [] },
      strategies: ['comprehensive'],
    },
    passed: score >= minScore,
    margin: Math.round((score - minScore) * 1000) / 1000,
  };
}

function makeSuiteResult(cases: GoldenCaseResult[]): GoldenSuiteResult {
  const passed = cases.filter(c => c.passed).length;
  return {
    suiteName: 'test-suite',
    caseResults: cases,
    passed,
    failed: cases.length - passed,
    total: cases.length,
    averageScore: cases.length > 0
      ? Math.round((cases.reduce((s, c) => s + c.judgment.score, 0) / cases.length) * 1000) / 1000
      : 0,
    suitePassed: cases.every(c => c.passed),
  };
}

describe('PromotionGate', () => {
  describe('check()', () => {
    it('passes when all cases pass and no regressions', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.8, 0.7),
        makeCaseResult('c2', 0.9, 0.7),
      ]));

      expect(result.passed).toBe(true);
      expect(result.regressions).toHaveLength(0);
      expect(result.metrics.passed).toBe(2);
    });

    it('blocks when any case fails its threshold', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.8, 0.7),
        makeCaseResult('c2', 0.5, 0.7),
      ]));

      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].caseId).toBe('c2');
    });

    it('detects regression from baseline', () => {
      const baselines = new Map([['c1', 0.9]]);
      const gate = new PromotionGate({ baselines });

      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.7, 0.6), // dropped 0.2 from baseline
      ]));

      expect(result.regressions).toHaveLength(1);
      expect(result.regressions[0].caseId).toBe('c1');
      expect(result.regressions[0].drop).toBe(0.2);
    });

    it('does not flag minor fluctuations as regression', () => {
      const baselines = new Map([['c1', 0.8]]);
      const gate = new PromotionGate({ baselines, regressionThreshold: 0.1 });

      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.75, 0.6), // dropped 0.05 — below threshold
      ]));

      expect(result.regressions).toHaveLength(0);
    });

    it('respects maxRegressions setting', () => {
      const baselines = new Map([['c1', 0.9], ['c2', 0.9]]);
      const gate = new PromotionGate({ baselines, maxRegressions: 1 });

      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.7, 0.6),
        makeCaseResult('c2', 0.7, 0.6),
      ]));

      // 2 regressions > maxRegressions(1) → blocked
      expect(result.passed).toBe(false);
      expect(result.regressions).toHaveLength(2);
    });

    it('blocks when average score is below minimum', () => {
      const gate = new PromotionGate({ minAverageScore: 0.8 });

      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.7, 0.6),
        makeCaseResult('c2', 0.7, 0.6),
      ]));

      // average = 0.7 < 0.8 → blocked
      expect(result.passed).toBe(false);
      expect(result.metrics.averageScore).toBe(0.7);
    });

    it('summary contains pass message when gate passes', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.8, 0.7),
      ]));

      expect(result.summary).toContain('PASSED');
    });

    it('summary contains block details when gate fails', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.5, 0.7),
      ]));

      expect(result.summary).toContain('BLOCKED');
      expect(result.summary).toContain('c1');
    });
  });

  describe('updateBaselines()', () => {
    it('stores scores as new baselines', () => {
      const gate = new PromotionGate();
      gate.updateBaselines(makeSuiteResult([
        makeCaseResult('c1', 0.85, 0.7),
        makeCaseResult('c2', 0.92, 0.7),
      ]));

      const baselines = gate.getBaselines();
      expect(baselines.get('c1')).toBe(0.85);
      expect(baselines.get('c2')).toBe(0.92);
    });
  });

  describe('edge cases', () => {
    it('handles empty suite result', () => {
      const gate = new PromotionGate({ minAverageScore: 0 });
      const result = gate.check(makeSuiteResult([]));

      expect(result.passed).toBe(true); // vacuously true
      expect(result.metrics.totalCases).toBe(0);
    });

    it('handles baselines for unknown case IDs', () => {
      const baselines = new Map([['unknown-case', 0.9]]);
      const gate = new PromotionGate({ baselines });

      const result = gate.check(makeSuiteResult([
        makeCaseResult('c1', 0.8, 0.7),
      ]));

      // unknown-case baseline is not in current results — no regression
      expect(result.regressions).toHaveLength(0);
    });

    it('handles NaN score — does not crash', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('nan-case', NaN, 0.7),
      ]));

      // NaN >= 0.7 is false, so it fails
      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
    });

    it('handles Infinity score — always passes threshold', () => {
      const gate = new PromotionGate();
      const result = gate.check(makeSuiteResult([
        makeCaseResult('inf-case', Infinity, 0.7),
      ]));

      expect(result.passed).toBe(true);
      expect(result.metrics.passed).toBe(1);
    });

    it('handles zero minScore — any positive score passes', () => {
      const gate = new PromotionGate({ minAverageScore: 0 });
      const result = gate.check(makeSuiteResult([
        makeCaseResult('zero-min', 0.001, 0),
      ]));

      expect(result.passed).toBe(true);
    });

    it('handles negative score with zero minScore', () => {
      const gate = new PromotionGate({ minAverageScore: -1 });
      const result = gate.check(makeSuiteResult([
        makeCaseResult('neg-score', -0.5, 0),
      ]));

      expect(result.passed).toBe(false);
    });
  });
});
