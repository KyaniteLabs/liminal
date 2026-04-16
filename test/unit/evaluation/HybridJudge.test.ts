/**
 * HybridJudge tests — behavioral assertions on dual-path scoring.
 *
 * Mocks ScoringEngine and AestheticCritic to test synthesis logic.
 * Every assertion checks specific expected values.
 */
import { describe, it, expect, vi } from 'vitest';
import { HybridJudge } from '../../../src/evaluation/HybridJudge.js';
import type { EvaluationCandidate } from '../../../src/evaluation/types.js';
import type { ScoringResult, ScoringStrategy } from '../../../src/core/ScoringEngine.js';
import type { AestheticReport } from '../../../src/aesthetic/types.js';

// ── Mock Factories ──

function mockScoringEngine(score: number, overrides: Partial<ScoringResult> = {}): any {
  return {
    score: vi.fn(async (): Promise<ScoringResult> => ({
      score,
      dimensions: { technical: score * 0.9, creative: score * 1.1 },
      issues: [],
      strategy: 'comprehensive',
      ...overrides,
    })),
  };
}

function mockAestheticCritic(score: number, overrides: Partial<AestheticReport> = {}): any {
  return {
    critique: vi.fn((): AestheticReport => ({
      score,
      violations: [],
      passed: score >= 0.5,
      timestamp: Date.now(),
      ...overrides,
    })),
  };
}

const defaultCandidate: EvaluationCandidate = {
  code: 'function setup() { createCanvas(400, 400); }',
  prompt: 'create a p5 sketch',
  domain: 'p5',
};

describe('HybridJudge', () => {
  // ── judge() ──

  describe('judge()', () => {
    it('blends code and aesthetic scores with default weights', async () => {
      const engine = mockScoringEngine(0.8);
      const critic = mockAestheticCritic(0.6);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const result = await judge.judge(defaultCandidate);

      // Default weights: 0.5 code + 0.5 creative
      // synthesizer gets scoring=0.5, aesthetic=0.5
      // quality = 0.5*0.8 + 0.5*0.6 = 0.7
      expect(result.score).toBe(0.7);
      expect(result.confidence.quality).toBe(0.7);
    });

    it('passes when score meets threshold', async () => {
      const engine = mockScoringEngine(0.8);
      const critic = mockAestheticCritic(0.8);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic, threshold: 0.6 });

      const result = await judge.judge(defaultCandidate);

      expect(result.passed).toBe(true);
    });

    it('fails when score is below threshold', async () => {
      const engine = mockScoringEngine(0.3);
      const critic = mockAestheticCritic(0.3);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic, threshold: 0.6 });

      const result = await judge.judge(defaultCandidate);

      expect(result.passed).toBe(false);
    });

    it('reports both strategies used', async () => {
      const engine = mockScoringEngine(0.7);
      const critic = mockAestheticCritic(0.7);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const result = await judge.judge(defaultCandidate);

      expect(result.strategies).toContain('comprehensive');
      expect(result.strategies).toContain('aesthetic');
      expect(result.strategies).toHaveLength(2);
    });

    it('includes confidence report with dimensions', async () => {
      const engine = mockScoringEngine(0.75);
      const critic = mockAestheticCritic(0.65);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const result = await judge.judge(defaultCandidate);

      expect(result.confidence.dimensions.length).toBeGreaterThanOrEqual(1);
      expect(result.confidence.quality).toBeGreaterThan(0);
      expect(result.confidence.confidence).toBeGreaterThan(0);
    });

    it('calls scoring engine with correct input', async () => {
      const engine = mockScoringEngine(0.7);
      const critic = mockAestheticCritic(0.7);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic, strategy: 'creative' });

      await judge.judge(defaultCandidate);

      expect(engine.score).toHaveBeenCalledWith(
        expect.objectContaining({
          output: defaultCandidate.code,
          prompt: defaultCandidate.prompt,
        }),
        'creative',
      );
    });

    it('calls aesthetic critic with code', async () => {
      const engine = mockScoringEngine(0.7);
      const critic = mockAestheticCritic(0.7);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      await judge.judge(defaultCandidate);

      expect(critic.critique).toHaveBeenCalledWith(defaultCandidate.code);
    });
  });

  // ── judgeCodeOnly() ──

  describe('judgeCodeOnly()', () => {
    it('returns scoring-only result without aesthetic weight', async () => {
      const engine = mockScoringEngine(0.85);
      const critic = mockAestheticCritic(0.4);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const result = await judge.judgeCodeOnly(defaultCandidate);

      // Code-only: neutral aesthetic (0.5) with 0 weight → score = 0.85
      expect(result.score).toBe(0.85);
      expect(result.strategies).toHaveLength(1);
      expect(result.strategies).toContain('comprehensive');
    });

    it('does not call aesthetic critic', async () => {
      const engine = mockScoringEngine(0.7);
      const critic = mockAestheticCritic(0.7);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      await judge.judgeCodeOnly(defaultCandidate);

      expect(critic.critique).not.toHaveBeenCalled();
    });
  });

  // ── Custom weights ──

  describe('custom weights', () => {
    it('biases toward code with higher code weight', async () => {
      const engine = mockScoringEngine(1.0);
      const critic = mockAestheticCritic(0.0);
      const judge = new HybridJudge({
        scoringEngine: engine,
        aestheticCritic: critic,
        weights: { code: 0.8, creative: 0.2 },
      });

      const result = await judge.judge(defaultCandidate);

      // synthesizer gets scoring=0.8, aesthetic=0.2
      // quality = 0.8*1.0 + 0.2*0.0 = 0.8
      expect(result.score).toBe(0.8);
    });

    it('biases toward creative with higher creative weight', async () => {
      const engine = mockScoringEngine(0.0);
      const critic = mockAestheticCritic(1.0);
      const judge = new HybridJudge({
        scoringEngine: engine,
        aestheticCritic: critic,
        weights: { code: 0.2, creative: 0.8 },
      });

      const result = await judge.judge(defaultCandidate);

      // synthesizer gets scoring=0.2, aesthetic=0.8
      // quality = 0.2*0.0 + 0.8*1.0 = 0.8
      expect(result.score).toBe(0.8);
    });
  });

  // ── Threshold management ──

  describe('threshold management', () => {
    it('allows threshold updates', async () => {
      const engine = mockScoringEngine(0.5);
      const critic = mockAestheticCritic(0.5);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic, threshold: 0.6 });

      expect(judge.getThreshold()).toBe(0.6);

      judge.setThreshold(0.4);
      expect(judge.getThreshold()).toBe(0.4);

      const result = await judge.judge(defaultCandidate);
      expect(result.passed).toBe(true); // 0.5 >= 0.4
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles candidate without optional fields', async () => {
      const engine = mockScoringEngine(0.7);
      const critic = mockAestheticCritic(0.7);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const minimal: EvaluationCandidate = { code: 'print("hello")' };
      const result = await judge.judge(minimal);

      expect(result.score).toBe(0.7);
      expect(result.passed).toBe(true);
    });

    it('handles empty code', async () => {
      const engine = mockScoringEngine(0.0);
      const critic = mockAestheticCritic(0.0);
      const judge = new HybridJudge({ scoringEngine: engine, aestheticCritic: critic });

      const result = await judge.judge({ code: '' });

      expect(result.score).toBe(0);
      expect(result.passed).toBe(false);
    });
  });
});
