import { describe, it, expect, vi } from 'vitest';
import { analyzeWithLLMJudge } from '../../../src/aesthetic/critics/LLMJudgeCritic.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from '../../../src/aesthetic/types.js';

describe('LLMJudgeCritic', () => {
  it('parses JSON judge responses into structured report fields', async () => {
    const llm = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        code: JSON.stringify({
          score: 0.82,
          dimensionScores: { color: 0.9, layout: 0.8, creativity: 0.85, coherence: 0.72 },
          reasoning: 'Strong palette and coherent motion system.',
          violations: ['minor contrast issue'],
        }),
      }),
    };

    const result = await analyzeWithLLMJudge(
      'function setup() { createCanvas(100, 100); }',
      'p5',
      llm,
      DEFAULT_DESIGN_CONSTRAINTS,
    );

    expect(result.usedLLM).toBe(true);
    expect(result.score).toBe(0.82);
    expect(result.reasoning).toContain('Strong palette');
    expect(result.dimensionScores?.color).toBe(0.9);
    expect(result.violations[0]?.message).toBe('minor contrast issue');
  });

  it('falls back to neutral score when JSON is unparseable', async () => {
    const llm = {
      generate: vi.fn().mockResolvedValue({ success: true, code: 'not json' }),
    };

    const result = await analyzeWithLLMJudge(
      'function setup() { createCanvas(100, 100); }',
      'p5',
      llm,
      DEFAULT_DESIGN_CONSTRAINTS,
    );

    expect(result.usedLLM).toBe(true);
    expect(result.score).toBe(0.5);
    expect(result.dimensionScores).toEqual({});
  });
});
