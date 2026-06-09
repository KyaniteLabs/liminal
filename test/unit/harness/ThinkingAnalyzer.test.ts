import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMResponse } from '../../../src/llm/LLMClient.js';

// vi.hoisted is REQUIRED for variables referenced inside vi.mock() factories
const { mockCapture, mockNormalizeThinking, mockStripThinkTags } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockNormalizeThinking: vi.fn(),
  mockStripThinkTags: vi.fn(),
}));

vi.mock('../../../src/llm/ReasoningCapture.js', () => ({
  reasoningCapture: { capture: mockCapture },
}));

vi.mock('../../../src/llm/ThinkingNormalizer.js', () => ({
  normalizeThinking: mockNormalizeThinking,
  stripThinkTags: mockStripThinkTags,
}));

import { ThinkingAnalyzer } from '../../../src/harness/ThinkingAnalyzer.js';

// Helper to create a minimal LLMResponse
function makeResponse(overrides: Partial<LLMResponse> = {}): LLMResponse {
  return {
    code: 'osc().out()',
    explanation: 'A simple osc visual',
    success: true,
    thinking: '',
    model: 'test-model',
    ...overrides,
  };
}

describe('ThinkingAnalyzer', () => {
  let analyzer: ThinkingAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ThinkingAnalyzer();

    // Default mock returns: no thinking found, no patterns
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });
    mockStripThinkTags.mockReturnValue({ text: '', thinking: '' });
    mockCapture.mockReturnValue({ patterns: [] });
  });

  describe('analyze', () => {
    it('returns analysis with thinking from response.thinking', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const response = makeResponse({ thinking: 'I considered using noise.' });

      const result = analyzer.analyze(response, 'draw noise', 'hydra', 'glm-4');

      expect(result.thinkingSummary).toContain('considered');
      expect(result.thinkingSource).toBe('think_tags');
      expect(result.model).toBe('glm-4');
      expect(result.domain).toBe('hydra');
    });

    it('falls back to normalizeThinking when response.thinking is empty', () => {
      mockNormalizeThinking.mockReturnValue({ source: 'reasoning_field', text: 'Extracted thinking text' });
      mockCapture.mockReturnValue({ patterns: [] });

      const response = makeResponse({ thinking: '' });
      const result = analyzer.analyze(response, 'prompt', 'p5', 'model');

      expect(result.thinkingSource).toBe('reasoning_field');
      expect(result.thinkingSummary).toContain('Extracted thinking');
    });

    it('falls back to stripThinkTags on response.code when no thinking elsewhere', () => {
      mockStripThinkTags.mockReturnValue({ text: 'clean code', thinking: 'Hidden thinking here' });
      mockCapture.mockReturnValue({ patterns: [] });

      const response = makeResponse({ thinking: '', code: '<think\>Hidden thinking here</think\>rest' });
      const result = analyzer.analyze(response, 'prompt', 'p5', 'model');

      expect(result.thinkingSource).toBe('think_tags');
      expect(mockStripThinkTags).toHaveBeenCalledWith(expect.stringContaining('Hidden'));
    });

    it('falls back to stripThinkTags on response.explanation when still no thinking', () => {
      // code strip returns no thinking
      mockStripThinkTags
        .mockReturnValueOnce({ text: 'code', thinking: '' })
        .mockReturnValueOnce({ text: 'clean', thinking: 'Found in explanation' });
      mockCapture.mockReturnValue({ patterns: [] });

      const response = makeResponse({ thinking: '', explanation: 'Some explanation with thinking' });
      const result = analyzer.analyze(response, 'prompt', 'p5', 'model');

      expect(result.thinkingSource).toBe('think_tags');
    });

    it('sets codeRecovered from response.recoveredFromThinking', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const response = makeResponse({ recoveredFromThinking: true });

      const result = analyzer.analyze(response, 'prompt', 'hydra', 'model');

      expect(result.codeRecovered).toBe(true);
    });

    it('sets originalCodeEmpty when response.code is empty', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const response = makeResponse({ code: '' });

      const result = analyzer.analyzer ? analyzer.analyze(response, 'p', 'd', 'm') : null;
      // Actually use the analyzer
      const result2 = analyzer.analyze(response, 'prompt', 'hydra', 'model');

      expect(result2.originalCodeEmpty).toBe(true);
    });

    it('detects no_code_generation pattern when code is empty and thinking exists', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const response = makeResponse({ code: '', thinking: 'Some reasoning here' });
      const result = analyzer.analyze(response, 'prompt', 'hydra', 'model');

      const noCodePattern = result.detectedPatterns.find(p => p.type === 'no_code_generation');
      expect(noCodePattern).toBeDefined();
      expect(noCodePattern!.confidence).toBe(0.9);
    });

    it('detects no_code_generation when recoveredFromThinking is true', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const response = makeResponse({ recoveredFromThinking: true, thinking: 'Reasoning' });
      const result = analyzer.analyze(response, 'prompt', 'hydra', 'model');

      expect(result.detectedPatterns.some(p => p.type === 'no_code_generation')).toBe(true);
    });

    it('truncates prompt to 200 characters', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const longPrompt = 'x'.repeat(500);

      const result = analyzer.analyze(makeResponse(), longPrompt, 'hydra', 'model');

      expect(result.prompt.length).toBe(200);
    });

    it('sets thinkingSource to none when no thinking found anywhere', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(makeResponse(), 'prompt', 'hydra', 'model');

      expect(result.thinkingSource).toBe('none');
    });
  });

  describe('generateSuggestion (via analyze)', () => {
    it('suggests prompt fix for recoveredFromThinking', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const response = makeResponse({ recoveredFromThinking: true, thinking: 'Thinking' });

      const result = analyzer.analyze(response, 'prompt', 'hydra', 'glm-4');

      expect(result.suggestedFix).toBeDefined();
      expect(result.suggestedFix!.type).toBe('prompt');
      expect(result.suggestedFix!.priority).toBe('high');
      expect(result.suggestedFix!.description).toContain('glm-4');
    });

    it('suggests model_config for no_code_generation pattern', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const response = makeResponse({ code: '', thinking: 'I thought about it' });

      const result = analyzer.analyze(response, 'prompt', 'hydra', 'glm-4');

      expect(result.suggestedFix).toBeDefined();
      expect(result.suggestedFix!.type).toBe('model_config');
    });

    it('suggests prompt fix for confusion pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'confusion', confidence: 0.8, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ thinking: 'confused' }), 'prompt', 'p5', 'model');

      expect(result.suggestedFix).toBeDefined();
      expect(result.suggestedFix!.type).toBe('prompt');
      expect(result.suggestedFix!.priority).toBe('medium');
    });

    it('suggests validation fix for over_engineering pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'over_engineering', confidence: 0.7, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ thinking: 'optimized' }), 'prompt', 'p5', 'model');

      expect(result.suggestedFix).toBeDefined();
      expect(result.suggestedFix!.type).toBe('validation');
    });

    it('suggests model_config for timeout_precursor pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'timeout_precursor', confidence: 0.9, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ thinking: 'taking long' }), 'prompt', 'p5', 'model');

      expect(result.suggestedFix).toBeDefined();
      expect(result.suggestedFix!.type).toBe('model_config');
      expect(result.suggestedFix!.priority).toBe('high');
    });

    it('returns undefined suggestion when no patterns match', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(makeResponse({ thinking: '' }), 'prompt', 'p5', 'model');

      expect(result.suggestedFix).toBeUndefined();
    });
  });

  describe('extractLearning (via analyze)', () => {
    it('returns clean generation for success with no patterns', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(makeResponse({ success: true }), 'prompt', 'p5', 'model');

      expect(result.learning).toBe('Clean generation with clear reasoning');
    });

    it('returns code placement for no_code_generation pattern', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(
        makeResponse({ code: '', thinking: 'some thought', success: false }),
        'prompt', 'p5', 'model'
      );

      expect(result.learning).toBe('Model needs explicit instruction on code placement');
    });

    it('returns domain requirements for confusion pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'confusion', confidence: 0.8, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(
        makeResponse({ success: false }),
        'prompt', 'p5', 'model'
      );

      expect(result.learning).toBe('Model unclear on domain requirements - improve prompt specificity');
    });

    it('returns simplicity for over_engineering pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'over_engineering', confidence: 0.7, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ success: false }), 'prompt', 'p5', 'model');

      expect(result.learning).toBe('Model overcomplicating - add simplicity constraints');
    });

    it('returns decisiveness for infinite_reconsideration pattern', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'infinite_reconsideration', confidence: 0.8, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ success: false }), 'prompt', 'p5', 'model');

      expect(result.learning).toBe('Model stuck in analysis paralysis - add decisiveness instruction');
    });

    it('returns inefficiencies for success with patterns', () => {
      mockCapture.mockReturnValue({
        patterns: [{ type: 'some_other', confidence: 0.5, evidence: 'test', position: 0 }],
      });

      const result = analyzer.analyze(makeResponse({ success: true }), 'prompt', 'p5', 'model');

      expect(result.learning).toBe('Generation succeeded despite some reasoning inefficiencies');
    });

    it('returns generic review for failure with unmatched patterns', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(makeResponse({ success: false }), 'prompt', 'p5', 'model');

      expect(result.learning).toBe('Review thinking trace for specific failure mode');
    });
  });

  describe('summarizeThinking (via analyze)', () => {
    it('returns "No thinking captured" for empty thinking', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(makeResponse(), 'prompt', 'p5', 'model');

      expect(result.thinkingSummary).toBe('No thinking captured');
    });

    it('truncates long thinking to 200 chars with ellipsis', () => {
      mockCapture.mockReturnValue({ patterns: [] });
      const longThinking = 'This is a sentence. '.repeat(50);

      const result = analyzer.analyze(
        makeResponse({ thinking: longThinking }),
        'prompt', 'p5', 'model'
      );

      expect(result.thinkingSummary.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(result.thinkingSummary).toContain('...');
    });

    it('returns first few sentences for short thinking', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const result = analyzer.analyze(
        makeResponse({ thinking: 'Short thought. Another bit.' }),
        'prompt', 'p5', 'model'
      );

      expect(result.thinkingSummary).toContain('Short thought');
    });
  });

  describe('getAggregateInsights', () => {
    it('returns empty results for empty array', () => {
      const result = analyzer.getAggregateInsights([]);

      expect(result.commonPatterns).toEqual([]);
      expect(result.modelIssues).toEqual({});
      expect(result.recommendedAdaptations).toEqual([]);
    });

    it('aggregates patterns across analyses', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const analyses = [
        analyzer.analyze(
          makeResponse({ recoveredFromThinking: true, thinking: 'Thought' }),
          'p1', 'hydra', 'model-a'
        ),
        analyzer.analyze(
          makeResponse({ recoveredFromThinking: true, thinking: 'Thought' }),
          'p2', 'hydra', 'model-b'
        ),
      ];

      const insights = analyzer.getAggregateInsights(analyses);

      // no_code_generation was pushed for each
      expect(insights.commonPatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('tracks issues per model', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const analyses = [
        analyzer.analyze(
          makeResponse({ recoveredFromThinking: true, thinking: 'T' }),
          'p1', 'hydra', 'model-x'
        ),
      ];

      const insights = analyzer.getAggregateInsights(analyses);

      expect(insights.modelIssues['model-x']).toBeDefined();
      expect(insights.modelIssues['model-x'].length).toBeGreaterThanOrEqual(1);
    });

    it('deduplicates recommended adaptations', () => {
      mockCapture.mockReturnValue({ patterns: [] });

      const analyses = [
        analyzer.analyze(
          makeResponse({ recoveredFromThinking: true, thinking: 'T' }),
          'p1', 'hydra', 'model-a'
        ),
        analyzer.analyze(
          makeResponse({ recoveredFromThinking: true, thinking: 'T' }),
          'p2', 'hydra', 'model-a'
        ),
      ];

      const insights = analyzer.getAggregateInsights(analyses);

      // Same type:description key → deduped
      expect(insights.recommendedAdaptations.length).toBe(1);
    });

    it('sorts common patterns by frequency', () => {
      mockCapture.mockReturnValue({
        patterns: [
          { type: 'alpha', confidence: 0.5, evidence: 'e', position: 0 },
        ],
      });

      const r1 = analyzer.analyze(makeResponse(), 'p', 'd', 'm');
      mockCapture.mockReturnValue({
        patterns: [
          { type: 'beta', confidence: 0.5, evidence: 'e', position: 0 },
        ],
      });
      const r2 = analyzer.analyze(makeResponse(), 'p', 'd', 'm');
      mockCapture.mockReturnValue({
        patterns: [
          { type: 'alpha', confidence: 0.5, evidence: 'e', position: 0 },
        ],
      });
      const r3 = analyzer.analyze(makeResponse(), 'p', 'd', 'm');

      const insights = analyzer.getAggregateInsights([r1, r2, r3]);

      // alpha appears twice, beta once → alpha first
      expect(insights.commonPatterns[0]).toBe('alpha');
    });
  });
});
