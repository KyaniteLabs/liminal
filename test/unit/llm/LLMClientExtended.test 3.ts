import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// SECURITY NOTICE: All API keys in this file are FAKE test values.
// ============================================================================

import {
  LLMClient,
  sanitizeOutput,
  sanitizeOutputWithReasoning,
  isCodeComplete,
  LLMError,
  LLMTimeoutError,
  LLMAuthError,
  LLMRateLimitError,
} from '../../../src/llm/LLMClient.js';

// The env() utility wraps process.env with LIMINAL_ prefix
// env('LLM_BASE_URL') => process.env.LIMINAL_LLM_BASE_URL

describe('sanitizeOutput', () => {
  it('extracts code from markdown fences', () => {
    const input = 'Here is the code:\n```javascript\nconst x = 1;\n```';
    const result = sanitizeOutput(input);

    expect(result.code).toBe('const x = 1;');
    expect(result.success).toBe(true);
    expect(result.isComplete).toBe(true);
  });

  it('strips <think/> tags before processing', () => {
    const input = '<think reasoning>some thought</think>const x = 1;';
    const result = sanitizeOutput(input);

    expect(result.code).toBe('const x = 1;');
    expect(result.success).toBe(true);
  });

  it('strips leading narrative text before code', () => {
    const input = "Here is my solution:\nLet me write some code.\nconst result = 42;";
    const result = sanitizeOutput(input);

    expect(result.code).toBe('const result = 42;');
    expect(result.success).toBe(true);
  });

  it('detects code starting with function keyword', () => {
    const input = "I'll create a function.\nfunction hello() { return 'world'; }";
    const result = sanitizeOutput(input);

    expect(result.code).toBe("function hello() { return 'world'; }");
    expect(result.success).toBe(true);
  });

  it('detects code starting with class keyword', () => {
    const input = 'class MyClass {\n  constructor() {}\n}';
    const result = sanitizeOutput(input);

    expect(result.code).toContain('class MyClass');
  });

  it('detects code starting with import keyword', () => {
    const input = "import { foo } from 'bar';\nconst x = foo;";
    const result = sanitizeOutput(input);

    expect(result.code).toContain("import { foo } from 'bar'");
  });

  it('detects HTML DOCTYPE as code start', () => {
    const input = 'Here is the HTML:\n<!DOCTYPE html><html></html>';
    const result = sanitizeOutput(input);

    expect(result.code).toContain('<!DOCTYPE html>');
  });

  it('detects HTML <html> as code start', () => {
    const input = '<html><body>Hello</body></html>';
    const result = sanitizeOutput(input);

    expect(result.code).toContain('<html>');
  });

  it('detects <script> as code start', () => {
    const input = '<script>console.log("hi")</script>';
    const result = sanitizeOutput(input);

    expect(result.code).toContain('<script>');
  });

  it('detects export keyword as code start', () => {
    const input = "Here's the module:\nexport const foo = 'bar';";
    const result = sanitizeOutput(input);

    expect(result.code).toBe("export const foo = 'bar';");
  });

  it('detects return keyword as code start', () => {
    const input = 'return 42;';
    const result = sanitizeOutput(input);

    expect(result.code).toBe('return 42;');
  });

  it('returns success=false for empty content', () => {
    const result = sanitizeOutput('');

    expect(result.code).toBe('');
    expect(result.success).toBe(false);
  });

  it('returns success=false for whitespace-only content after stripping', () => {
    const result = sanitizeOutput('   \n   ');

    expect(result.success).toBe(false);
  });

  it('handles multiple <think/> tags', () => {
    const input = '<think step 1>first</think><think step 2>second</think>const x = 1;';
    const result = sanitizeOutput(input);

    expect(result.code).toBe('const x = 1;');
    expect(result.success).toBe(true);
  });
});

describe('sanitizeOutputWithReasoning', () => {
  it('extracts reasoning from <think/> tags', () => {
    const input = '<think >analyze the problem</think>const x = 1;';
    const result = sanitizeOutputWithReasoning(input);

    expect(result.sanitized.code).toBe('const x = 1;');
    expect(result.sanitized.success).toBe(true);
    expect(result.extractedReasoning).toContain('analyze the problem');
  });

  it('extracts narrative before markdown fence as reasoning', () => {
    const input = "Let me think about this.\nHere's my approach:\n```javascript\nconst x = 1;\n```";
    const result = sanitizeOutputWithReasoning(input);

    expect(result.sanitized.code).toBe('const x = 1;');
    expect(result.extractedReasoning).toContain("Let me think about this.");
    expect(result.extractedReasoning).toContain("Here's my approach:");
  });

  it('combines think tags and narrative reasoning', () => {
    const input = '<think>step 1</think>Narrative text here\n```js\ncode here\n```';
    const result = sanitizeOutputWithReasoning(input);

    expect(result.sanitized.code).toBe('code here');
    expect(result.extractedReasoning).toContain('step 1');
    expect(result.extractedReasoning).toContain('Narrative text here');
  });

  it('extracts reasoning from narrative-only content (no fences, no think tags)', () => {
    const input = "Here is my solution.\nLet me write some code.\nconst x = 42;";
    const result = sanitizeOutputWithReasoning(input);

    expect(result.sanitized.code).toBe('const x = 42;');
    expect(result.extractedReasoning).toContain("Here is my solution.");
    expect(result.extractedReasoning).toContain("Let me write some code.");
  });

  it('returns empty reasoning when there is only code', () => {
    const input = 'const x = 1;';
    const result = sanitizeOutputWithReasoning(input);

    expect(result.sanitized.code).toBe('const x = 1;');
    expect(result.extractedReasoning).toBe('');
  });

  it('handles empty input', () => {
    const result = sanitizeOutputWithReasoning('');

    expect(result.sanitized.code).toBe('');
    expect(result.sanitized.success).toBe(false);
    expect(result.extractedReasoning).toBe('');
  });
});

describe('isCodeComplete', () => {
  it('returns true for balanced braces and parens', () => {
    expect(isCodeComplete('function hello() { return 42; }')).toBe(true);
  });

  it('returns false for unmatched opening braces', () => {
    expect(isCodeComplete('function hello() { return 42;')).toBe(false);
  });

  it('returns false for unmatched opening parens', () => {
    expect(isCodeComplete('const x = foo(')).toBe(false);
  });

  it('returns true for code with no braces or parens', () => {
    expect(isCodeComplete('const x = 1;')).toBe(true);
  });

  it('returns true for empty string (0 === 0)', () => {
    expect(isCodeComplete('')).toBe(true);
  });

  it('handles nested balanced structures', () => {
    expect(isCodeComplete('if (a) { foo(b => { return c; }); }')).toBe(true);
  });

  it('handles string containing braces as actual characters', () => {
    // This counts all { and } literally, including inside strings
    const code = 'const s = "{"';
    // 1 open, 0 close -> false
    expect(isCodeComplete(code)).toBe(false);
  });
});

describe('LLMClient constructor and config', () => {
  beforeEach(() => {
    LLMClient.clearGlobalCache();
    delete process.env.LIMINAL_LLM_BASE_URL;
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.LIMINAL_LLM_MODEL;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    LLMClient.clearGlobalCache();
    delete process.env.LIMINAL_LLM_BASE_URL;
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.LIMINAL_LLM_MODEL;
    delete process.env.OPENAI_API_KEY;
  });

  it('creates client with minimal config using defaults', () => {
    const client = new LLMClient();
    const config = client.getConfig();

    expect(config.baseUrl).toBe('http://localhost:1234/v1');
    expect(config.model).toBe('auto');
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
  });

  it('uses provided baseUrl over defaults', () => {
    const client = new LLMClient({ baseUrl: 'https://api.custom.com/v1' });
    const config = client.getConfig();

    expect(config.baseUrl).toBe('https://api.custom.com/v1');
  });

  it('uses provided model over defaults', () => {
    const client = new LLMClient({ model: 'my-custom-model' });
    const config = client.getConfig();

    expect(config.model).toBe('my-custom-model');
  });

  it('uses provided apiKey', () => {
    const client = new LLMClient({ apiKey: 'test-key-123' });
    const config = client.getConfig();

    expect(config.apiKey).toBe('test-key-123');
  });

  it('uses provided temperature', () => {
    const client = new LLMClient({ temperature: 0.3 });
    const config = client.getConfig();

    expect(config.temperature).toBe(0.3);
  });

  it('uses provided maxTokens', () => {
    const client = new LLMClient({ maxTokens: 8192 });
    const config = client.getConfig();

    expect(config.maxTokens).toBe(8192);
  });

  it('reads LIMINAL_LLM_BASE_URL from environment when no config provided', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'https://env-url.com/v1';

    const client = new LLMClient();
    const config = client.getConfig();

    expect(config.baseUrl).toBe('https://env-url.com/v1');
  });

  it('reads LIMINAL_LLM_MODEL from environment when no config provided', () => {
    process.env.LIMINAL_LLM_MODEL = 'env-model';

    const client = new LLMClient();
    const config = client.getConfig();

    expect(config.model).toBe('env-model');
  });

  it('reads LIMINAL_LLM_API_KEY from environment when no config provided', () => {
    process.env.LIMINAL_LLM_API_KEY = 'env-key-456';

    const client = new LLMClient();
    const config = client.getConfig();

    expect(config.apiKey).toBe('env-key-456');
  });

  it('reads OPENAI_API_KEY as fallback for apiKey', () => {
    process.env.OPENAI_API_KEY = 'openai-key-789';

    const client = new LLMClient();
    const config = client.getConfig();

    expect(config.apiKey).toBe('openai-key-789');
  });

  it('explicit config takes priority over environment variables', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'https://env-url.com/v1';
    process.env.LIMINAL_LLM_MODEL = 'env-model';

    const client = new LLMClient({
      baseUrl: 'https://explicit-url.com/v1',
      model: 'explicit-model',
    });
    const config = client.getConfig();

    expect(config.baseUrl).toBe('https://explicit-url.com/v1');
    expect(config.model).toBe('explicit-model');
  });

  it('accepts deprecated apiStyle without error', () => {
    const client = new LLMClient({ apiStyle: 'ollama' });
    const config = client.getConfig();

    expect(config.apiStyle).toBe('ollama');
  });

  it('accepts custom endpointPath', () => {
    const client = new LLMClient({ endpointPath: '/v1/custom/completions' });
    const config = client.getConfig();

    expect(config.endpointPath).toBe('/v1/custom/completions');
  });

  it('accepts custom headers', () => {
    const headers = { 'X-Custom-Header': 'value' };
    const client = new LLMClient({ headers });
    const config = client.getConfig();

    expect(config.headers).toEqual(headers);
  });

  it('accepts transformRequest callback', () => {
    const transformRequest = (body: unknown) => body;
    const client = new LLMClient({ transformRequest });
    const config = client.getConfig();

    expect(config.transformRequest).toBe(transformRequest);
  });

  it('accepts parseResponse callback', () => {
    const parseResponse = (data: unknown) => ({ content: 'test' });
    const client = new LLMClient({ parseResponse });
    const config = client.getConfig();

    expect(config.parseResponse).toBe(parseResponse);
  });
});

describe('LLMClient getSafeConfig', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LIMINAL_LLM_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.LIMINAL_LLM_API_KEY;
  });

  it('redacts API key in safe config', () => {
    const client = new LLMClient({ apiKey: 'secret-key-12345' });
    const safeConfig = client.getSafeConfig();

    expect(safeConfig.apiKey).toBe('[REDACTED]');
    expect(safeConfig.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('returns undefined apiKey when no key is set', () => {
    const client = new LLMClient();
    const safeConfig = client.getSafeConfig();

    expect(safeConfig.apiKey).toBeUndefined();
  });
});

describe('LLMClient getRole', () => {
  it('returns undefined when no role is set', () => {
    const client = new LLMClient();
    expect(client.getRole()).toBeUndefined();
  });

  it('returns the configured role', () => {
    const client = new LLMClient({ role: 'generator' });
    expect(client.getRole()).toBe('generator');
  });

  it('returns evaluator role when configured', () => {
    const client = new LLMClient({ role: 'evaluator' });
    expect(client.getRole()).toBe('evaluator');
  });

  it('returns harness role when configured', () => {
    const client = new LLMClient({ role: 'harness' });
    expect(client.getRole()).toBe('harness');
  });
});

describe('LLMClient cache management', () => {
  it('getCacheStats returns enabled=true and size=0 for fresh client', () => {
    const client = new LLMClient();
    const stats = client.getCacheStats();

    expect(stats.enabled).toBe(true);
    expect(stats.size).toBe(0);
  });

  it('disableCache sets enabled to false', () => {
    const client = new LLMClient();
    client.disableCache();

    const stats = client.getCacheStats();
    expect(stats.enabled).toBe(false);
  });

  it('enableCache re-enables caching', () => {
    const client = new LLMClient();
    client.disableCache();
    client.enableCache();

    const stats = client.getCacheStats();
    expect(stats.enabled).toBe(true);
  });

  it('clearCache resets cache', () => {
    const client = new LLMClient();
    client.clearCache();

    const stats = client.getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.enabled).toBe(true);
  });
});

describe('LLMClient clearGlobalCache', () => {
  it('clears global static caches without error', () => {
    LLMClient.clearGlobalCache();
    expect(true).toBe(true);
  });
});

describe('LLMClient isConfigured', () => {
  beforeEach(() => {
    delete process.env.LIMINAL_LLM_BASE_URL;
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.LIMINAL_LLM_BASE_URL;
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NODE_ENV;
  });

  it('returns false in test environment with no keys', () => {
    expect(LLMClient.isConfigured()).toBe(false);
  });

  it('returns true when LIMINAL_LLM_BASE_URL is set', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    expect(LLMClient.isConfigured()).toBe(true);
  });

  it('returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(LLMClient.isConfigured()).toBe(true);
  });

  it('returns true when LIMINAL_LLM_API_KEY is set', () => {
    process.env.LIMINAL_LLM_API_KEY = 'test-key';
    expect(LLMClient.isConfigured()).toBe(true);
  });
});

describe('LLMError hierarchy', () => {
  it('LLMError stores provider and statusCode', () => {
    const err = new LLMError('test error', 'openai', 500, true);
    expect(err.message).toBe('test error');
    expect(err.provider).toBe('openai');
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('LLMError');
    expect(err).toBeInstanceOf(Error);
  });

  it('LLMTimeoutError has retryable=true', () => {
    const err = new LLMTimeoutError('ollama');
    expect(err.message).toContain('Timeout');
    expect(err.provider).toBe('ollama');
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('LLMTimeoutError');
  });

  it('LLMRateLimitError has statusCode 429', () => {
    const err = new LLMRateLimitError('openai', 30);
    expect(err.message).toContain('Rate limited');
    expect(err.statusCode).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.name).toBe('LLMRateLimitError');
  });

  it('LLMRateLimitError without retryAfterSeconds', () => {
    const err = new LLMRateLimitError('openai');
    expect(err.retryAfterSeconds).toBeUndefined();
  });

  it('LLMAuthError has statusCode 401', () => {
    const err = new LLMAuthError('openai');
    expect(err.message).toContain('Authentication failed');
    expect(err.statusCode).toBe(401);
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('LLMAuthError');
  });

  it('LLMTimeoutError is instanceof LLMError', () => {
    const err = new LLMTimeoutError('test');
    expect(err).toBeInstanceOf(LLMError);
  });

  it('LLMRateLimitError is instanceof LLMError', () => {
    const err = new LLMRateLimitError('test');
    expect(err).toBeInstanceOf(LLMError);
  });

  it('LLMAuthError is instanceof LLMError', () => {
    const err = new LLMAuthError('test');
    expect(err).toBeInstanceOf(LLMError);
  });
});

describe('LLMClient loadRoles', () => {
  beforeEach(() => {
    LLMClient.clearGlobalCache();
  });

  afterEach(() => {
    LLMClient.clearGlobalCache();
  });

  it('does not throw when config file is missing', async () => {
    await expect(LLMClient.loadRoles('/nonexistent/path')).resolves.toBeUndefined();
  });
});
