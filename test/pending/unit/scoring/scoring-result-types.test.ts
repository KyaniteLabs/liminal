import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
}));

vi.mock('../../../src/core/CreativeEvaluator.js', () => ({
  CreativeEvaluator: {
    assess: vi.fn().mockReturnValue({
      score: 0.75,
      technicalScore: 0.8,
      creativeScore: 0.7,
      issues: [],
    }),
  },
}));

vi.mock('../../../src/aesthetic/AestheticCritic.js', () => ({
  AestheticCritic: vi.fn().mockImplementation(() => ({
    critique: vi.fn().mockReturnValue({ score: 0.6, passed: true, violations: [], timestamp: '' }),
    setLLMClient: vi.fn(),
  })),
}));

vi.mock('../../../src/swarm/HeuristicScorer.js', () => ({
  HeuristicScorer: {
    scoreOutput: vi.fn().mockReturnValue({
      constraint: 0.5,
      novelty: 0.6,
      length: 0.7,
      vocabulary: 0.4,
      codeStructure: 0.8,
    }),
  },
}));

vi.mock('../../../src/collab/Scoring.js', () => ({
  quickScore: vi.fn().mockReturnValue(0.65),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({ generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) }),
}));

// ── Imports ────────────────────────────────────────────────────────────

import { LLMScoringStrategy } from '../../../src/core/ScoringEngine.js';
import { FragmentScorer } from '../../../src/compost/FragmentScorer.js';
import { LLMError } from '../../../src/llm/errors.js';
import type { CompostFragment, CompostConfig } from '../../../src/compost/types.js';

// ── Helpers ────────────────────────────────────────────────────────────

function makeFragment(overrides: Partial<CompostFragment> = {}): CompostFragment {
  return {
    id: 'frag-1',
    source: 'test.txt',
    domain: 'text',
    layer: 'semantic',
    content: 'A creative fragment about shaders and music synthesis with novel cross-domain patterns',
    metadata: {
      fileType: 'txt',
      timestamp: new Date().toISOString(),
      hash: 'abc123',
      size: 100,
      extractedAt: new Date().toISOString(),
    },
    tags: ['shader', 'music', 'cross-domain'],
    ...overrides,
  };
}

function makeConfig(): CompostConfig {
  return {
    heapDir: '/tmp/heap',
    maxHeapSizeBytes: 1000000,
    digestDir: '/tmp/digest',
    seedDir: '/tmp/seeds',
    digestSchedule: 'manual',
    digestDayOfWeek: 1,
    soupEnabled: false,
    soupPopulationSize: 10,
    soupMaxStepsPerCycle: 50,
    soupSeedPromotionThreshold: 0.7,
    soupCycleIntervalMs: 1000,
    llm: { baseUrl: 'http://localhost:11434', model: 'test-model' },
    seedPromotionThreshold: 0.6,
    maxSeedsPerDigest: 20,
    nuggetRetentionDays: 30,
    lirEnabled: false,
    lirSummaryBudget: 1000,
    lirBatchSize: 5,
  };
}

function makeMockLLM() {
  return { generate: mockGenerate, generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) };
}

// ── LLMScoringStrategy.scoreWithResult() ──────────────────────────────

describe('LLMScoringStrategy.scoreWithResult()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok(score) when LLM returns valid JSON', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: '{"score": 0.82, "technical": 0.8, "creative": 0.9, "novelty": 0.7, "reasoning": "good", "suggestions": ["add depth"]}',
    });

    const strategy = new LLMScoringStrategy(makeMockLLM() as any);
    const result = await strategy.scoreWithResult({ output: 'glsl shader code' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.score).toBeCloseTo(0.82);
      expect(result.value.dimensions.technical).toBeCloseTo(0.8);
      expect(result.value.dimensions.creative).toBeCloseTo(0.9);
      expect(result.value.dimensions.novelty).toBeCloseTo(0.7);
      expect(result.value.strategy).toBe('llm');
      expect(result.value.issues).toEqual(['add depth']);
    }
  });

  it('returns err when LLM returns unsuccessful response', async () => {
    mockGenerate.mockResolvedValue({
      success: false,
      code: null,
    });

    const strategy = new LLMScoringStrategy(makeMockLLM() as any);
    const result = await strategy.scoreWithResult({ output: 'some code' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
      expect(result.error.retryable).toBe(true);
    }
  });

  it('returns err when LLM response has no parseable JSON', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: 'This is just plain text without any JSON structure at all',
    });

    const strategy = new LLMScoringStrategy(makeMockLLM() as any);
    const result = await strategy.scoreWithResult({ output: 'some code' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
      expect(result.error.message).toContain('could not parse');
    }
  });

  it('returns err when LLM throws an exception', async () => {
    mockGenerate.mockRejectedValue(new Error('network timeout'));

    const strategy = new LLMScoringStrategy(makeMockLLM() as any);
    const result = await strategy.scoreWithResult({ output: 'some code' });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
      expect(result.error.retryable).toBe(true);
    }
  });

  it('clamps scores to 0-1 range', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: '{"score": 1.5, "technical": -0.2, "creative": 2.0, "novelty": 0.5, "reasoning": "", "suggestions": []}',
    });

    const strategy = new LLMScoringStrategy(makeMockLLM() as any);
    const result = await strategy.scoreWithResult({ output: 'code' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.score).toBe(1);
      expect(result.value.dimensions.technical).toBe(0);
      expect(result.value.dimensions.creative).toBe(1);
    }
  });
});

// ── FragmentScorer.scoreLLM() ─────────────────────────────────────────

describe('FragmentScorer.scoreLLM()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok(score) when LLM returns valid score', async () => {
    const mockLLM = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        code: 'Here is the score: {"score": 7.5}',
      }),
    };

    const scorer = new FragmentScorer(makeConfig(), mockLLM as any);
    const result = await scorer.scoreLLM(makeFragment());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBeCloseTo(7.5);
    }
  });

  it('returns err when LLM returns unsuccessful response', async () => {
    const mockLLM = {
      generate: vi.fn().mockResolvedValue({
        success: false,
        code: '',
      }),
    generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }),
    };

    const scorer = new FragmentScorer(makeConfig(), mockLLM as any);
    const result = await scorer.scoreLLM(makeFragment());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
    }
  });

  it('returns err when no LLM client provided', async () => {
    const scorer = new FragmentScorer(makeConfig(), null as any);
    const result = await scorer.scoreLLM(makeFragment());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
      expect(result.error.retryable).toBe(false);
    }
  });

  it('returns err when LLM throws', async () => {
    const mockLLM = {
      generate: vi.fn().mockRejectedValue(new Error('connection refused'),
            generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true })),
    };

    const scorer = new FragmentScorer(makeConfig(), mockLLM as any);
    const result = await scorer.scoreLLM(makeFragment());

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LLMError);
      expect(result.error.retryable).toBe(true);
    }
  });

  it('clamps score to 0-10 range', async () => {
    const mockLLM = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        code: '{"score": 15.3}',
      }),
    };

    const scorer = new FragmentScorer(makeConfig(), mockLLM as any);
    const result = await scorer.scoreLLM(makeFragment());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(10);
    }
  });
});
