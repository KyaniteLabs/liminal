// Allow localhost for tests
process.env.LIMINAL_ALLOW_LOCALHOST_LLM = "true";

/**
 * Provider Pipeline Smoke Tests
 *
 * End-to-end tests that verify the full LLM provider pipeline works
 * using mock HTTP responses instead of live APIs. Tests cover:
 *   1. OpenAI provider -> response parsing
 *   2. Anthropic provider -> thinking extraction
 *   3. Ollama provider -> think tag stripping
 *   4. CapabilityRegistry integration
 *   5. RoleConfig resolution from environment variables
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

// Block real ~/.liminal/config.json so env var tests are isolated
const _userConfigPath = path.join(os.homedir(), '.liminal', 'config.json');
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(((...args: [string, ...unknown[]]) => {
      if (args[0] === _userConfigPath) {
        return Promise.reject(new Error('mock: no user config for tests'));
      }
      return actual.readFile(...args);
    }) as unknown as typeof actual.readFile),
  };
});

import { LLMClient, sanitizeOutput } from '../../src/llm/LLMClient.js';
import { CapabilityRegistry } from '../../src/llm/CapabilityRegistry.js';
import { loadRoleConfig } from '../../src/config/RoleConfig.js';
import type { ModelRole } from '../../src/config/RoleConfig.js';

// ── Mock fetch globally ──

const mockFetch = vi.hoisted(() => vi.fn());

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  CapabilityRegistry.clearOverrides();
  // Clear LLMClient static role cache between tests
  (LLMClient as any).roleConfigs = null;
});

// ── Helpers ──

/** Create a mock fetch Response that returns JSON */
function mockJsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'content-type': 'application/json' }),
    body: null,
  };
}

/** Create a mock fetch Response for the /models endpoint (LM Studio auto-detect) */
function mockModelsResponse(models: string[] = ['test-model']) {
  return mockJsonResponse({
    data: models.map(id => ({ id })),
  });
}

/**
 * Set up env vars for a specific role.
 * The `env()` utility in src/utils/env.ts prepends `LIMINAL_` to the key.
 * So env('LLM_BASE_URL') reads process.env.LIMINAL_LLM_BASE_URL.
 */
function setRoleEnvVars(
  role: ModelRole,
  config: { baseUrl: string; model: string; apiKey?: string },
) {
  const roleEnvMap: Record<ModelRole, { baseUrl: string[]; model: string[]; apiKey: string[] }> = {
    generator: {
      baseUrl: ['LIMINAL_LLM_BASE_URL'],
      model: ['LIMINAL_LLM_MODEL'],
      apiKey: ['LIMINAL_LLM_API_KEY'],
    },
    evaluator: {
      baseUrl: ['LIMINAL_EVALUATOR_BASE_URL', 'LIMINAL_LLM_BASE_URL'],
      model: ['LIMINAL_EVALUATOR_MODEL', 'LIMINAL_LLM_MODEL'],
      apiKey: ['LIMINAL_EVALUATOR_API_KEY', 'LIMINAL_LLM_API_KEY'],
    },
    harness: {
      baseUrl: ['LIMINAL_HARNESS_BASE_URL', 'LIMINAL_LLM_BASE_URL'],
      model: ['LIMINAL_HARNESS_MODEL', 'LIMINAL_LLM_MODEL'],
      apiKey: ['LIMINAL_HARNESS_API_KEY', 'LIMINAL_LLM_API_KEY'],
    },
  };

  const envKeys = roleEnvMap[role];
  process.env[envKeys.baseUrl[0]] = config.baseUrl;
  process.env[envKeys.model[0]] = config.model;
  if (config.apiKey) {
    process.env[envKeys.apiKey[0]] = config.apiKey;
  }
}

function clearRoleEnvVars() {
  const allKeys = [
    'LIMINAL_LLM_BASE_URL', 'LIMINAL_LLM_MODEL', 'LIMINAL_LLM_API_KEY',
    'LIMINAL_EVALUATOR_BASE_URL', 'LIMINAL_EVALUATOR_MODEL', 'LIMINAL_EVALUATOR_API_KEY',
    'LIMINAL_HARNESS_BASE_URL', 'LIMINAL_HARNESS_MODEL', 'LIMINAL_HARNESS_API_KEY',
    'OPENAI_API_KEY',
  ];
  for (const key of allKeys) {
    delete process.env[key];
  }
}

// ──────────────────────────────────────────────────────────────
// 1. OpenAI Provider -> Response Parsing
// ──────────────────────────────────────────────────────────────

describe('OpenAI provider pipeline', () => {
  it('fails fast when no local model can be auto-detected', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234/v1',
      model: 'auto',
    });

    await expect(client.generate('You are a coder.', 'Say hello.')).rejects.toThrow(/No local LLM model detected/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('parses a standard chat completion response', async () => {
    // Mock: /v1/models (auto-detect call) -> /v1/chat/completions
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['gpt-4o'])) // resolveModel()
      .mockResolvedValueOnce(mockJsonResponse({
        choices: [{
          message: { content: 'console.log("hello")' },
          finish_reason: 'stop',
        }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234/v1',
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    const result = await client.generate('You are a coder.', 'Say hello.');

    expect(result.success).toBe(true);
    expect(result.code).toContain('console.log("hello")');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify the completion call was to the right endpoint
    const completionCall = mockFetch.mock.calls[1];
    expect(completionCall[0]).toBe('http://localhost:1234/v1/chat/completions');
    const body = JSON.parse(completionCall[1].body as string);
    expect(body.model).toBe('gpt-4o');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
  });

  it('handles code wrapped in markdown fences', async () => {
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['gpt-4o']))
      .mockResolvedValueOnce(mockJsonResponse({
        choices: [{
          message: { content: 'Here is the code:\n```javascript\nfunction hello() {\n  return 42;\n}\n```' },
          finish_reason: 'stop',
        }],
        model: 'gpt-4o',
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234/v1',
      model: 'gpt-4o',
    });

    const result = await client.generate('Write code.', 'hello function');

    expect(result.success).toBe(true);
    expect(result.code).toContain('function hello()');
    expect(result.code).not.toContain('```');
  });

  it('reports failure on API error', async () => {
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['gpt-4o']))
      .mockResolvedValue(mockJsonResponse(
        { error: { message: 'Rate limited', type: 'rate_limit_error' } },
        false,
        429,
      ));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234/v1',
      model: 'gpt-4o',
      apiKey: 'test-key',
    });

    await expect(client.generate('system', 'user')).rejects.toThrow(/429|Rate limited/);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Anthropic Provider -> Thinking Extraction
// ──────────────────────────────────────────────────────────────

describe('Anthropic provider pipeline', () => {
  it('extracts thinking blocks from content array', async () => {
    // Anthropic uses baseUrl/v1/messages
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['claude-sonnet-4-20250514']))
      .mockResolvedValueOnce(mockJsonResponse({
        content: [
          { type: 'thinking', thinking: 'Let me reason through this step by step...' },
          { type: 'text', text: 'console.log("result")' },
        ],
        model: 'claude-sonnet-4-20250514',
        usage: { input_tokens: 20, output_tokens: 15 },
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-anthropic-key',
    });

    const result = await client.generate('You are a coder.', 'Write hello.');

    expect(result.success).toBe(true);
    expect(result.code).toContain('console.log("result")');
    // Thinking should be captured via mapProviderResponse
    expect(result.thinking).toBeDefined();
    expect(result.thinking).toContain('reason through this');

    // Verify Anthropic-specific request format
    const completionCall = mockFetch.mock.calls[1];
    expect(completionCall[0]).toBe('http://localhost:1234/v1/messages');
    const body = JSON.parse(completionCall[1].body as string);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    // Anthropic: system prompt is top-level, messages only has user
    expect(body.system).toBe('You are a coder.');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('works without thinking blocks (text-only response)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['claude-sonnet-4-20250514']))
      .mockResolvedValueOnce(mockJsonResponse({
        content: [
          { type: 'text', text: 'const x = 1;' },
        ],
        model: 'claude-sonnet-4-20250514',
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:1234',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });

    const result = await client.generate('system', 'user');

    expect(result.success).toBe(true);
    expect(result.code).toContain('const x = 1');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Ollama Provider -> Think Tag Stripping
// ──────────────────────────────────────────────────────────────

describe('Ollama provider pipeline', () => {
  it('strips <think/> tags from native response content', async () => {
    // Ollama native API: baseUrl/api/generate
    const ollamaThinkResponse = [
      '<think type="reasoning">',
      'deeper analysis',
      '</think' + '>',
      'console.log("hello")',
    ].join('\n');

    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['deepseek-r1:8b']))
      .mockResolvedValueOnce(mockJsonResponse({
        response: ollamaThinkResponse,
        model: 'deepseek-r1:8b',
        done: true,
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:11434',
      model: 'deepseek-r1:8b',
    });

    const result = await client.generate('You are a coder.', 'Say hello.');

    expect(result.success).toBe(true);
    // The sanitizeOutput in LLMClient.mapProviderResponse strips <think/> tags
    expect(result.code).toContain('console.log("hello")');
    expect(result.code).not.toContain('<think');
  });

  it('works with think field provided by Ollama', async () => {
    // Some Ollama versions return 'thinking' as a separate field
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['deepseek-r1:8b']))
      .mockResolvedValueOnce(mockJsonResponse({
        response: 'console.log("clean")',
        thinking: 'I should output a simple hello',
        model: 'deepseek-r1:8b',
        done: true,
        eval_count: 10,
        prompt_eval_count: 5,
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:11434',
      model: 'deepseek-r1:8b',
    });

    const result = await client.generate('system', 'user');

    expect(result.success).toBe(true);
    expect(result.code).toContain('console.log("clean")');
    // thinking should be captured via ThinkingNormalizer
    expect(result.thinking).toBeDefined();
    expect(result.thinking).toContain('simple hello');
  });

  it('handles OpenAI-compatible endpoint (/v1)', async () => {
    mockFetch
      .mockResolvedValueOnce(mockModelsResponse(['gemma-4-31b-it']))
      .mockResolvedValueOnce(mockJsonResponse({
        choices: [{
          message: { content: 'function draw() { background(0); }' },
          finish_reason: 'stop',
        }],
        model: 'gemma-4-31b-it',
      }));

    const client = new LLMClient({
      baseUrl: 'http://localhost:11434/v1',
      model: 'gemma-4-31b-it',
    });

    const result = await client.generate('system', 'user');

    expect(result.success).toBe(true);
    expect(result.code).toContain('function draw()');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. CapabilityRegistry Integration
// ──────────────────────────────────────────────────────────────

describe('CapabilityRegistry', () => {
  it('reports thinking capabilities for gemma-4-31b-it', () => {
    const caps = CapabilityRegistry.getCapabilities('gemma-4-31b-it');

    expect(caps.thinking).toBe(true);
    expect(caps.thinkingStyle).toBe('think_tags');
    expect(caps.streaming).toBe(true);
    expect(caps.jsonMode).toBe(true);
    expect(caps.maxContextTokens).toBe(256000);
  });

  it('reports no thinking for gpt-4o', () => {
    const caps = CapabilityRegistry.getCapabilities('gpt-4o');

    expect(caps.thinking).toBe(false);
    expect(caps.thinkingStyle).toBe('none');
    expect(caps.streaming).toBe(true);
    expect(caps.jsonMode).toBe(true);
    expect(caps.maxContextTokens).toBe(128000);
  });

  it('reports budget_tokens thinking for Claude Sonnet 4', () => {
    const caps = CapabilityRegistry.getCapabilities('claude-sonnet-4-20250514');

    expect(caps.thinking).toBe(true);
    expect(caps.thinkingStyle).toBe('budget_tokens');
    expect(caps.maxContextTokens).toBe(200000);
  });

  it('reports effort_level thinking for GPT-5', () => {
    const caps = CapabilityRegistry.getCapabilities('gpt-5-turbo');

    expect(caps.thinking).toBe(true);
    expect(caps.thinkingStyle).toBe('effort_level');
    expect(caps.maxContextTokens).toBe(400000);
  });

  it('reports think_tags for DeepSeek R1', () => {
    const caps = CapabilityRegistry.getCapabilities('deepseek-r1:8b');

    expect(caps.thinking).toBe(true);
    expect(caps.thinkingStyle).toBe('think_tags');
  });

  it('returns conservative defaults for unknown models', () => {
    const caps = CapabilityRegistry.getCapabilities('totally-unknown-model-v999');

    expect(caps.thinking).toBe(false);
    expect(caps.thinkingStyle).toBe('none');
    expect(caps.streaming).toBe(true);
    expect(caps.jsonMode).toBe(true);
    expect(caps.maxContextTokens).toBe(4096);
  });

  it('allows user overrides that take priority', () => {
    CapabilityRegistry.override('my-custom-model', {
      thinking: true,
      thinkingStyle: 'think_tags',
      maxContextTokens: 999999,
    });

    const caps = CapabilityRegistry.getCapabilities('my-custom-model');

    expect(caps.thinking).toBe(true);
    expect(caps.thinkingStyle).toBe('think_tags');
    expect(caps.maxContextTokens).toBe(999999);
  });
});

// ──────────────────────────────────────────────────────────────
// 5. RoleConfig Resolution
// ──────────────────────────────────────────────────────────────

describe('RoleConfig resolution', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear all role-related env vars
    const envKeys = [
      'LIMINAL_LLM_BASE_URL', 'LIMINAL_LLM_MODEL', 'LIMINAL_LLM_API_KEY',
      'LIMINAL_EVALUATOR_BASE_URL', 'LIMINAL_EVALUATOR_MODEL', 'LIMINAL_EVALUATOR_API_KEY',
      'LIMINAL_HARNESS_BASE_URL', 'LIMINAL_HARNESS_MODEL', 'LIMINAL_HARNESS_API_KEY',
      'OPENAI_API_KEY',
    ];
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) {
        process.env[key] = val;
      } else {
        delete process.env[key];
      }
    }
  });

  it('generator role uses LLM_BASE_URL env var', async () => {
    setRoleEnvVars('generator', {
      baseUrl: 'http://localhost:9999/v1',
      model: 'test-generator-model',
      apiKey: 'gen-key-123',
    });

    const roles = await loadRoleConfig('/tmp/nonexistent-config-dir');

    expect(roles.generator.baseUrl).toBe('http://localhost:9999/v1');
    expect(roles.generator.model).toBe('test-generator-model');
    expect(roles.generator.apiKey).toBe('gen-key-123');
    // Generator default temperature
    expect(roles.generator.temperature).toBe(0.7);
  });

  it('evaluator role falls back to generic LLM vars', async () => {
    // Set only generic LLM vars, not evaluator-specific ones
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:5555/v1';
    process.env.LIMINAL_LLM_MODEL = 'fallback-model';
    process.env.LIMINAL_LLM_API_KEY = 'fallback-key';

    const roles = await loadRoleConfig('/tmp/nonexistent-config-dir');

    expect(roles.evaluator.baseUrl).toBe('http://localhost:5555/v1');
    expect(roles.evaluator.model).toBe('fallback-model');
    expect(roles.evaluator.apiKey).toBe('fallback-key');
    // Evaluator default temperature
    expect(roles.evaluator.temperature).toBe(0.2);
  });

  it('harness role uses its own vars when set', async () => {
    setRoleEnvVars('harness', {
      baseUrl: 'http://localhost:7777/v1',
      model: 'harness-specific-model',
      apiKey: 'harness-key',
    });

    const roles = await loadRoleConfig('/tmp/nonexistent-config-dir');

    expect(roles.harness.baseUrl).toBe('http://localhost:7777/v1');
    expect(roles.harness.model).toBe('harness-specific-model');
    expect(roles.harness.apiKey).toBe('harness-key');
    // Harness default temperature
    expect(roles.harness.temperature).toBe(0.5);
    // Harness defaults to streaming
    expect(roles.harness.streaming).toBe(true);
  });

  it('LLMClient constructor resolves generator role from env', () => {
    setRoleEnvVars('generator', {
      baseUrl: 'http://localhost:8888/v1',
      model: 'role-test-model',
    });

    const client = new LLMClient({ role: 'generator' });
    const config = client.getConfig();

    expect(config.baseUrl).toBe('http://localhost:8888/v1');
    expect(config.model).toBe('role-test-model');
    expect(client.getRole()).toBe('generator');
  });

  it('LLMClient constructor uses explicit config over role env', () => {
    setRoleEnvVars('generator', {
      baseUrl: 'http://localhost:8888/v1',
      model: 'role-test-model',
    });

    const client = new LLMClient({
      role: 'generator',
      baseUrl: 'http://localhost:1111/v1',
      model: 'explicit-model',
    });
    const config = client.getConfig();

    // Explicit config should take priority over role resolution
    expect(config.baseUrl).toBe('http://localhost:1111/v1');
    expect(config.model).toBe('explicit-model');
  });
});

// ──────────────────────────────────────────────────────────────
// 6. sanitizeOutput utility
// ──────────────────────────────────────────────────────────────

describe('sanitizeOutput utility', () => {
  it('strips <think/> tags from raw content', () => {
    const thinkContent = '<think type="reasoning">reasoning here</think' + '>' + '\nconsole.log("done")';
    const result = sanitizeOutput(thinkContent);
    expect(result.code).toContain('console.log("done")');
    expect(result.code).not.toContain('<think');
    expect(result.success).toBe(true);
  });

  it('extracts code from markdown fences', () => {
    const result = sanitizeOutput('```javascript\nconst x = 42;\n```');
    expect(result.code).toBe('const x = 42;');
    expect(result.success).toBe(true);
  });

  it('strips leading narrative text before code', () => {
    const result = sanitizeOutput('Here is the code you requested:\nconst y = 99;');
    expect(result.code).toContain('const y = 99;');
    expect(result.code).not.toContain('Here is');
  });

  it('reports isComplete for balanced braces', () => {
    const result = sanitizeOutput('function foo() { return 1; }');
    expect(result.isComplete).toBe(true);
  });

  it('reports !isComplete for unbalanced braces', () => {
    const result = sanitizeOutput('function foo() { return 1;');
    expect(result.isComplete).toBe(false);
  });

  it('handles empty content', () => {
    const result = sanitizeOutput('');
    expect(result.success).toBe(false);
  });
});
