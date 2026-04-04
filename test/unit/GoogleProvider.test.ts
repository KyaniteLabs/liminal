import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleProvider } from '../../src/llm/providers/GoogleProvider.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../src/llm/CapabilityRegistry.js', () => ({
  CapabilityRegistry: {
    getCapabilities: () => ({
      thinking: true, streaming: true, jsonMode: false,
      toolUse: false, maxContextTokens: 100000,
      thinkingStyle: 'effort_level', streamingStyle: 'sse',
    }),
  },
}));

beforeEach(() => mockFetch.mockReset());

describe('GoogleProvider', () => {
  it('has name "google" and returns capabilities', () => {
    const provider = new GoogleProvider({
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'test-key',
      model: 'gemini-2.5-pro',
    });
    expect(provider.name).toBe('google');
    expect(provider.capabilities.thinking).toBe(true);
  });

  it('generate returns content from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'hello world' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
      }),
    });
    const provider = new GoogleProvider({
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'test-key',
      model: 'gemini-2.5-pro',
    });
    const res = await provider.generate({
      systemPrompt: 'sys', userPrompt: 'usr',
    });
    expect(res.success).toBe(true);
    expect(res.content).toBe('hello world');
  });
});
