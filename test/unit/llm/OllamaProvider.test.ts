import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * OllamaProvider comprehensive branch tests
 *
 * Covers:
 * - Native mode vs OpenAI-compat mode (/v1 suffix detection)
 * - Request construction (URL, headers, body)
 * - Response parsing (content, thinking, usage)
 * - Streaming vs non-streaming paths
 * - Think-tag fallback extraction
 * - Error handling (HTTP errors, network failures, empty bodies)
 * - Config parameter inheritance (temperature, maxTokens, signal)
 */

import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.js';
import type { ProviderRequest, ProviderConfig } from '../../../src/llm/ProviderTypes.js';

// ── Hoisted mock variables ────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
const mockNormalizeThinking = vi.hoisted(() => vi.fn());
const mockStripThinkTags = vi.hoisted(() => vi.fn());
const mockParseOllamaStream = vi.hoisted(() =>
  vi.fn(async function* () { /* noop */ }),
);
const mockParseOpenAIStream = vi.hoisted(() =>
  vi.fn(async function* () { /* noop */ }),
);
const mockCapabilities = vi.hoisted(() =>
  vi.fn(() => ({
    thinking: false,
    streaming: true,
    jsonMode: true,
    toolUse: false,
    maxContextTokens: 4096,
    thinkingStyle: 'none' as const,
    streamingStyle: 'sse' as const,
  }))
);

// ── Mock registrations ────────────────────────────────────────────────────

vi.stubGlobal('fetch', mockFetch);

vi.mock('../../../src/llm/CapabilityRegistry.js', () => ({
  CapabilityRegistry: { getCapabilities: () => mockCapabilities() },
}));

vi.mock('../../../src/llm/ThinkingNormalizer.js', () => ({
  normalizeThinking: mockNormalizeThinking,
  stripThinkTags: mockStripThinkTags,
}));

vi.mock('../../../src/llm/StreamParser.js', () => ({
  parseOllamaStream: mockParseOllamaStream,
  parseOpenAIStream: mockParseOpenAIStream,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function nativeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 8000,
    ...overrides,
  };
}

function compatConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5-coder',
    temperature: 0.7,
    maxTokens: 4096,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    systemPrompt: 'You are helpful.',
    userPrompt: 'Say hello.',
    temperature: 0.7,
    maxTokens: 4096,
    ...overrides,
  };
}

function mockFetchResponse(body: unknown, status = 200, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
  });
}

function mockFetchResponseWithBody(body: unknown, streamBody: unknown, status = 200, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: streamBody,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Native Mode Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('OllamaProvider — Native Mode (no /v1 suffix)', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider(nativeConfig());
    mockFetch.mockReset();
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });
    mockStripThinkTags.mockReturnValue({ content: '', thinking: '' });
  });

  // ── Construction ──────────────────────────────────────────────────────────

  it('sets name to "ollama"', () => {
    expect(provider.name).toBe('ollama');
  });

  it('uses OpenAI-compat when baseUrl ends with /v1', () => {
    const compatProvider = new OllamaProvider(compatConfig());
    // Verify via generate call URL
    mockFetchResponse({ choices: [{ message: { content: 'ok' } }] });
    compatProvider.generate(makeRequest());
    // We'll verify URL in the compat mode tests below
  });

  // ── Request construction ──────────────────────────────────────────────────

  it('sends POST to /api/generate endpoint', async () => {
    mockFetchResponse({ response: 'hello' });

    await provider.generate(makeRequest());

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/generate');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('sends system, prompt, stream=false in request body', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({
      systemPrompt: 'Be creative',
      userPrompt: 'Generate art',
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('Be creative');
    expect(body.prompt).toBe('Generate art');
    expect(body.stream).toBe(false);
    expect(body.model).toBe('llama3');
  });

  it('computes numCtx as min(maxTokens*2, 32768)', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({ maxTokens: 20000 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // 20000 * 2 = 40000 > 32768, so should be capped at 32768
    expect(body.options.num_ctx).toBe(32768);
  });

  it('computes numCtx as maxTokens*2 when under 32768 cap', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({ maxTokens: 4000 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_ctx).toBe(8000);
  });

  it('uses request temperature when provided', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({ temperature: 0.1 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.temperature).toBe(0.1);
  });

  it('falls back to config temperature when request omits it', async () => {
    const hotProvider = new OllamaProvider(nativeConfig({ temperature: 0.99 }));
    mockFetchResponse({ response: 'ok' });

    await hotProvider.generate(makeRequest({ temperature: undefined }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.temperature).toBe(0.99);
  });

  it('uses config maxTokens when request omits it', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({ maxTokens: undefined }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_predict).toBe(8000);
  });

  it('uses request maxTokens over config default', async () => {
    mockFetchResponse({ response: 'ok' });

    await provider.generate(makeRequest({ maxTokens: 2048 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.options.num_predict).toBe(2048);
  });

  // ── Response parsing ──────────────────────────────────────────────────────

  it('parses native response with eval_count usage', async () => {
    mockFetchResponse({
      response: 'the output',
      eval_count: 42,
      prompt_eval_count: 10,
    });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('the output');
    expect(result.value.usage?.inputTokens).toBe(10);
    expect(result.value.usage?.outputTokens).toBe(42);
    expect(result.value.model).toBe('llama3');
  });

  it('returns success=false when response content is empty', async () => {
    mockFetchResponse({ response: '' });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);

    expect(result.value.success).toBe(false);

    expect(result.value.content).toBe('');
  });

  it('omits usage when eval_count is absent', async () => {
    mockFetchResponse({ response: 'some text' });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });

    const result = await provider.generate(makeRequest());

    expect(result.value.usage).toBeUndefined();
  });

  it('defaults to 0 for prompt_eval_count when missing', async () => {
    mockFetchResponse({ response: 'hello', eval_count: 5 });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });

    const result = await provider.generate(makeRequest());

    expect(result.value.usage?.inputTokens).toBe(0);
    expect(result.value.usage?.outputTokens).toBe(5);
  });

  // ── Thinking extraction ───────────────────────────────────────────────────

  it('includes thinking when normalizeThinking returns non-none source', async () => {
    mockFetchResponse({ response: 'result' });
    mockNormalizeThinking.mockReturnValue({
      source: 'think_tags',
      text: 'internal reasoning',
    });

    const result = await provider.generate(makeRequest());

    expect(result.value.thinking).toEqual({
      source: 'think_tags',
      text: 'internal reasoning',
    });
  });

  it('omits thinking when normalizeThinking returns source "none"', async () => {
    mockFetchResponse({ response: 'result' });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });

    const result = await provider.generate(makeRequest());

    expect(result.value.thinking).toBeUndefined();
  });

  it('falls back to stripThinkTags when response contains <think in content', async () => {
    mockFetchResponse({ response: '<think type="reasoning">thoughts</thinkactual output' });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });
    mockStripThinkTags.mockReturnValue({
      content: 'actual output',
      thinking: 'thoughts',
    });

    const result = await provider.generate(makeRequest());

    expect(result.value.content).toBe('actual output');
    expect(result.value.thinking).toEqual({
      text: 'thoughts',
      source: 'think_tags',
    });
  });

  it('does not trigger think-tag fallback when content has no <think', async () => {
    mockFetchResponse({ response: 'normal response' });
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });
    mockStripThinkTags.mockClear();

    const result = await provider.generate(makeRequest());

    expect(mockStripThinkTags).not.toHaveBeenCalled();
    expect(result.value.thinking).toBeUndefined();
  });

  // ── Error paths ───────────────────────────────────────────────────────────

  it('returns error on HTTP 500', async () => {
    mockFetchResponse({}, 500, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);

    expect(result.error.message).toBe('Ollama API error 500');
  });

  it('returns error on HTTP 404 (model not found)', async () => {
    mockFetchResponse({}, 404, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);

    expect(result.error.message).toBe('Ollama API error 404');
  });

  // ── Streaming ─────────────────────────────────────────────────────────────

  it('stream() yields error on HTTP failure', async () => {
    mockFetchResponse({}, 500, false);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'error', error: 'Ollama API error 500' }]);
  });

  it('stream() yields error when response body is null', async () => {
    mockFetchResponseWithBody({}, null);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'error', error: 'No response body' }]);
  });

  it('stream() delegates to parseOllamaStream when body exists', async () => {
    const fakeBody = {} as ReadableStream<Uint8Array>;
    mockFetchResponseWithBody({}, fakeBody);

    const mockGen = (async function* () {
      yield { type: 'content' as const, content: 'token1' };
      yield { type: 'done' as const };
    })();
    mockParseOllamaStream.mockReturnValue(mockGen);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'content', content: 'token1' },
      { type: 'done' },
    ]);
  });

  it('stream() sends stream: true in body', async () => {
    mockFetchResponseWithBody({}, {} as ReadableStream<Uint8Array>);
    mockParseOllamaStream.mockReturnValue((async function* () {})());

    for await (const _ of provider.stream(makeRequest())) {
      // consume
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OpenAI-Compatible Mode Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('OllamaProvider — OpenAI-Compatible Mode (/v1 suffix)', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider(compatConfig());
    mockFetch.mockReset();
    mockNormalizeThinking.mockReturnValue({ source: 'none', text: '' });
  });

  it('sends POST to /chat/completions endpoint', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
    });

    await provider.generate(makeRequest());

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('uses messages format with system and user roles', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'response' } }],
    });

    await provider.generate(makeRequest({
      systemPrompt: 'System message',
      userPrompt: 'User message',
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'System message' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'User message' });
  });

  it('includes temperature and max_tokens in body', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
    });

    await provider.generate(makeRequest({ temperature: 0.3, maxTokens: 1024 }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(1024);
  });

  it('uses config defaults when request omits params', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
    });

    await provider.generate(makeRequest({ temperature: undefined, maxTokens: undefined }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(4096);
  });

  it('parses choices[0].message.content from response', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'compat output' } }],
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('compat output');
  });

  it('returns success=false when choices content is empty', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' } }],
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);

    expect(result.value.success).toBe(false);

    expect(result.value.content).toBe('');
  });

  it('returns success=false when choices array is empty', async () => {
    mockFetchResponse({
      choices: [],
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);

    expect(result.value.success).toBe(false);

  });

  it('returns success=false when choices is undefined', async () => {
    mockFetchResponse({});

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);

    expect(result.value.success).toBe(false);

  });

  it('includes thinking when normalizeThinking returns non-none', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'result' } }],
    });
    mockNormalizeThinking.mockReturnValue({
      source: 'reasoning_content',
      text: 'chain of thought',
    });

    const result = await provider.generate(makeRequest());

    expect(result.value.thinking).toEqual({
      source: 'reasoning_content',
      text: 'chain of thought',
    });
  });

  it('returns error on HTTP failure', async () => {
    mockFetchResponse({}, 503, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);

    expect(result.error.message).toBe('Ollama OpenAI-compat error 503');
  });

  it('uses model from config in response', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
    });

    const result = await provider.generate(makeRequest());

    expect(result.value.model).toBe('qwen2.5-coder');
  });

  // ── Streaming ─────────────────────────────────────────────────────────────

  it('stream() yields error on HTTP failure', async () => {
    mockFetchResponse({}, 503, false);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'error', error: 'Ollama OpenAI-compat error 503' }]);
  });

  it('stream() yields error when response body is null', async () => {
    mockFetchResponseWithBody({}, null);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'error', error: 'No response body' }]);
  });

  it('stream() delegates to parseOpenAIStream when body exists', async () => {
    const fakeBody = {} as ReadableStream<Uint8Array>;
    mockFetchResponseWithBody({}, fakeBody);

    const mockGen = (async function* () {
      yield { type: 'content' as const, content: 'tok' };
    })();
    mockParseOpenAIStream.mockReturnValue(mockGen);

    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'content', content: 'tok' }]);
  });

  it('stream() includes stream: true in body', async () => {
    mockFetchResponseWithBody({}, {} as ReadableStream<Uint8Array>);
    mockParseOpenAIStream.mockReturnValue((async function* () {})());

    for await (const _ of provider.stream(makeRequest())) {
      // consume
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Capability delegation
// ═══════════════════════════════════════════════════════════════════════════

describe('OllamaProvider — capabilities delegation', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('delegates capabilities to CapabilityRegistry', () => {
    mockCapabilities.mockReturnValue({
      thinking: true,
      streaming: true,
      jsonMode: false,
      toolUse: true,
      maxContextTokens: 128000,
      thinkingStyle: 'think_tags',
      streamingStyle: 'json_lines',
    });

    const provider = new OllamaProvider(nativeConfig());
    const caps = provider.capabilities;

    expect(caps.thinking).toBe(true);
    expect(caps.jsonMode).toBe(false);
    expect(caps.maxContextTokens).toBe(128000);
  });
});
