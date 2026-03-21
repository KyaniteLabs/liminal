import { describe, it, expect, test } from 'vitest';
/**
 * Tests for MiniMax, LM Studio, Ollama, OpenAI, and Hybrid provider support in LLMClient.
 * Only tests configuration and cost estimation -- no network calls.
 */

import { LLMClient, type LLMConfig } from '../../../src/llm/LLMClient.js';

describe('LLMConfig provider types', () => {
  function makeConfig(provider: LLMConfig['provider']): LLMConfig {
    return { provider, model: 'test-model' };
  }

  test('accepts minimax provider', () => {
    const config = makeConfig('minimax');
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('accepts lmstudio provider', () => {
    const config = makeConfig('lmstudio');
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('accepts hybrid provider', () => {
    const config = makeConfig('hybrid');
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });
});

describe('LLMClient.estimatedCost', () => {
  test('returns correct values for known providers', () => {
    // openai: input=0.00001, output=0.00003
    expect(LLMClient.estimatedCost('openai')).toBeCloseTo(0.00001 * 1000 + 0.00003 * 500);
    // minimax: input=0.000001, output=0.000002
    expect(LLMClient.estimatedCost('minimax')).toBeCloseTo(0.000001 * 1000 + 0.000002 * 500);
  });

  test('returns 0 for unknown providers', () => {
    expect(LLMClient.estimatedCost('nonexistent-provider')).toBe(0);
    expect(LLMClient.estimatedCost('')).toBe(0);
  });

  test('returns 0 for local providers (ollama, lmstudio)', () => {
    expect(LLMClient.estimatedCost('ollama')).toBe(0);
    expect(LLMClient.estimatedCost('lmstudio')).toBe(0);
  });

  test('calculates correctly with custom token counts', () => {
    // openai: 5000 input tokens, 2000 output tokens
    const cost = LLMClient.estimatedCost('openai', 5000, 2000);
    expect(cost).toBeCloseTo(0.00001 * 5000 + 0.00003 * 2000);
  });
});
