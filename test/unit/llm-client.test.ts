// ============================================================================
// SECURITY NOTICE
// ============================================================================
// All API keys in this file are FAKE test values used for unit testing only.
// They are intentionally invalid and pose no security risk.
// Do NOT use these values in production or with real APIs.
// ============================================================================

import { describe, it, expect, afterEach, test } from 'vitest';
/**
 * LLMClient tests - OpenAI-compatible API support
 *
 * Tests for LM Studio, Ollama, OpenAI, MiniMax, and Hybrid
 */

import { LLMClient } from '../../src/llm/LLMClient.js';

function createFetchStub(response: any) {
  let lastUrl: string = '';
  let lastOpts: RequestInit = {};
  const stub = (url: string, opts?: RequestInit) => {
    lastUrl = url;
    lastOpts = opts || {};
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    } as Response);
  };
  return { stub, getLastUrl: () => lastUrl, getLastOpts: () => lastOpts };
}

describe('LLMClient Configuration', () => {
  afterEach(() => {
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.ATELIER_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  test('should create client with LM Studio config (no API key)', () => {
    const client = new LLMClient({
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'local-model',
      // apiKey intentionally omitted for LM Studio
    });

    // Client should be created successfully
    expect(client).toBeDefined();
  });

  test('should create client with Ollama Cloud config (with API key)', () => {
    const client = new LLMClient({
      provider: 'ollama',
      baseUrl: 'https://api.ollama.com/v1',
      model: 'llama3.2',
      apiKey: 'test-ollama-key',
    });

    expect(client).toBeDefined();
  });

  test('isConfigured returns true when LIMINAL_LLM_API_KEY is set', () => {
    process.env.LIMINAL_LLM_API_KEY = 'test-sk-key';
    expect(LLMClient.isConfigured()).toBe(true);
  });

  test('isConfigured returns false when no API keys are set', () => {
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.ATELIER_LLM_API_KEY;
    expect(LLMClient.isConfigured()).toBe(false);
  });

  test('isConfigured returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(LLMClient.isConfigured()).toBe(true);
    delete process.env.OPENAI_API_KEY;
  });
});

describe('LLMClient OpenAI (W0-L)', () => {
  const openAIResponse = {
    choices: [{ message: { content: 'function setup() { createCanvas(400,400); }\nfunction draw() {}' } }],
  };

  it('calls OpenAI URL with correct body/headers and parses response to code', async () => {
    const { stub, getLastUrl, getLastOpts } = createFetchStub(openAIResponse);
    global.fetch = stub as any;

    const client = new LLMClient({
      provider: 'openai',
      apiKey: 'test-sk-key',
      model: 'gpt-4o-mini',
    });

    const result = await client.generateP5Sketch('a circle');

    expect(result.success).toBe(true);
    expect(result.code).toContain('createCanvas');
    expect(getLastUrl()).toMatch(/openai\.com.*chat\/completions|.*\/v1\/chat\/completions/);
    const opts = getLastOpts();
    expect(opts?.method).toBe('POST');
    expect((opts?.headers as Record<string, string>)?.['Authorization']).toBe('Bearer test-sk-key');
    expect((opts?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');
    const body = JSON.parse((opts?.body as string) ?? '{}');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toBeDefined();
    expect(Array.isArray(body.messages)).toBe(true);
  });
});

describe('LLMClient MiniMax', () => {
  const minimaxResponse = {
    choices: [{ message: { content: 'function setup() { createCanvas(400,400); }\nfunction draw() {}' } }],
  };

  it('calls MiniMax API with correct shape and parses response to code', async () => {
    const { stub, getLastOpts } = createFetchStub(minimaxResponse);
    global.fetch = stub as any;

    const client = new LLMClient({
      provider: 'minimax',
      apiKey: 'test-minimax-key',
      model: 'mini-model',
    });

    const result = await client.generateP5Sketch('a circle');

    expect(result.success).toBe(true);
    expect(result.code).toContain('createCanvas');
    const opts = getLastOpts();
    expect(opts?.method).toBe('POST');
    expect((opts?.headers as Record<string, string>)?.['Authorization']).toBe('Bearer test-minimax-key');
    const body = JSON.parse((opts?.body as string) ?? '{}');
    expect(body.model).toBe('mini-model');
    expect(body.messages).toBeDefined();
  });
});
