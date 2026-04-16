/**
 * EvaluationFabric tests — behavioral assertions on orchestrator.
 *
 * Mocks HybridJudge to test orchestration logic independently.
 * Every assertion checks specific expected values.
 */
import { describe, it, expect, vi } from 'vitest';
import { EvaluationFabric } from '../../../src/evaluation/EvaluationFabric.js';
import type { HybridJudgment, GoldenSuite, EvaluationCandidate } from '../../../src/evaluation/types.js';
import type { ConfidenceReport } from '../../../src/evaluation/types.js';
import type { ScoringResult } from '../../../src/core/ScoringEngine.js';
import type { AestheticReport } from '../../../src/aesthetic/types.js';

// ── Helpers ──

function makeJudgment(score: number, overrides: Partial<HybridJudgment> = {}): HybridJudgment {
  const scoringResult: ScoringResult = {
    score,
    dimensions: { technical: score },
    issues: [],
    strategy: 'comprehensive',
  };
  const aestheticReport: AestheticReport = {
    score,
    violations: [],
    passed: score >= 0.5,
    timestamp: Date.now(),
  };
  const confidence: ConfidenceReport = {
    confidence: 0.9,
    quality: score,
    dimensions: [{ name: 'technical', score, source: 'scoring-engine' }],
    agreement: 'consensus',
    issues: [],
    scoringResult,
    aestheticReport,
  };

  return {
    score,
    confidence,
    passed: score >= 0.6,
    strategies: ['comprehensive', 'aesthetic'],
    ...overrides,
  };
}

function makeGoldenSuite(cases: Array<{ id: string; minScore: number }>): GoldenSuite {
  return {
    name: 'test-suite',
    cases: cases.map(c => ({
      id: c.id,
      prompt: `Generate artifact for ${c.id}`,
      domain: 'p5',
      minScore: c.minScore,
      tags: ['test'],
    })),
    createdAt: new Date().toISOString(),
  };
}

/** Create a mock judge with a configurable score */
function createMockJudge(score: number) {
  return {
    judge: vi.fn(async () => makeJudgment(score)),
    setThreshold: vi.fn(),
  };
}

describe('EvaluationFabric', () => {
  // ── evaluate() ──

  describe('evaluate()', () => {
    it('returns judgment with timing metadata', async () => {
      const mockJudge = createMockJudge(0.8);
      const fabric = new EvaluationFabric();
      // Inject mock judge
      (fabric as any).judge = mockJudge;

      const result = await fabric.evaluate({ code: 'test code' });

      expect(result.judgment.score).toBe(0.8);
      expect(result.judgment.passed).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeTruthy();
    });

    it('does not include suite result for plain evaluation', async () => {
      const mockJudge = createMockJudge(0.8);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const result = await fabric.evaluate({ code: 'test code' });

      expect(result.suiteResult).toBeUndefined();
    });
  });

  // ── evaluateWithSuite() ──

  describe('evaluateWithSuite()', () => {
    it('returns suite result with per-case pass/fail', async () => {
      const mockJudge = createMockJudge(0.75);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const suite = makeGoldenSuite([
        { id: 'case-1', minScore: 0.7 }, // 0.75 >= 0.7 → pass
        { id: 'case-2', minScore: 0.8 }, // 0.75 < 0.8 → fail
      ]);

      const result = await fabric.evaluateWithSuite({ code: 'test' }, suite);

      expect(result.suiteResult).toBeDefined();
      expect(result.suiteResult!.suiteName).toBe('test-suite');
      expect(result.suiteResult!.total).toBe(2);
      expect(result.suiteResult!.passed).toBe(1);
      expect(result.suiteResult!.failed).toBe(1);
      expect(result.suiteResult!.suitePassed).toBe(false);
    });

    it('calculates average score across cases', async () => {
      const mockJudge = createMockJudge(0.9);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const suite = makeGoldenSuite([
        { id: 'case-1', minScore: 0.7 },
        { id: 'case-2', minScore: 0.7 },
        { id: 'case-3', minScore: 0.7 },
      ]);

      const result = await fabric.evaluateWithSuite({ code: 'test' }, suite);

      // All 3 cases get 0.9, so average = 0.9
      expect(result.suiteResult!.averageScore).toBe(0.9);
      expect(result.suiteResult!.suitePassed).toBe(true);
    });

    it('reports margin for each case', async () => {
      const mockJudge = createMockJudge(0.85);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const suite = makeGoldenSuite([{ id: 'case-1', minScore: 0.7 }]);

      const result = await fabric.evaluateWithSuite({ code: 'test' }, suite);

      const caseResult = result.suiteResult!.caseResults[0];
      expect(caseResult.margin).toBe(0.15); // 0.85 - 0.70
      expect(caseResult.passed).toBe(true);
    });

    it('reports negative margin for failing cases', async () => {
      const mockJudge = createMockJudge(0.5);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const suite = makeGoldenSuite([{ id: 'case-1', minScore: 0.8 }]);

      const result = await fabric.evaluateWithSuite({ code: 'test' }, suite);

      const caseResult = result.suiteResult!.caseResults[0];
      expect(caseResult.margin).toBe(-0.3); // 0.5 - 0.8
      expect(caseResult.passed).toBe(false);
    });
  });

  // ── quickScore() ──

  describe('quickScore()', () => {
    it('returns just the numeric score', async () => {
      const mockJudge = createMockJudge(0.65);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const score = await fabric.quickScore('some code');

      expect(score).toBe(0.65);
    });
  });

  // ── Config management ──

  describe('config management', () => {
    it('returns default config when none provided', () => {
      const fabric = new EvaluationFabric();
      const config = fabric.getConfig();

      expect(config.qualityThreshold).toBe(0.6);
      expect(config.scoringStrategy).toBe('comprehensive');
      expect(config.hybridWeights).toEqual({ code: 0.5, creative: 0.5 });
    });

    it('applies custom config', () => {
      const fabric = new EvaluationFabric({ qualityThreshold: 0.8 });
      const config = fabric.getConfig();

      expect(config.qualityThreshold).toBe(0.8);
    });

    it('allows runtime config updates', () => {
      const fabric = new EvaluationFabric();
      fabric.setConfig({ qualityThreshold: 0.9 });

      expect(fabric.getConfig().qualityThreshold).toBe(0.9);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty golden suite', async () => {
      const mockJudge = createMockJudge(0.7);
      const fabric = new EvaluationFabric();
      (fabric as any).judge = mockJudge;

      const emptySuite: GoldenSuite = {
        name: 'empty',
        cases: [],
        createdAt: new Date().toISOString(),
      };

      const result = await fabric.evaluateWithSuite({ code: 'test' }, emptySuite);

      expect(result.suiteResult!.total).toBe(0);
      expect(result.suiteResult!.suitePassed).toBe(true); // vacuously true
      expect(result.suiteResult!.averageScore).toBeNaN(); // 0/0
    });
  });
});
