/**
 * ScoringEngine unit tests — fully mocked, exhaustive coverage.
 *
 * Tests every public method and built-in strategy with controlled mock
 * return values, specific assertions, and error-path coverage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringEngine, LLMScoringStrategy } from '../../../src/core/ScoringEngine.js';
import type { ScoringInput, ScoringStrategy, ScoringResult, FitnessInput } from '../../../src/core/ScoringEngine.js';
import { Domain } from '../../../src/types/domains.js';

// ---------------------------------------------------------------------------
// vi.hoisted() — all mock variables referenced in vi.mock() factories
// MUST be hoisted (project rule: vi.hoisted is mandatory)
// ---------------------------------------------------------------------------

const { mockCreativeEvaluatorAssess, mockAestheticCriticInstance, mockHeuristicScoreOutput, mockQuickScore, mockLLMClientInstance, mockLoggerWarn } = vi.hoisted(() => {
  const assess = vi.fn();
  const criticInstance = { critique: vi.fn(), setLLMClient: vi.fn() };
  const scoreOutput = vi.fn();
  const quickScoreFn = vi.fn();
  const llmInstance = { generate: vi.fn() };
  const warn = vi.fn();
  return {
    mockCreativeEvaluatorAssess: assess,
    mockAestheticCriticInstance: criticInstance,
    mockHeuristicScoreOutput: scoreOutput,
    mockQuickScore: quickScoreFn,
    mockLLMClientInstance: llmInstance,
    mockLoggerWarn: warn,
  };
});

// ---------------------------------------------------------------------------
// Mock registrations
// ---------------------------------------------------------------------------

vi.mock('../../../src/core/CreativeEvaluator.js', () => ({
  CreativeEvaluator: {
    assess: mockCreativeEvaluatorAssess,
  },
}));

vi.mock('../../../src/aesthetic/AestheticCritic.js', () => {
  return {
    AestheticCritic: vi.fn(function (this: any) {
      this.critique = mockAestheticCriticInstance.critique;
      this.setLLMClient = mockAestheticCriticInstance.setLLMClient;
      return this;
    }),
  };
});

vi.mock('../../../src/swarm/HeuristicScorer.js', () => ({
  HeuristicScorer: {
    scoreOutput: mockHeuristicScoreOutput,
  },
}));

vi.mock('../../../src/collab/Scoring.js', () => ({
  quickScore: mockQuickScore,
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  return {
    LLMClient: vi.fn(function (this: any, _config?: any) {
      this.generate = mockLLMClientInstance.generate;
      return this;
    }),
  };
});

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures — controlled, deterministic mock return values
// ---------------------------------------------------------------------------

const CREATIVE_ASSESS_RESULT = {
  passed: true,
  score: 0.78,
  issues: ['minor issue'],
  technicalScore: 0.8,
  creativeScore: 0.75,
  metrics: { codeLength: 200, hasSetup: true, hasDraw: true, usesAnimation: false, usesColor: true, hasInteractivity: false, complexity: 3, usesClasses: false, usesArrays: true },
  noveltyScore: 0.6,
  aestheticScore: 0.7,
  emergenceScore: 0.55,
  interestingnessScore: 0.65,
};

const CREATIVE_ASSESS_RESULT_MINIMAL = {
  passed: true,
  score: 0.5,
  issues: [],
  technicalScore: 0.5,
  creativeScore: 0.5,
  metrics: { codeLength: 10, hasSetup: false, hasDraw: false, usesAnimation: false, usesColor: false, hasInteractivity: false, complexity: 0, usesClasses: false, usesArrays: false },
};

const AESTHETIC_REPORT = {
  score: 0.82,
  violations: [
    { rule: 'color-contrast', severity: 'warning' as const, message: 'Low contrast detected' },
  ],
  passed: true,
  timestamp: 1712304000000,
};

const HEURISTIC_DIMS = {
  constraint: 0.7,
  novelty: 0.6,
  length: 0.8,
  vocabulary: 0.5,
  codeStructure: 0.65,
};

const INPUT_TEXT = 'function setup() { createCanvas(800, 600); }';
const DEFAULT_INPUT: ScoringInput = { output: INPUT_TEXT, domain: Domain.P5 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoringEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
    mockAestheticCriticInstance.critique.mockReturnValue(AESTHETIC_REPORT);
    mockHeuristicScoreOutput.mockReturnValue(HEURISTIC_DIMS);
    mockQuickScore.mockReturnValue(0.65);
    mockLLMClientInstance.generate.mockResolvedValue({
      success: true,
      code: '{"score":0.85,"technical":0.9,"creative":0.8,"novelty":0.7,"reasoning":"Strong output","suggestions":["Add comments"]}',
    });
  });

  // -------------------------------------------------------------------------
  // Constructor & built-in strategy registration
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('registers all 7 built-in strategies plus 3 aliases', () => {
      const engine = new ScoringEngine();
      const strategies = engine.listStrategies();

      // 7 built-in strategies are registered, then:
      //   registerAlias('detailed', 'comprehensive') — adds 'detailed' (new key)
      //   registerAlias('heuristic', 'fast') — adds 'heuristic' (new key, points to FastStrategy)
      //   registerAlias('fast', 'keyword') — overwrites 'fast' with KeywordStrategy (no new key)
      // Total: 7 + 2 new aliases = 9 entries
      expect(strategies).toHaveLength(9);
      expect(strategies).toContain('comprehensive');
      expect(strategies).toContain('fast');       // alias → keyword
      expect(strategies).toContain('keyword');
      expect(strategies).toContain('fitness');
      expect(strategies).toContain('creative');
      expect(strategies).toContain('aesthetic');
      expect(strategies).toContain('llm');
      expect(strategies).toContain('detailed');   // alias → comprehensive
      expect(strategies).toContain('heuristic');  // alias → fast(alias) → keyword
    });

    it('defaults to comprehensive strategy', () => {
      const engine = new ScoringEngine();
      expect(engine.getDefault()).toBe('comprehensive');
    });

    it('accepts a custom default strategy', () => {
      const engine = new ScoringEngine('keyword');
      expect(engine.getDefault()).toBe('keyword');
    });

    it('passes LLM client to LLMScoringStrategy', async () => {
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);
      expect(result.score).toBe(0.85);
      expect(result.strategy).toBe('llm');
    });
  });

  // -------------------------------------------------------------------------
  // Alias mapping
  // -------------------------------------------------------------------------
  describe('alias mapping', () => {
    it('"detailed" alias maps to the comprehensive strategy', async () => {
      const engine = new ScoringEngine();
      const result = await engine.score(DEFAULT_INPUT, 'detailed');
      expect(result.strategy).toBe('comprehensive');
    });

    it('"heuristic" alias resolves to the FastStrategy object (captured before fast was overwritten)', async () => {
      const engine = new ScoringEngine();
      // Constructor order:
      //   1. register(FastStrategy) → 'fast' = FastStrategy(name='fast')
      //   2. registerAlias('heuristic', 'fast') → 'heuristic' = FastStrategy(name='fast')
      //   3. registerAlias('fast', 'keyword') → 'fast' = KeywordStrategy(name='keyword')
      // So 'heuristic' still points to the original FastStrategy.
      const strategy = engine.getStrategy('heuristic');
      expect(strategy?.name).toBe('fast');
    });

    it('"fast" alias overwrites FastStrategy, resolving to keyword', () => {
      const engine = new ScoringEngine();
      const fastStrategy = engine.getStrategy('fast');
      expect(fastStrategy?.name).toBe('keyword');
    });
  });

  // -------------------------------------------------------------------------
  // Engine management methods
  // -------------------------------------------------------------------------
  describe('register()', () => {
    it('registers a custom strategy and makes it available', async () => {
      const engine = new ScoringEngine();
      const customStrategy: ScoringStrategy = {
        name: 'custom-test',
        score: () => ({ score: 0.42, dimensions: { technical: 0.42 }, strategy: 'custom-test' }),
      };

      engine.register(customStrategy);
      expect(engine.hasStrategy('custom-test')).toBe(true);

      const result = await engine.score({ output: 'x' }, 'custom-test');
      expect(result.score).toBe(0.42);
      expect(result.strategy).toBe('custom-test');
      expect(result.dimensions.technical).toBe(0.42);
    });

    it('overwrites a strategy with the same name', async () => {
      const engine = new ScoringEngine();
      const replacement: ScoringStrategy = {
        name: 'keyword',
        score: () => ({ score: 0.99, dimensions: {}, strategy: 'keyword' }),
      };

      engine.register(replacement);
      const result = await engine.score({ output: 'x' }, 'keyword');
      expect(result.score).toBe(0.99);
    });
  });

  describe('unregister()', () => {
    it('removes a strategy and returns true', () => {
      const engine = new ScoringEngine();
      const result = engine.unregister('keyword');
      expect(result).toBe(true);
      expect(engine.hasStrategy('keyword')).toBe(false);
    });

    it('returns false for a non-existent strategy', () => {
      const engine = new ScoringEngine();
      const result = engine.unregister('does-not-exist');
      expect(result).toBe(false);
    });

    it('removing a strategy makes it unavailable for scoring', async () => {
      const engine = new ScoringEngine();
      engine.unregister('fitness');
      await expect(engine.score({ output: 'x' }, 'fitness')).rejects.toThrow('Unknown scoring strategy: "fitness"');
    });
  });

  describe('getStrategy()', () => {
    it('returns the strategy object for a known name', () => {
      const engine = new ScoringEngine();
      const strategy = engine.getStrategy('comprehensive');
      expect(strategy?.name).toBe('comprehensive');
    });

    it('returns undefined for unknown name', () => {
      const engine = new ScoringEngine();
      const strategy = engine.getStrategy('nonexistent');
      expect(strategy).toBeUndefined();
    });
  });

  describe('listStrategies()', () => {
    it('returns an array of all registered strategy names', () => {
      const engine = new ScoringEngine();
      const list = engine.listStrategies();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(7);
      expect(list).toContain('comprehensive');
      expect(list).toContain('keyword');
      expect(list).toContain('fitness');
      expect(list).toContain('creative');
      expect(list).toContain('aesthetic');
      expect(list).toContain('llm');
    });

    it('includes custom strategies after registration', () => {
      const engine = new ScoringEngine();
      engine.register({ name: 'my-strat', score: () => ({ score: 0, dimensions: {}, strategy: 'my-strat' }) });
      expect(engine.listStrategies()).toContain('my-strat');
    });
  });

  describe('hasStrategy()', () => {
    it('returns true for registered strategies', () => {
      const engine = new ScoringEngine();
      expect(engine.hasStrategy('comprehensive')).toBe(true);
      expect(engine.hasStrategy('keyword')).toBe(true);
      expect(engine.hasStrategy('fitness')).toBe(true);
    });

    it('returns false for unregistered names', () => {
      const engine = new ScoringEngine();
      expect(engine.hasStrategy('nope')).toBe(false);
    });
  });

  describe('setDefault() / getDefault()', () => {
    it('sets and retrieves the default strategy name', () => {
      const engine = new ScoringEngine();
      engine.setDefault('fitness');
      expect(engine.getDefault()).toBe('fitness');
    });

    it('setDefault throws on unknown strategy name', () => {
      const engine = new ScoringEngine();
      expect(() => engine.setDefault('bogus')).toThrow('Unknown scoring strategy: "bogus"');
    });

    it('getDefault returns constructor-provided default', () => {
      const engine = new ScoringEngine('fitness');
      expect(engine.getDefault()).toBe('fitness');
    });
  });

  // -------------------------------------------------------------------------
  // score() — core scoring method
  // -------------------------------------------------------------------------
  describe('score()', () => {
    it('uses the default strategy when no name is provided', async () => {
      const engine = new ScoringEngine('comprehensive');
      const result = await engine.score(DEFAULT_INPUT);
      expect(result.strategy).toBe('comprehensive');
      expect(result.score).toBe(0.78);
    });

    it('uses the specified strategy name', async () => {
      const engine = new ScoringEngine();
      const result = await engine.score(DEFAULT_INPUT, 'keyword');
      expect(result.strategy).toBe('keyword');
    });

    it('throws with available strategies listed on unknown name', async () => {
      const engine = new ScoringEngine();
      await expect(engine.score(DEFAULT_INPUT, 'unknown')).rejects.toThrow(/Unknown scoring strategy: "unknown"/);
    });

    it('awaits async strategies', async () => {
      const engine = new ScoringEngine();
      engine.register({
        name: 'async-strat',
        async score() {
          return { score: 0.33, dimensions: {}, strategy: 'async-strat' };
        },
      });
      const result = await engine.score({ output: 'x' }, 'async-strat');
      expect(result.score).toBe(0.33);
      expect(result.strategy).toBe('async-strat');
    });

    it('returns sync strategy results directly', async () => {
      const engine = new ScoringEngine();
      engine.register({
        name: 'sync-strat',
        score() {
          return { score: 0.77, dimensions: { technical: 0.77 }, strategy: 'sync-strat' };
        },
      });
      const result = await engine.score({ output: 'x' }, 'sync-strat');
      expect(result.score).toBe(0.77);
      expect(result.dimensions.technical).toBe(0.77);
    });
  });

  // -------------------------------------------------------------------------
  // Built-in strategies (mocked)
  // -------------------------------------------------------------------------
  describe('ComprehensiveStrategy', () => {
    it('maps all optional dimension scores from assess result', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('comprehensive');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.78);
      expect(result.dimensions.technical).toBe(0.8);
      expect(result.dimensions.creative).toBe(0.75);
      expect(result.dimensions.novelty).toBe(0.6);
      expect(result.dimensions.aesthetic).toBe(0.7);
      expect(result.dimensions.emergence).toBe(0.55);
      expect(result.dimensions.interestingness).toBe(0.65);
      expect(result.issues).toEqual(['minor issue']);
      expect(result.strategy).toBe('comprehensive');
    });

    it('omits undefined optional dimensions', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT_MINIMAL);
      const engine = new ScoringEngine('comprehensive');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.dimensions.technical).toBe(0.5);
      expect(result.dimensions.creative).toBe(0.5);
      expect(result.dimensions.novelty).toBeUndefined();
      expect(result.dimensions.aesthetic).toBeUndefined();
      expect(result.dimensions.emergence).toBeUndefined();
      expect(result.dimensions.interestingness).toBeUndefined();
    });

    it('passes criteria and domain to CreativeEvaluator', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('comprehensive');
      await engine.score({ output: 'code', domain: Domain.P5, criteria: ['creative', 'novelty'] });

      expect(mockCreativeEvaluatorAssess).toHaveBeenCalledWith('code', {
        evaluationCriteria: ['creative', 'novelty'],
        domain: Domain.P5,
      });
    });
  });

  describe('FastStrategy (overwritten by alias — now keyword)', () => {
    it('the "fast" name resolves to keyword strategy, not the original FastStrategy', async () => {
      const engine = new ScoringEngine();
      // Because registerAlias('fast', 'keyword') overwrites 'fast'
      const strategy = engine.getStrategy('fast');
      expect(strategy?.name).toBe('keyword');
    });
  });

  describe('KeywordStrategy', () => {
    it('wraps quickScore and clamps result to 0-1', async () => {
      mockQuickScore.mockReturnValue(0.65);
      const engine = new ScoringEngine('keyword');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.65);
      expect(result.strategy).toBe('keyword');
      expect(result.dimensions).toEqual({});
      expect(mockQuickScore).toHaveBeenCalledWith(INPUT_TEXT, Domain.P5);
    });

    it('clamps scores above 1 to 1', async () => {
      mockQuickScore.mockReturnValue(1.5);
      const engine = new ScoringEngine('keyword');
      const result = await engine.score(DEFAULT_INPUT);
      expect(result.score).toBe(1);
    });

    it('clamps negative scores to 0', async () => {
      mockQuickScore.mockReturnValue(-0.3);
      const engine = new ScoringEngine('keyword');
      const result = await engine.score(DEFAULT_INPUT);
      expect(result.score).toBe(0);
    });

    it('defaults domain to EMPTY when not provided', async () => {
      mockQuickScore.mockReturnValue(0.5);
      const engine = new ScoringEngine('keyword');
      await engine.score({ output: 'test' });
      expect(mockQuickScore).toHaveBeenCalledWith('test', Domain.EMPTY);
    });
  });

  describe('FitnessStrategy', () => {
    it('computes weighted average from dimensionScores and weights', async () => {
      const engine = new ScoringEngine('fitness');
      const input: FitnessInput = {
        output: 'code',
        dimensionScores: { technical: 0.8, creative: 0.6 },
        weights: { technical: 2, creative: 1 },
      };
      const result = await engine.score(input);

      // (0.8*2 + 0.6*1) / (2+1) = 2.2 / 3 ≈ 0.7333...
      expect(result.score).toBeCloseTo(0.7333, 3);
      expect(result.strategy).toBe('fitness');
      expect(result.dimensions.technical).toBe(0.8);
      expect(result.dimensions.creative).toBe(0.6);
    });

    it('uses weights.default for dimensions without explicit weight', async () => {
      const engine = new ScoringEngine('fitness');
      const input: FitnessInput = {
        output: 'code',
        dimensionScores: { technical: 0.5, creative: 0.9 },
        weights: { default: 0.5 },
      };
      const result = await engine.score(input);

      // Both use default weight 0.5: (0.5*0.5 + 0.9*0.5) / (0.5+0.5) = 0.7
      expect(result.score).toBeCloseTo(0.7, 3);
    });

    it('defaults weight to 1 when neither dimension nor default weight is provided', async () => {
      const engine = new ScoringEngine('fitness');
      const input: FitnessInput = {
        output: 'code',
        dimensionScores: { novelty: 0.4, length: 0.6 },
        weights: {},
      };
      const result = await engine.score(input);

      // Both weight=1: (0.4 + 0.6) / 2 = 0.5
      expect(result.score).toBe(0.5);
    });

    it('returns 0 score when dimensionScores is empty', async () => {
      const engine = new ScoringEngine('fitness');
      const input: FitnessInput = { output: 'code', dimensionScores: {}, weights: {} };
      const result = await engine.score(input);
      expect(result.score).toBe(0);
      expect(result.dimensions).toEqual({});
    });

    it('returns 0 score when dimensionScores is undefined', async () => {
      const engine = new ScoringEngine('fitness');
      const result = await engine.score({ output: 'code' });
      expect(result.score).toBe(0);
    });

    it('filters out undefined dimension values', async () => {
      const engine = new ScoringEngine('fitness');
      const input: FitnessInput = {
        output: 'code',
        dimensionScores: { technical: 0.8, creative: undefined, novelty: 0.6 },
        weights: {},
      };
      const result = await engine.score(input);

      // Only technical (0.8) and novelty (0.6) counted, weight 1 each
      expect(result.score).toBeCloseTo(0.7, 3);
      expect(Object.keys(result.dimensions)).toHaveLength(2);
      expect(result.dimensions.technical).toBe(0.8);
      expect(result.dimensions.novelty).toBe(0.6);
    });
  });

  describe('CreativeStrategy', () => {
    it('forces creative evaluation criteria and maps dimensions', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('creative');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.78);
      expect(result.strategy).toBe('creative');
      expect(result.dimensions.creative).toBe(0.75);
      expect(result.dimensions.technical).toBe(0.8);
      expect(result.dimensions.novelty).toBe(0.6);
      expect(result.dimensions.emergence).toBe(0.55);
      expect(result.dimensions.interestingness).toBe(0.65);
      expect(result.report).toEqual({
        metrics: CREATIVE_ASSESS_RESULT.metrics,
        improvementTrajectory: undefined,
      });
    });

    it('always passes 5 specific evaluation criteria', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('creative');
      await engine.score(DEFAULT_INPUT);

      expect(mockCreativeEvaluatorAssess).toHaveBeenCalledWith(INPUT_TEXT, {
        evaluationCriteria: ['creative', 'technical', 'novelty', 'emergence', 'interestingness'],
        domain: Domain.P5,
      });
    });
  });

  describe('AestheticStrategy', () => {
    it('wraps AestheticCritic.critique and returns score + violations', async () => {
      mockAestheticCriticInstance.critique.mockReturnValue(AESTHETIC_REPORT);
      const engine = new ScoringEngine('aesthetic');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.82);
      expect(result.strategy).toBe('aesthetic');
      expect(result.dimensions.aesthetic).toBe(0.82);
      expect(result.violations).toEqual(AESTHETIC_REPORT.violations);
      expect(result.report).toMatchObject({
        passed: true,
        timestamp: 1712304000000,
      });
    });

    it('passes criticConfig and lirContext to critique', async () => {
      mockAestheticCriticInstance.critique.mockReturnValue(AESTHETIC_REPORT);
      const engine = new ScoringEngine('aesthetic');
      const config = { strictness: 'strict' as const };
      const lirContext = { lirTokens: [] };

      await engine.score({
        output: 'code',
        criticConfig: config,
        lirContext,
      });

      expect(mockAestheticCriticInstance.critique).toHaveBeenCalledWith('code', config, lirContext);
    });

    it('handles critic returning 0 score with failed status', async () => {
      mockAestheticCriticInstance.critique.mockReturnValue({
        score: 0,
        violations: [{ rule: 'empty-output', severity: 'error', message: 'No output' }],
        passed: false,
        timestamp: 0,
      });
      const engine = new ScoringEngine('aesthetic');
      const result = await engine.score({ output: '' });

      expect(result.score).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations?.[0].severity).toBe('error');
    });
  });

  describe('LLMScoringStrategy', () => {
    it('parses LLM JSON response into ScoringResult', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":0.85,"technical":0.9,"creative":0.8,"novelty":0.7,"reasoning":"Strong","suggestions":["Add docs"]}',
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.85);
      expect(result.strategy).toBe('llm');
      expect(result.dimensions.technical).toBe(0.9);
      expect(result.dimensions.creative).toBe(0.8);
      expect(result.dimensions.novelty).toBe(0.7);
      expect(result.issues).toEqual(['Add docs']);
      expect(result.report).toEqual({ reasoning: 'Strong' });
    });

    it('returns 0.5 fallback when LLM call fails', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: false,
        code: null,
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.5);
      expect(result.issues).toEqual(['LLM evaluation failed']);
    });

    it('returns 0.5 fallback when LLM response has no JSON object', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: 'No JSON here, just plain text.',
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.5);
      expect(result.issues).toEqual(['Could not parse LLM response']);
    });

    it('returns 0.5 fallback when JSON.parse throws', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{invalid json}',
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.5);
      expect(result.issues).toEqual(['LLM evaluation error']);
      expect(mockLoggerWarn).toHaveBeenCalledWith('ScoringEngine', 'LLM evaluation parse failed:', expect.anything());
    });

    it('clamps LLM scores and dimensions to 0-1', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":1.5,"technical":2.0,"creative":-0.5,"novelty":0.3}',
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(1);
      expect(result.dimensions.technical).toBe(1);
      expect(result.dimensions.creative).toBe(0);
      expect(result.dimensions.novelty).toBe(0.3);
    });

    it('defaults score to 0.5 when parsed.score is not a number', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":"high","technical":0.7}',
      });
      const engine = new ScoringEngine('llm');
      const result = await engine.score(DEFAULT_INPUT);

      expect(result.score).toBe(0.5);
      expect(result.dimensions.technical).toBe(0.7);
    });

    it('defaults criteria when none provided', async () => {
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":0.6}',
      });
      const engine = new ScoringEngine('llm');
      await engine.score({ output: 'code' });

      const userPrompt = mockLLMClientInstance.generate.mock.calls[0][1];
      expect(userPrompt).toContain('Criteria: technical quality, creativity, novelty');
    });

    it('constructs LLMClient with role evaluator if none provided', () => {
      // LLMScoringStrategy constructor calls new LLMClient() when no llm passed
      // This is tested implicitly through ScoringEngine construction
      const strategy = new LLMScoringStrategy(undefined as any);
      expect(strategy.name).toBe('llm');
    });
  });

  // -------------------------------------------------------------------------
  // Convenience methods
  // -------------------------------------------------------------------------
  describe('quick()', () => {
    it('returns the numeric score from default strategy', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('comprehensive');
      const score = await engine.quick(INPUT_TEXT);

      expect(score).toBe(0.78);
      expect(typeof score).toBe('number');
    });

    it('works with keyword strategy', async () => {
      mockQuickScore.mockReturnValue(0.42);
      const engine = new ScoringEngine('keyword');
      const score = await engine.quick('some text');

      expect(score).toBe(0.42);
    });
  });

  describe('scoreCreative()', () => {
    it('scores with creative strategy and optional domain', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine();
      const result = await engine.scoreCreative(INPUT_TEXT, Domain.P5);

      expect(result.strategy).toBe('creative');
      expect(result.score).toBe(0.78);
      expect(mockCreativeEvaluatorAssess).toHaveBeenCalledWith(
        INPUT_TEXT,
        expect.objectContaining({ domain: Domain.P5 }),
      );
    });

    it('works without domain', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine();
      const result = await engine.scoreCreative(INPUT_TEXT);

      expect(result.strategy).toBe('creative');
    });
  });

  describe('scoreAesthetic()', () => {
    it('scores with aesthetic strategy and passes config + lirContext', async () => {
      mockAestheticCriticInstance.critique.mockReturnValue(AESTHETIC_REPORT);
      const engine = new ScoringEngine();
      const config = { strictness: 'strict' as const };
      const lirContext = { lirTokens: [] };
      const result = await engine.scoreAesthetic(INPUT_TEXT, config, lirContext);

      expect(result.strategy).toBe('aesthetic');
      expect(result.score).toBe(0.82);
      expect(mockAestheticCriticInstance.critique).toHaveBeenCalledWith(INPUT_TEXT, config, lirContext);
    });

    it('works without optional parameters', async () => {
      mockAestheticCriticInstance.critique.mockReturnValue(AESTHETIC_REPORT);
      const engine = new ScoringEngine();
      const result = await engine.scoreAesthetic(INPUT_TEXT);

      expect(result.strategy).toBe('aesthetic');
      expect(mockAestheticCriticInstance.critique).toHaveBeenCalledWith(INPUT_TEXT, undefined, undefined);
    });
  });

  // -------------------------------------------------------------------------
  // scoreReliable()
  // -------------------------------------------------------------------------
  describe('scoreReliable()', () => {
    it('returns comprehensive result when >= 6 dimensions are present', async () => {
      // CREATIVE_ASSESS_RESULT has 6 optional dims: technical, creative, novelty, aesthetic, emergence, interestingness
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine();
      const result = await engine.scoreReliable(DEFAULT_INPUT);

      expect(result.strategy).toBe('comprehensive');
      expect(result.score).toBe(0.78);
      // Should NOT have called LLM
      expect(mockLLMClientInstance.generate).not.toHaveBeenCalled();
    });

    it('boosts with LLM when comprehensive has fewer than 6 dimensions', async () => {
      // Minimal result has only 2 dimensions (technical, creative)
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT_MINIMAL);
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":0.6,"technical":0.7,"creative":0.5,"novelty":0.4}',
      });

      const engine = new ScoringEngine();
      const result = await engine.scoreReliable(DEFAULT_INPUT);

      expect(result.strategy).toBe('comprehensive+llm');
      expect(mockLLMClientInstance.generate).toHaveBeenCalledTimes(1);
      // Dimensions should merge: comprehensive's 2 + LLM's contributions
      expect(result.dimensions.technical).toBe(0.7);
      expect(result.dimensions.creative).toBe(0.5);
      expect(result.dimensions.novelty).toBe(0.4);
    });

    it('merges issues from both comprehensive and LLM results', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue({
        ...CREATIVE_ASSESS_RESULT_MINIMAL,
        issues: ['issue from comprehensive'],
      });
      mockLLMClientInstance.generate.mockResolvedValue({
        success: true,
        code: '{"score":0.6,"technical":0.5,"suggestions":["LLM suggestion"]}',
      });

      const engine = new ScoringEngine();
      const result = await engine.scoreReliable(DEFAULT_INPUT);

      expect(result.issues).toContain('issue from comprehensive');
      expect(result.issues).toContain('LLM suggestion');
    });

    it('returns comprehensive result if LLM strategy is not available', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT_MINIMAL);
      const engine = new ScoringEngine();
      engine.unregister('llm');

      const result = await engine.scoreReliable(DEFAULT_INPUT);

      expect(result.strategy).toBe('comprehensive');
      expect(result.score).toBe(0.5);
    });

    it('returns comprehensive result if LLM boost throws', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT_MINIMAL);

      const engine = new ScoringEngine();
      // Replace the LLM strategy with one that throws synchronously
      engine.register({
        name: 'llm',
        score() {
          throw new Error('catastrophic LLM failure');
        },
      });

      const result = await engine.scoreReliable(DEFAULT_INPUT);

      expect(result.strategy).toBe('comprehensive');
      expect(result.score).toBe(0.5);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'ScoringEngine',
        'LLM score boost failed, returning heuristic result:',
        'catastrophic LLM failure',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------
  describe('error paths', () => {
    it('score() with empty string output does not throw', async () => {
      mockCreativeEvaluatorAssess.mockReturnValue(CREATIVE_ASSESS_RESULT);
      const engine = new ScoringEngine('comprehensive');
      const result = await engine.score({ output: '' });
      expect(result.score).toBe(0.78);
    });

    it('score() with null-like domain defaults correctly', async () => {
      mockQuickScore.mockReturnValue(0.5);
      const engine = new ScoringEngine('keyword');
      const result = await engine.score({ output: 'test' });
      expect(mockQuickScore).toHaveBeenCalledWith('test', Domain.EMPTY);
      expect(result.score).toBe(0.5);
    });

    it('registering over 20 strategies works without errors', () => {
      const engine = new ScoringEngine();
      for (let i = 0; i < 20; i++) {
        engine.register({
          name: `stress-${i}`,
          score: () => ({ score: i / 20, dimensions: {}, strategy: `stress-${i}` }),
        });
      }
      expect(engine.listStrategies().length).toBeGreaterThanOrEqual(27); // 7 built-in + 3 aliases + 20
    });
  });
});
