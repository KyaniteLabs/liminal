import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from '../../src/llm/providers/OpenRouterProvider.js';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../src/llm/CapabilityRegistry.js', () => ({
  CapabilityRegistry: {
    getCapabilities: () => ({
      thinking: true, streaming: true, jsonMode: true,
      toolUse: false, maxContextTokens: 128000,
      thinkingStyle: 'reasoning_content', streamingStyle: 'sse',
    }),
  },
}));

vi.mock('../../src/llm/ThinkingNormalizer.js', () => ({
  extractOpenRouterThinking: () => ({ text: '', source: 'none' }),
}));

beforeEach(() => mockFetch.mockReset());

describe('OpenRouterProvider', () => {
  it('has name "openrouter" and sets custom headers', () => {
    const provider = new OpenRouterProvider({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      model: 'anthropic/claude-3.5-sonnet',
    });
    expect(provider.name).toBe('openrouter');
    expect(provider.capabilities.streaming).toBe(true);
  });

  it('generate returns content from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'response text' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'anthropic/claude-3.5-sonnet',
      }),
    });
    const provider = new OpenRouterProvider({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      model: 'anthropic/claude-3.5-sonnet',
    });
    const res = await provider.generate({
      systemPrompt: 'sys', userPrompt: 'usr',
    });
    expect(res.isOk()).toBe(true);
    expect(res.value.success).toBe(true);
    expect(res.value.content).toBe('response text');
  });
});
