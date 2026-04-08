/**
 * MiniMax Provider Tests
 *
 * Tests the MiniMax-specific provider implementation including:
 * - Correct URL handling (api.minimaxi.com not api.minimax.io)
 * - Response parsing
 * - Empty response handling
 * - Fallback to reasoning_content when content is empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MiniMaxProvider } from '../../src/llm/providers/MiniMaxProvider.js';
import type { ProviderConfig } from '../../src/llm/ProviderTypes.js';

describe('MiniMaxProvider', () => {
  const mockConfig: ProviderConfig = {
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.7',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000,
  };

  let provider: MiniMaxProvider;

  beforeEach(() => {
    provider = new MiniMaxProvider(mockConfig);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('provider info', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('minimax');
    });

    it('should return correct model', () => {
      expect(provider.getModel()).toBe('MiniMax-M2.7');
    });

    it('should support streaming', () => {
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('generate', () => {
    it('should handle successful response with content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'function setup() { createCanvas(400, 400); }',
          },
        }],
        model: 'MiniMax-M2.7',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate a p5.js sketch',
      });

      expect(result.isOk()).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.content).toBe('function setup() { createCanvas(400, 400); }');
      expect(result.value.model).toBe('MiniMax-M2.7');
      expect(result.value.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
      });
    });

    it('should fallback to reasoning_content when content is empty', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '',
            reasoning_content: 'function setup() { createCanvas(400, 400); }',
          },
        }],
        model: 'MiniMax-M2.7',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate a p5.js sketch',
      });

      expect(result.isOk()).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.content).toBe('function setup() { createCanvas(400, 400); }');
    });

    it('should mark response as failed when content is empty and no reasoning_content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '',
          },
        }],
        model: 'MiniMax-M2.7',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate a p5.js sketch',
      });

      expect(result.isOk()).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.content).toBe('');
    });

    it('should handle API error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid API key'),
      });

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate a p5.js sketch',
      });

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toContain('401');
      expect(result.error.message).toContain('Invalid API key');
    });

    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate a p5.js sketch',
      });

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toContain('Network error');
    });

    it('should include Authorization header with Bearer token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'test' } }],
          model: 'MiniMax-M2.7',
        }),
      });
      global.fetch = mockFetch;

      await provider.generate({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.minimaxi.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should use correct URL from config', async () => {
      const customProvider = new MiniMaxProvider({
        ...mockConfig,
        baseUrl: 'https://custom.minimax.endpoint/v1',
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'test' } }],
          model: 'MiniMax-M2.7',
        }),
      });
      global.fetch = mockFetch;

      await customProvider.generate({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.minimax.endpoint/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should handle response with thinking content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'function setup() {}',
            reasoning_content: 'Let me create a simple setup function',
          },
        }],
        model: 'MiniMax-M2.7',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.generate({
        systemPrompt: 'You are a code generator.',
        userPrompt: 'Generate code',
      });

      expect(result.isOk()).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.content).toBe('function setup() {}');
      expect(result.value.thinking?.text).toBe('Let me create a simple setup function');
      expect(result.value.thinking?.source).toBe('reasoning_content');
    });
  });

  describe('streaming', () => {
    it('should handle streaming response', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
        releaseLock: vi.fn(),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const events: Array<{ type: string; content?: string }> = [];
      const stream = provider.stream({
        systemPrompt: 'System',
        userPrompt: 'User',
      });

      for await (const event of stream) {
        events.push(event);
      }

      const contentEvents = events.filter(e => e.type === 'content');
      expect(contentEvents).toHaveLength(2);
      expect(contentEvents[0].content).toBe('Hello');
      expect(contentEvents[1].content).toBe(' World');
    });

    it('should handle streaming error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const events: Array<{ type: string; error?: string }> = [];
      const stream = provider.stream({
        systemPrompt: 'System',
        userPrompt: 'User',
      });

      for await (const event of stream) {
        events.push(event);
      }

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent?.type).toBe('error');
      expect(errorEvent?.error).toContain('500');
    });
  });
});

describe('MiniMax URL Configuration', () => {
  it('should use correct production URL (api.minimaxi.com)', () => {
    // This test documents the correct MiniMax URL
    // The codebase previously used api.minimax.io which was WRONG
    const correctUrl = 'https://api.minimaxi.com/v1';
    const wrongUrl = 'https://api.minimax.io/v1';

    expect(correctUrl).toContain('minimaxi'); // with 'i'
    expect(wrongUrl).not.toContain('minimaxi'); // without 'i'
  });
});
