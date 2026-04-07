import { describe, it, expect } from 'vitest';

import {
  detectModelTier,
  getModelProfile,
  trimContext,
  type ModelTier,
} from '../../../src/llm/ModelTier.js';

// ---------------------------------------------------------------------------
// detectModelTier
// ---------------------------------------------------------------------------
describe('detectModelTier', () => {
  // -- Exact matches ---------------------------------------------------------

  describe('exact model matches', () => {
    it('classifies claude-3-5-sonnet as flagship', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet' })).toBe('flagship');
    });

    it('classifies claude-4 as flagship', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com', model: 'claude-4' })).toBe('flagship');
    });

    it('classifies gpt-4 as flagship', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' })).toBe('flagship');
    });

    it('classifies gpt-4o as flagship', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' })).toBe('flagship');
    });

    it('classifies gpt-4-turbo as flagship', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo' })).toBe('flagship');
    });

    it('classifies claude-3-haiku as medium', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com', model: 'claude-3-haiku' })).toBe('medium');
    });

    it('classifies gpt-3.5-turbo as medium', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' })).toBe('medium');
    });

    it('classifies gpt-4o-mini as medium', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })).toBe('medium');
    });

    it('classifies qwen2.5 as local', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5' })).toBe('local');
    });

    it('classifies llama as local', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'llama' })).toBe('local');
    });

    it('classifies mistral as local', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'mistral' })).toBe('local');
    });

    it('classifies phi as local', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'phi' })).toBe('local');
    });

    it('classifies tinyllama as tiny', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'tinyllama' })).toBe('tiny');
    });

    it('classifies qwen2.5-0.5b as tiny', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5-0.5b' })).toBe('tiny');
    });

    it('classifies phi-2 as tiny', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'phi-2' })).toBe('tiny');
    });
  });

  // -- Partial / fuzzy matches -----------------------------------------------

  describe('partial model name matches', () => {
    it('matches "claude-3-5-sonnet-20241022" to flagship via substring', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-sonnet-20241022' })).toBe('flagship');
    });

    it('matches "gpt-4o-2024-08-06" to flagship via substring', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-2024-08-06' })).toBe('flagship');
    });

    it('matches "qwen2.5-coder-14b" to local via substring', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'qwen2.5-coder-14b' })).toBe('local');
    });

    it('matches "llama-3-70b" to local via substring', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'llama-3-70b' })).toBe('local');
    });

    it('matches "mixtral-8x7b" to local via substring', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'mixtral-8x7b' })).toBe('local');
    });

    it('matches "gemma-2-9b" to local via substring', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'gemma-2-9b' })).toBe('local');
    });
  });

  // -- Case insensitivity ----------------------------------------------------

  describe('case insensitivity', () => {
    it('treats "GPT-4" the same as "gpt-4"', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'GPT-4' })).toBe('flagship');
    });

    it('treats "Claude-3-Haiku" the same as "claude-3-haiku"', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com', model: 'Claude-3-Haiku' })).toBe('medium');
    });

    it('treats "QWEN2.5" the same as "qwen2.5"', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'QWEN2.5' })).toBe('local');
    });
  });

  // -- maxTokens heuristic ---------------------------------------------------

  describe('maxTokens-based heuristic', () => {
    it('returns flagship for maxTokens > 100000', () => {
      expect(detectModelTier({ baseUrl: 'https://example.com', model: 'unknown-model', maxTokens: 150000 })).toBe('flagship');
    });

    it('returns medium for maxTokens > 50000 but <= 100000', () => {
      expect(detectModelTier({ baseUrl: 'https://example.com', model: 'unknown-model', maxTokens: 60000 })).toBe('medium');
    });

    it('returns tiny for maxTokens < 10000', () => {
      expect(detectModelTier({ baseUrl: 'https://example.com', model: 'unknown-model', maxTokens: 4000 })).toBe('tiny');
    });
  });

  // -- baseUrl heuristic ------------------------------------------------------

  describe('baseUrl-based heuristic', () => {
    it('returns flagship for anthropic URLs', () => {
      expect(detectModelTier({ baseUrl: 'https://api.anthropic.com/v1', model: 'unknown' })).toBe('flagship');
    });

    it('returns flagship for openai.com URLs', () => {
      expect(detectModelTier({ baseUrl: 'https://api.openai.com/v1', model: 'unknown' })).toBe('flagship');
    });

    it('returns local for localhost URLs', () => {
      expect(detectModelTier({ baseUrl: 'http://localhost:1234/v1', model: 'unknown' })).toBe('local');
    });

    it('returns local for 127.0.0.1 URLs', () => {
      expect(detectModelTier({ baseUrl: 'http://127.0.0.1:1234/v1', model: 'unknown' })).toBe('local');
    });

    it('returns local for ollama URLs', () => {
      expect(detectModelTier({ baseUrl: 'http://ollama.local:11434/v1', model: 'unknown' })).toBe('local');
    });
  });

  // -- Default / edge cases --------------------------------------------------

  describe('defaults and edge cases', () => {
    it('returns "medium" as safe default for unrecognized config', () => {
      expect(detectModelTier({ baseUrl: 'https://custom-llm.example.com', model: 'custom-model' })).toBe('medium');
    });

    it('handles missing model gracefully', () => {
      // model is undefined, baseUrl is also non-descript
      expect(detectModelTier({ baseUrl: 'https://generic.example.com', model: '' })).toBe('medium');
    });

    it('handles completely empty model string', () => {
      // Exact match on '' fails, partial match loop runs, no URL hints → medium
      expect(detectModelTier({ baseUrl: 'https://generic.example.com', model: '' })).toBe('medium');
    });
  });
});

// ---------------------------------------------------------------------------
// getModelProfile
// ---------------------------------------------------------------------------
describe('getModelProfile', () => {
  const tiers: ModelTier[] = ['flagship', 'medium', 'local', 'tiny'];

  it('returns a profile for every tier', () => {
    for (const tier of tiers) {
      const profile = getModelProfile(tier);
      expect(profile.tier).toBe(tier);
    }
  });

  it('flagship has 200K context, supports system prompt, 3 few-shot', () => {
    const profile = getModelProfile('flagship');
    expect(profile.contextWindow).toBe(200_000);
    expect(profile.recommendedContextTokens).toBe(8000);
    expect(profile.supportsSystemPrompt).toBe(true);
    expect(profile.needsExplicitInstructions).toBe(false);
    expect(profile.fewShotExamples).toBe(3);
  });

  it('medium has 100K context, supports system prompt, needs explicit instructions', () => {
    const profile = getModelProfile('medium');
    expect(profile.contextWindow).toBe(100_000);
    expect(profile.recommendedContextTokens).toBe(4000);
    expect(profile.supportsSystemPrompt).toBe(true);
    expect(profile.needsExplicitInstructions).toBe(true);
    expect(profile.fewShotExamples).toBe(2);
  });

  it('local has 16K context, supports system prompt, needs explicit instructions', () => {
    const profile = getModelProfile('local');
    expect(profile.contextWindow).toBe(16_000);
    expect(profile.recommendedContextTokens).toBe(2000);
    expect(profile.supportsSystemPrompt).toBe(true);
    expect(profile.needsExplicitInstructions).toBe(true);
    expect(profile.fewShotExamples).toBe(1);
  });

  it('tiny has 8K context, does NOT support system prompt', () => {
    const profile = getModelProfile('tiny');
    expect(profile.contextWindow).toBe(8000);
    expect(profile.recommendedContextTokens).toBe(1000);
    expect(profile.supportsSystemPrompt).toBe(false);
    expect(profile.needsExplicitInstructions).toBe(true);
    expect(profile.fewShotExamples).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// trimContext
// ---------------------------------------------------------------------------
describe('trimContext', () => {
  it('returns the original string if within token budget', () => {
    const short = 'Hello, world!';
    // 13 chars / 4 = ~3 tokens, budget of 100 tokens is plenty
    expect(trimContext(short, 100)).toBe('Hello, world!');
  });

  it('trims long strings by keeping the start and end', () => {
    // Create a string of 10000 chars (approx 2500 tokens)
    const long = 'A'.repeat(10_000);
    // Budget of 100 tokens = 400 chars max
    const result = trimContext(long, 100);

    // 30% from start = 120, 40% from end = 160, plus the truncation marker
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain('[... context trimmed for length ...]');
    expect(result.startsWith('A'.repeat(120))).toBe(true);
  });

  it('preserves content exactly at the boundary', () => {
    // 400 chars = exactly 100 tokens (4 chars per token approximation)
    const exact = 'X'.repeat(400);
    expect(trimContext(exact, 100)).toBe('X'.repeat(400));
  });

  it('handles empty string', () => {
    expect(trimContext('', 100)).toBe('');
  });

  it('handles zero token budget by returning trimmed marker', () => {
    const text = 'Some content here';
    const result = trimContext(text, 0);
    // 0 tokens = 0 chars, so it will need to trim
    // keepStart = 0, keepEnd = 0, just the marker
    expect(result).toContain('[... context trimmed for length ...]');
  });
});
