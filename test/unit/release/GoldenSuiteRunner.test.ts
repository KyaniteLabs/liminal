/**
 * GoldenSuiteRunner tests — behavioral assertions on suite execution.
 *
 * Mocks EvaluationFabric to test orchestration logic independently.
 */
import { describe, it, expect } from 'vitest';
import { GoldenSuiteRunner } from '../../../src/release/GoldenSuiteRunner.js';
import type { GoldenSuite } from '../../../src/evaluation/types.js';

// Helper: create a mock fabric that returns a fixed score
function createMockFabricRunner(score: number) {
  // We inject via (runner as any).fabric for unit testing
  return {
    evaluate: async () => ({
      judgment: {
        score,
        passed: score >= 0.6,
        confidence: { confidence: 0.9, quality: score, dimensions: [], agreement: 'consensus', issues: [] },
        strategies: ['comprehensive'],
      },
      durationMs: 10,
      timestamp: new Date().toISOString(),
    }),
  };
}

function makeSuite(cases: Array<{ id: string; minScore: number }>): GoldenSuite {
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

describe('GoldenSuiteRunner', () => {
  describe('run()', () => {
    it('evaluates each case and returns aggregate result', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.8);

      const suite = makeSuite([
        { id: 'case-1', minScore: 0.7 },
        { id: 'case-2', minScore: 0.7 },
      ]);
      const result = await runner.run(suite);

      expect(result.aggregate.total).toBe(2);
      expect(result.aggregate.passed).toBe(2);
      expect(result.aggregate.failed).toBe(0);
      expect(result.aggregate.suitePassed).toBe(true);
      expect(result.caseResults).toHaveLength(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeTruthy();
    });

    it('reports failures when score is below threshold', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.5);

      const suite = makeSuite([
        { id: 'case-1', minScore: 0.7 },
        { id: 'case-2', minScore: 0.4 },
      ]);
      const result = await runner.run(suite);

      expect(result.aggregate.passed).toBe(1);
      expect(result.aggregate.failed).toBe(1);
      expect(result.aggregate.suitePassed).toBe(false);
      expect(result.caseResults[0].passed).toBe(false);
      expect(result.caseResults[0].margin).toBe(-0.2); // 0.5 - 0.7
      expect(result.caseResults[1].passed).toBe(true);
    });

    it('uses custom candidates when provided', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.9);

      const suite = makeSuite([{ id: 'case-1', minScore: 0.7 }]);
      const candidates = new Map([
        ['case-1', { code: 'custom code here', prompt: 'test', domain: 'p5' }],
      ]);
      const result = await runner.run(suite, candidates);

      expect(result.caseResults[0].candidate.code).toBe('custom code here');
    });

    it('generates placeholder candidate when none provided', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.8);

      const suite = makeSuite([{ id: 'case-1', minScore: 0.7 }]);
      const result = await runner.run(suite);

      expect(result.caseResults[0].candidate.code).toContain('Generated for');
    });

    it('calculates correct average score', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.85);

      const suite = makeSuite([
        { id: 'case-1', minScore: 0.7 },
        { id: 'case-2', minScore: 0.7 },
        { id: 'case-3', minScore: 0.7 },
      ]);
      const result = await runner.run(suite);

      expect(result.aggregate.averageScore).toBe(0.85);
    });

    it('calls onCaseComplete callback for each case', async () => {
      const completed: Array<{ id: string; passed: boolean; score: number }> = [];
      const runner = new GoldenSuiteRunner({
        onCaseComplete: (id, passed, score) => completed.push({ id, passed, score }),
      });
      (runner as any).fabric = createMockFabricRunner(0.8);

      const suite = makeSuite([
        { id: 'case-1', minScore: 0.7 },
        { id: 'case-2', minScore: 0.9 },
      ]);
      await runner.run(suite);

      expect(completed).toHaveLength(2);
      expect(completed[0].id).toBe('case-1');
      expect(completed[0].passed).toBe(true);
      expect(completed[1].id).toBe('case-2');
      expect(completed[1].passed).toBe(false);
    });

    it('handles empty suite', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.7);

      const emptySuite: GoldenSuite = {
        name: 'empty',
        cases: [],
        createdAt: new Date().toISOString(),
      };
      const result = await runner.run(emptySuite);

      expect(result.aggregate.total).toBe(0);
      expect(result.aggregate.suitePassed).toBe(true);
      expect(result.aggregate.averageScore).toBe(0);
    });

    it('handles single case with minScore=0 — always passes', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.01);

      const suite = makeSuite([{ id: 'easy', minScore: 0 }]);
      const result = await runner.run(suite);

      expect(result.aggregate.passed).toBe(1);
      expect(result.aggregate.suitePassed).toBe(true);
      expect(result.caseResults[0].margin).toBe(0.01);
    });

    it('times out when evaluation exceeds timeoutMs', async () => {
      const runner = new GoldenSuiteRunner({ timeoutMs: 50 });
      (runner as any).fabric = {
        evaluate: async () => new Promise(resolve => setTimeout(resolve, 5000)),
      };

      const suite = makeSuite([{ id: 'timeout-case', minScore: 0.7 }]);
      await expect(runner.run(suite)).rejects.toThrow('timed out');
    });

    it('records durationMs even for failing cases', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.3);

      const suite = makeSuite([{ id: 'fail', minScore: 0.9 }]);
      const result = await runner.run(suite);

      expect(result.aggregate.suitePassed).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeTruthy();
    });

    it('populates fabricResults for each case', async () => {
      const runner = new GoldenSuiteRunner();
      (runner as any).fabric = createMockFabricRunner(0.8);

      const suite = makeSuite([
        { id: 'c1', minScore: 0.7 },
        { id: 'c2', minScore: 0.7 },
      ]);
      const result = await runner.run(suite);

      expect(result.fabricResults).toHaveLength(2);
      expect(result.fabricResults[0].judgment.score).toBe(0.8);
    });
  });
});
