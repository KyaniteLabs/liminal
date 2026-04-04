import { describe, it, expect, test } from 'vitest';
/**
 * Tests for model-agnostic LLMClient configuration.
 * Works with any OpenAI-compatible endpoint.
 */

import { LLMClient, type LLMConfig } from '../../../src/llm/LLMClient.js';

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
    expect(result.recoveredFromThinking).toBe(true);
  });

  it('recovers code from <think> tags when content is empty', async () => {
    const { stub } = createFetchStub({
      choices: [
        {
          message: {
            content:
              '<think>\n```javascript\nfunction setup() { createCanvas(400, 400); }\nfunction draw() {}\n```\n</think>',
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
    expect(result.recoveredFromThinking).toBe(true);
  });
});
