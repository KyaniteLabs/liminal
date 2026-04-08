import { describe, it, expect, test } from 'vitest';
/**
 * Tests for model-agnostic LLMClient configuration.
 * Works with any OpenAI-compatible endpoint.
 */

import { LLMClient, type LLMConfig } from '../../../src/llm/LLMClient.js';
import { detectProvider } from '../../../src/llm/ProviderFactory.js';
import { MiniMaxProvider } from '../../../src/llm/providers/MiniMaxProvider.js';

function createFetchStub(response: unknown) {
  const stub = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    } as Response);
  return { stub };
}

describe('LLMClient model-agnostic configuration', () => {
  test('accepts baseUrl configuration', () => {
    const config: LLMConfig = {
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5-coder',
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('accepts apiKey for cloud providers', () => {
    const config: LLMConfig = {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-4',
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('auto-detects Ollama API style', () => {
    const config: LLMConfig = {
      baseUrl: 'http://localhost:11434', // No /v1 suffix
      model: 'llama3',
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('auto-detects OpenAI-compatible API style', () => {
    const config: LLMConfig = {
      baseUrl: 'http://localhost:1234/v1', // Has /v1 suffix
      model: 'local-model',
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('accepts custom headers', () => {
    const config: LLMConfig = {
      baseUrl: 'http://localhost:1234/v1',
      model: 'test-model',
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });

  test('accepts custom endpoint path', () => {
    const config: LLMConfig = {
      baseUrl: 'http://localhost:1234',
      model: 'test-model',
      endpointPath: '/custom/completions',
    };
    const client = new LLMClient(config);
    expect(client).toBeDefined();
  });
});

describe('LLMClient environment configuration', () => {
  test('uses environment variables when config not provided', () => {
    // Set env vars for this test
    const originalBaseUrl = process.env.LIMINAL_LLM_BASE_URL;
    const originalApiKey = process.env.LIMINAL_LLM_API_KEY;
    const originalModel = process.env.LIMINAL_LLM_MODEL;

    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:8080/v1';
    process.env.LIMINAL_LLM_API_KEY = 'env-api-key';
    process.env.LIMINAL_LLM_MODEL = 'env-model';

    const client = new LLMClient();
    expect(client).toBeDefined();

    // Restore env vars
    process.env.LIMINAL_LLM_BASE_URL = originalBaseUrl;
    process.env.LIMINAL_LLM_API_KEY = originalApiKey;
    process.env.LIMINAL_LLM_MODEL = originalModel;
  });
});

describe('LLMClient MiniMax response recovery', () => {
  it('recovers code from reasoning_content when content is empty', async () => {
    const { stub } = createFetchStub({
      choices: [
        {
          message: {
            content: '',
            reasoning_content:
              'function setup() { createCanvas(400, 400); }\nfunction draw() {}',
          },
        },
      ],
    });
    global.fetch = stub as any;

    const client = new LLMClient({
      baseUrl: 'https://api.minimax.io/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    const result = await client.generate('system', 'user');
    expect(result.success).toBe(true);
    expect(result.code).toContain('createCanvas');
    // Provider-level reasoning_content fallback populates content directly,
    // so LLMClient's thinking recovery path is not triggered
    expect(result.recoveredFromThinking).toBe(false);
  });

  it('recovers code from think tags when content is empty', async () => {
    const thinkContent = '<think' + '>\n```javascript\nfunction setup() { createCanvas(400, 400); }\nfunction draw() {}\n```\n</think' + '>';
    const { stub } = createFetchStub({
      choices: [
        {
          message: {
            content: thinkContent,
          },
        },
      ],
    });
    global.fetch = stub as any;

    const client = new LLMClient({
      baseUrl: 'https://api.minimax.io/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    const result = await client.generate('system', 'user');
    expect(result.success).toBe(true);
    expect(result.code).toContain('createCanvas');
    // Think tags in content → normalizeThinking extracts them →
    // sanitized code is empty → LLMClient recovers from thinking
    expect(result.recoveredFromThinking).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ProviderFactory — MiniMax detection ordering
// ---------------------------------------------------------------------------
describe('ProviderFactory MiniMax detection', () => {
  it('detects minimax from international URL', () => {
    expect(detectProvider({ baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M2.7' })).toBe('minimax');
  });

  it('detects minimax from Chinese domestic URL', () => {
    expect(detectProvider({ baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M2.7' })).toBe('minimax');
  });

  it('detects minimax from Anthropic-compatible URL (not anthropic)', () => {
    // This URL contains "anthropic" but should route to minimax, not anthropic
    expect(detectProvider({ baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' })).toBe('minimax');
  });

  it('still detects real anthropic correctly', () => {
    expect(detectProvider({ baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' })).toBe('anthropic');
  });
});

// ---------------------------------------------------------------------------
// MiniMaxProvider — dual-mode
// ---------------------------------------------------------------------------
describe('MiniMaxProvider dual-mode', () => {
  it('uses OpenAI mode by default', async () => {
    const { stub } = createFetchStub({
      choices: [{
        message: { content: 'function setup() {}' },
        finish_reason: 'stop',
      }],
    });
    global.fetch = stub as any;

    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    const result = await provider.generate({
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('function setup() {}');
  });

  it('uses Anthropic mode when URL contains /anthropic', async () => {
    const { stub } = createFetchStub({
      content: [
        { type: 'text', text: 'function setup() {}' },
      ],
      model: 'MiniMax-M2.7',
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    global.fetch = stub as any;

    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/anthropic',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    const result = await provider.generate({
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('function setup() {}');
  });

  it('extracts thinking blocks in Anthropic mode', async () => {
    const { stub } = createFetchStub({
      content: [
        { type: 'thinking', thinking: 'Let me reason about this...' },
        { type: 'text', text: 'function setup() {}' },
      ],
      model: 'MiniMax-M2.7',
      usage: { input_tokens: 10, output_tokens: 50 },
    });
    global.fetch = stub as any;

    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/anthropic',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    const result = await provider.generate({
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('function setup() {}');
    expect(result.value.thinking?.text).toBe('Let me reason about this...');
    expect(result.value.thinking?.source).toBe('thinking_blocks');
  });

  it('reports toolUse=true in Anthropic mode', () => {
    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/anthropic',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    expect(provider.capabilities.toolUse).toBe(true);
  });

  it('reports toolUse=false in OpenAI mode (from CapabilityRegistry)', () => {
    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key',
    });

    expect(provider.capabilities.toolUse).toBe(false);
  });

  it('sends Bearer token auth in Anthropic mode (not x-api-key)', async () => {
    let capturedHeaders: Record<string, string> = {};
    const stub = (_url: any, options: any) => {
      capturedHeaders = options?.headers || {};
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          content: [{ type: 'text', text: 'result' }],
          model: 'MiniMax-M2.7',
        }),
      } as Response);
    };
    global.fetch = stub as any;

    const provider = new MiniMaxProvider({
      baseUrl: 'https://api.minimax.io/anthropic',
      model: 'MiniMax-M2.7',
      apiKey: 'test-key-123',
    });

    await provider.generate({
      systemPrompt: 'sys',
      userPrompt: 'usr',
    });

    expect(capturedHeaders['Authorization']).toBe('Bearer test-key-123');
    expect(capturedHeaders['x-api-key']).toBeUndefined();
  });
});
