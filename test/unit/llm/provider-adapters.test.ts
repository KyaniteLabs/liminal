import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for all LLM provider adapters
 *
 * Tests the six provider implementations:
 * - OpenAIProvider (OpenAI /v1/chat/completions)
 * - AnthropicProvider (Claude /v1/messages)
 * - OllamaProvider (native /api/generate and OpenAI-compat)
 * - OpenRouterProvider (gateway with unified reasoning)
 * - GoogleProvider (Gemini generateContent)
 * - MiniMaxProvider (MiniMax with reasoning_content fallback)
 *
 * Each test mocks global fetch and verifies:
 * - Request formatting (URL, headers, body)
 * - Response parsing (content, thinking, usage)
 * - Error handling (non-OK responses, network failures)
 */

import { OpenAIProvider } from '../../../src/llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../../../src/llm/providers/AnthropicProvider.js';
import { OllamaProvider } from '../../../src/llm/providers/OllamaProvider.js';
import { OpenRouterProvider } from '../../../src/llm/providers/OpenRouterProvider.js';
import { GoogleProvider } from '../../../src/llm/providers/GoogleProvider.js';
import { MiniMaxProvider } from '../../../src/llm/providers/MiniMaxProvider.js';
import type { ProviderRequest, ProviderConfig } from '../../../src/llm/ProviderTypes.js';

// ── Shared mock setup ──────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

const mockCapabilities = vi.hoisted(() => ({
  thinking: false,
  streaming: true,
  jsonMode: true,
  toolUse: false,
  thinkingStyle: 'none',
}));

vi.mock('../../../src/llm/CapabilityRegistry.js', () => ({
  CapabilityRegistry: { getCapabilities: () => mockCapabilities },
}));

vi.mock('../../../src/llm/ThinkingNormalizer.js', () => ({
  normalizeThinking: () => ({ source: 'none', text: '' }),
  extractAnthropicThinking: () => ({ source: 'none', text: '' }),
  extractOpenRouterThinking: () => ({ source: 'none', text: '' }),
  stripThinkTags: (c: string) => ({ content: c, thinking: '' }),
}));

vi.mock('../../../src/llm/StreamParser.js', () => ({
  parseOpenAIStream: async function* () { /* noop */ },
  parseAnthropicStream: async function* () { /* noop */ },
  parseOllamaStream: async function* () { /* noop */ },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    apiKey: 'test-key-123',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    systemPrompt: 'You are a helpful assistant.',
    userPrompt: 'Write a p5.js sketch.',
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

// ── OpenAI Provider ────────────────────────────────────────────────────────

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider(makeConfig());
    mockFetch.mockReset();
  });

  it('sends request to /chat/completions endpoint', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'console.log("hello")' } }],
      model: 'gpt-4',
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const result = await provider.generate(makeRequest());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('includes Authorization header when apiKey is set', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'hello' } }],
      model: 'gpt-4',
    });

    await provider.generate(makeRequest());

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-key-123');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('omits Authorization header when apiKey is empty', async () => {
    const noKeyProvider = new OpenAIProvider(makeConfig({ apiKey: '' }));
    mockFetchResponse({
      choices: [{ message: { content: 'hello' } }],
      model: 'gpt-4',
    });

    await noKeyProvider.generate(makeRequest());

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('parses successful response with content and usage', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'function setup() {}' } }],
      model: 'gpt-4-0613',
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('function setup() {}');
    expect(result.value.model).toBe('gpt-4-0613');
    expect(result.value.usage?.inputTokens).toBe(50);
    expect(result.value.usage?.outputTokens).toBe(20);
  });

  it('returns error response on API failure', async () => {
    mockFetchResponse({ error: 'rate limited' }, 429, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('429');
  });

  it('sends messages with system and user roles', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'gpt-4',
    });

    await provider.generate(makeRequest({
      systemPrompt: 'Be creative',
      userPrompt: 'Make art',
    }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('Be creative');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('Make art');
  });

  it('sends image inputs as OpenAI multimodal content parts', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'gpt-4o',
    });

    await provider.generate(makeRequest({
      userPrompt: 'Judge this render',
      imageInputs: [{ mimeType: 'image/png', dataBase64: 'abc123', width: 2, height: 2 }],
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'Judge this render' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
    ]);
  });

  it('adds reasoning_effort for thinking-capable models', async () => {
    mockCapabilities.thinking = true;
    mockCapabilities.thinkingStyle = 'effort_level';
    mockFetchResponse({
      choices: [{ message: { content: 'deep thought' } }],
      model: 'gpt-4',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true, effort: 'high' },
    }));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.reasoning_effort).toBe('high');

    // Reset
    mockCapabilities.thinking = false;
    mockCapabilities.thinkingStyle = 'none';
  });

  it('returns success=false with a diagnostic error when content is empty and no thinking', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' } }],
      model: 'gpt-4',
    });

    const result = await provider.generate(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(false);
    expect(result.value.error).toContain('OpenAI-compatible provider returned no usable content');
    expect(result.value.error).toContain('content_kind=string');
  });

  it('extracts text content from array-shaped message content', async () => {
    mockFetchResponse({
      choices: [{
        message: {
          content: [
            { type: 'text', text: 'function setup() {' },
            { type: 'text', text: '  createCanvas(400, 400);' },
            { type: 'text', text: '}' },
          ],
        },
      }],
      model: 'glm-5.1',
    });

    const result = await provider.generate(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toContain('function setup() {');
    expect(result.value.content).toContain('createCanvas(400, 400);');
  });

  it('falls back to model from config when response has no model', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
    });

    const result = await provider.generate(makeRequest());
    expect(result.value.model).toBe('gpt-4');
  });
});

// ── Anthropic Provider ─────────────────────────────────────────────────────

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider(makeConfig({
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
    }));
    mockFetch.mockReset();
  });

  it('sends request to /v1/messages endpoint', async () => {
    mockFetchResponse({
      content: [{ type: 'text', text: 'Hello from Claude' }],
      model: 'claude-sonnet-4-20250514',
      usage: { input_tokens: 30, output_tokens: 10 },
    });

    await provider.generate(makeRequest());

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('includes x-api-key and anthropic-version headers', async () => {
    mockFetchResponse({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-20250514',
    });

    await provider.generate(makeRequest());

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['x-api-key']).toBe('test-key-123');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('sends system prompt as top-level system field', async () => {
    mockFetchResponse({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-20250514',
    });

    await provider.generate(makeRequest({ systemPrompt: 'You are creative' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('You are creative');
    // Anthropic puts user in messages, not system
    expect(body.messages).toEqual([{ role: 'user', content: 'Write a p5.js sketch.' }]);
  });

  it('sends image inputs as Anthropic image blocks', async () => {
    mockFetchResponse({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-20250514',
    });

    await provider.generate(makeRequest({
      userPrompt: 'Judge this render',
      imageInputs: [{ mimeType: 'image/png', dataBase64: 'abc123' }],
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'Judge this render' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
    ]);
  });

  it('parses content blocks correctly', async () => {
    mockFetchResponse({
      content: [
        { type: 'text', text: 'function setup() ' },
        { type: 'text', text: '{ createCanvas(400,400); }' },
      ],
      model: 'claude-sonnet-4-20250514',
      usage: { input_tokens: 20, output_tokens: 15 },
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toContain('function setup()');
    expect(result.value.content).toContain('createCanvas(400,400)');
    expect(result.value.usage?.inputTokens).toBe(20);
    expect(result.value.usage?.outputTokens).toBe(15);
  });

  it('returns error on API failure', async () => {
    mockFetchResponse({ error: 'overloaded' }, 529, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('529');
  });

  it('omits temperature when thinking is enabled (Anthropic restriction)', async () => {
    mockCapabilities.thinking = true;
    mockFetchResponse({
      content: [{ type: 'text', text: 'deep answer' }],
      model: 'claude-sonnet-4-20250514',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true, budgetTokens: 8000 },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.temperature).toBeUndefined();
    expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 8000 });

    mockCapabilities.thinking = false;
  });

  it('returns success=false for empty content', async () => {
    mockFetchResponse({
      content: [],
      model: 'claude-sonnet-4-20250514',
    });

    const result = await provider.generate(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(false);
  });
});

// ── Ollama Provider ────────────────────────────────────────────────────────

describe('OllamaProvider', () => {
  describe('native mode (no /v1 suffix)', () => {
    let provider: OllamaProvider;

    beforeEach(() => {
      provider = new OllamaProvider(makeConfig({
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
        apiKey: '',
      }));
      mockFetch.mockReset();
    });

    it('sends to /api/generate endpoint in native mode', async () => {
      mockFetchResponse({ response: 'hello from ollama', eval_count: 20, prompt_eval_count: 10 });

      await provider.generate(makeRequest());

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/generate');
    });

    it('sends system and prompt as separate fields', async () => {
      mockFetchResponse({ response: 'ok' });

      await provider.generate(makeRequest({
        systemPrompt: 'Be helpful',
        userPrompt: 'Say hi',
      }));

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe('Be helpful');
      expect(body.prompt).toBe('Say hi');
      expect(body.stream).toBe(false);
    });

    it('parses native response with usage', async () => {
      mockFetchResponse({
        response: 'native output',
        eval_count: 30,
        prompt_eval_count: 15,
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
      expect(result.value.content).toBe('native output');
      expect(result.value.usage?.inputTokens).toBe(15);
      expect(result.value.usage?.outputTokens).toBe(30);
    });

    it('returns error on failed native request', async () => {
      mockFetchResponse({}, 500, false);

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toContain('500');
    });
  });

  describe('OpenAI-compat mode (/v1 suffix)', () => {
    let provider: OllamaProvider;

    beforeEach(() => {
      provider = new OllamaProvider(makeConfig({
        baseUrl: 'http://localhost:11434/v1',
        model: 'qwen2.5-coder',
        apiKey: '',
      }));
      mockFetch.mockReset();
    });

    it('sends to /chat/completions in compat mode', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'compat output' } }],
        model: 'qwen2.5-coder',
      });

      await provider.generate(makeRequest());

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/v1/chat/completions');
    });

    it('uses messages format in compat mode', async () => {
      mockFetchResponse({
        choices: [{ message: { content: 'ok' } }],
        model: 'qwen2.5-coder',
      });

      await provider.generate(makeRequest());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
    });

    it('returns error on compat mode failure', async () => {
      mockFetchResponse({}, 503, false);

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toContain('Ollama OpenAI-compat error');
    });
  });
});

// ── OpenRouter Provider ────────────────────────────────────────────────────

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    provider = new OpenRouterProvider(makeConfig({
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'anthropic/claude-sonnet-4',
    }));
    mockFetch.mockReset();
  });

  it('sends extra HTTP-Referer and X-Title headers', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'anthropic/claude-sonnet-4',
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });

    await provider.generate(makeRequest());

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['HTTP-Referer']).toBe('https://liminal.art');
    expect(options.headers['X-Title']).toBe('Liminal');
  });

  it('includes reasoning parameter when thinking is enabled', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'reasoned output' } }],
      model: 'anthropic/claude-sonnet-4',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true, effort: 'high' },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ effort: 'high' });
  });

  it('defaults reasoning effort to high when not specified', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'reasoned' } }],
      model: 'anthropic/claude-sonnet-4',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reasoning).toEqual({ effort: 'high' });
  });

  it('parses response with usage data', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'result' } }],
      model: 'anthropic/claude-sonnet-4',
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('result');
    expect(result.value.usage?.inputTokens).toBe(100);
    expect(result.value.usage?.outputTokens).toBe(50);
  });

  it('returns error on API failure', async () => {
    mockFetchResponse({ error: 'unauthorized' }, 401, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('401');
  });

  it('returns success=false with a diagnostic error when content is empty', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
      model: 'z-ai/glm-5.1:nitro',
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(false);
    expect(result.value.error).toContain('OpenRouter provider returned no usable content');
    expect(result.value.error).toContain('content_kind=string');
  });
});

// ── Google Provider ────────────────────────────────────────────────────────

describe('GoogleProvider', () => {
  let provider: GoogleProvider;

  beforeEach(() => {
    provider = new GoogleProvider(makeConfig({
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.5-pro',
      apiKey: 'google-key-456',
    }));
    mockFetch.mockReset();
  });

  it('sends request to correct Gemini endpoint', async () => {
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
      modelVersion: 'gemini-2.5-pro-001',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
    });

    await provider.generate(makeRequest());

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain(':generateContent');
    expect(url).toContain('key=google-key-456');
  });

  it('sends systemInstruction for system prompt', async () => {
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    await provider.generate(makeRequest({ systemPrompt: 'Be artistic' }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be artistic' }] });
  });

  it('sends image inputs as Gemini inlineData parts', async () => {
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    await provider.generate(makeRequest({
      userPrompt: 'Judge this render',
      imageInputs: [{ mimeType: 'image/png', dataBase64: 'abc123' }],
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents[0].parts).toEqual([
      { text: 'Judge this render' },
      { inlineData: { mimeType: 'image/png', data: 'abc123' } },
    ]);
  });

  it('separates thinking blocks from content blocks', async () => {
    mockFetchResponse({
      candidates: [{
        content: {
          parts: [
            { text: 'Let me think...', thought: true },
            { text: 'Here is the code.' },
          ],
        },
      }],
      modelVersion: 'gemini-2.5-pro',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 8 },
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('Here is the code.');
    expect(result.value.thinking?.text).toBe('Let me think...');
    expect(result.value.thinking?.budgetUsed).toBe(8);
  });

  it('defaults to generativelanguage.googleapis.com when baseUrl is generic', async () => {
    const genericProvider = new GoogleProvider(makeConfig({
      baseUrl: 'https://custom-proxy.example.com',
      model: 'gemini-2.5-flash',
      apiKey: 'key',
    }));
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      modelVersion: 'gemini-2.5-flash',
    });

    await genericProvider.generate(makeRequest());

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
  });

  it('returns error on API failure', async () => {
    mockFetchResponse({ error: 'quota exceeded' }, 429, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('429');
  });

  it('returns success=false when content is empty', async () => {
    mockFetchResponse({
      candidates: [{ content: { parts: [] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    const result = await provider.generate(makeRequest());
    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(false);
  });

  it('stream() yields not-implemented error', async () => {
    const events: unknown[] = [];
    for await (const event of provider.stream(makeRequest())) {
      events.push(event);
    }

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'error',
      error: expect.stringContaining('not yet implemented'),
    });
  });

  it('adds thinkingBudget when thinking enabled with budgetTokens', async () => {
    mockCapabilities.thinking = true;
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'deep thinking' }] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true, budgetTokens: 16000 },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingBudget).toBe(16000);

    mockCapabilities.thinking = false;
  });

  it('adds thinkingLevel when thinking enabled with effort', async () => {
    mockCapabilities.thinking = true;
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'result' }] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true, effort: 'low' },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingLevel).toBe('low');

    mockCapabilities.thinking = false;
  });

  it('defaults thinkingBudget to 8000 when thinking enabled without budget or effort', async () => {
    mockCapabilities.thinking = true;
    mockFetchResponse({
      candidates: [{ content: { parts: [{ text: 'result' }] } }],
      modelVersion: 'gemini-2.5-pro',
    });

    await provider.generate(makeRequest({
      thinking: { enabled: true },
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.generationConfig.thinkingBudget).toBe(8000);

    mockCapabilities.thinking = false;
  });
});

// ── MiniMax Provider ───────────────────────────────────────────────────────

describe('MiniMaxProvider', () => {
  let provider: MiniMaxProvider;

  beforeEach(() => {
    provider = new MiniMaxProvider(makeConfig({
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'minimax-key-789',
    }));
    mockFetch.mockReset();
  });

  it('sends request with Bearer authorization', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'MiniMax output' } }],
      model: 'MiniMax-M2.7',
      usage: { prompt_tokens: 15, completion_tokens: 10 },
    });

    await provider.generate(makeRequest());

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer minimax-key-789');
  });

  it('sends image inputs as OpenAI-compatible multimodal content parts', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'MiniMax-M2.7',
    });

    await provider.generate(makeRequest({
      userPrompt: 'Judge this render',
      imageInputs: [{ mimeType: 'image/png', dataBase64: 'abc123' }],
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'Judge this render' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
    ]);
  });

  it('parses normal response correctly', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'Generated code here' } }],
      model: 'MiniMax-M2.7',
      usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('Generated code here');
    expect(result.value.usage?.inputTokens).toBe(20);
    expect(result.value.usage?.outputTokens).toBe(30);
  });

  it('falls back to reasoning_content when content is empty', async () => {
    mockFetchResponse({
      choices: [{
        message: {
          content: '',
          reasoning_content: 'function setup() { createCanvas(400,400); }',
        },
      }],
      model: 'MiniMax-M2.7',
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toContain('createCanvas');
  });

  it('falls back to data.output for alternative response structure', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' } }],
      output: { text: 'output-based content' },
      model: 'MiniMax-Text-01',
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('output-based content');
  });

  it('falls back to string output for alternative response structure', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' } }],
      output: 'string-output-content',
      model: 'MiniMax-Text-01',
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);
    expect(result.value.content).toBe('string-output-content');
  });

  it('returns error on API failure', async () => {
    mockFetchResponse({ error: 'bad request' }, 400, false);

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('400');
  });

  it('handles network/fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await provider.generate(makeRequest());

    expect(result.isErr()).toBe(true);
    expect(result.error.message).toContain('ECONNREFUSED');
  });

  it('returns success=false with empty content when all fallbacks fail', async () => {
    mockFetchResponse({
      choices: [{ message: { content: '' } }],
      model: 'MiniMax-M2.7',
    });

    const result = await provider.generate(makeRequest());

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(false);
    expect(result.value.content).toBe('');
  });

  it('defaults temperature to 0.7 when not specified', async () => {
    mockFetchResponse({
      choices: [{ message: { content: 'ok' } }],
      model: 'MiniMax-M2.7',
    });

    const noTempProvider = new MiniMaxProvider(makeConfig({
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.7',
      apiKey: 'key',
      temperature: undefined,
    }));

    await noTempProvider.generate(makeRequest({ temperature: undefined }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.7);
  });
});
