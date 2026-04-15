import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  detectProviderFromUrl,
  getActiveProvider,
  isProviderConfigured,
  listConfiguredProviders,
  getProviderConfig,
  getActiveProviderConfig,
  getHarnessLLMConfig,
  getHarnessProviderConfig,
  _resetConfigCache,
  PROVIDER_TEMPLATES,
  type ProviderType,
} from '../../../src/harness/MultiProviderConfig.js';

import os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers – save & restore process.env around each test
// ---------------------------------------------------------------------------

const KEYS_PRESERVED = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_LLM_API_KEY',
  'MINIMAX_API_KEY',
  'GLM_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'LIMINAL_HARNESS_BASE_URL',
  'LIMINAL_HARNESS_MODEL',
  'LIMINAL_HARNESS_API_KEY',
  'LIMINAL_HARNESS_TEMPERATURE',
  'LIMINAL_HARNESS_MAX_TOKENS',
  'LIMINAL_HARNESS_TIMEOUT',
  'LIMINAL_HARNESS_MAX_RETRIES',
  'LIMINAL_HARNESS_CONTEXT_WINDOW',
] as const;

let savedEnv: Record<string, string | undefined>;
let homedirSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  savedEnv = {};
  for (const key of KEYS_PRESERVED) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  // Isolate from ~/.liminal/config.json: clear cache and redirect homedir
  _resetConfigCache();
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue('/nonexistent-test-home');
});

afterEach(() => {
  for (const key of KEYS_PRESERVED) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  homedirSpy.mockRestore();
  _resetConfigCache();
});

// ===========================================================================
// detectProviderFromUrl
// ===========================================================================

describe('detectProviderFromUrl', () => {
  it('detects MiniMax from "minimaxi" substring', () => {
    expect(detectProviderFromUrl('https://api.minimaxi.com/v1')).toBe('minimax');
  });

  it('detects OpenRouter from "openrouter" substring', () => {
    expect(detectProviderFromUrl('https://openrouter.ai/api/v1')).toBe('openrouter');
  });

  it('detects GLM from "bigmodel" substring', () => {
    expect(detectProviderFromUrl('https://open.bigmodel.cn/api/paas/v4')).toBe('glm');
  });

  it('detects GLM from "glm" substring', () => {
    expect(detectProviderFromUrl('https://glm.example.com/v1')).toBe('glm');
  });

  it('detects LM Studio from localhost:1234', () => {
    expect(detectProviderFromUrl('http://localhost:1234/v1')).toBe('lmstudio');
  });

  it('detects Ollama from localhost:11434', () => {
    expect(detectProviderFromUrl('http://localhost:11434')).toBe('ollama');
  });

  it('returns "custom" for an unrecognized URL', () => {
    expect(detectProviderFromUrl('http://192.168.1.50:8000/v1')).toBe('custom');
  });

  it('returns "custom" for an empty string', () => {
    expect(detectProviderFromUrl('')).toBe('custom');
  });
});

// ===========================================================================
// getActiveProvider
// ===========================================================================

describe('getActiveProvider', () => {
  it('defaults to ollama when no env vars are set', () => {
    expect(getActiveProvider()).toBe('ollama');
  });

  it('detects provider from LIMINAL_LLM_BASE_URL', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'https://api.minimaxi.com/v1';
    expect(getActiveProvider()).toBe('minimax');
  });

  it('picks minimax when MINIMAX_API_KEY is set (no base URL)', () => {
    process.env.MINIMAX_API_KEY = 'test-key';
    expect(getActiveProvider()).toBe('minimax');
  });

  it('picks glm when GLM_API_KEY is set (no base URL)', () => {
    process.env.GLM_API_KEY = 'glm-key';
    expect(getActiveProvider()).toBe('glm');
  });

  it('picks openrouter when OPENROUTER_API_KEY is set (no base URL)', () => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    expect(getActiveProvider()).toBe('openrouter');
  });

  it('honors LIMINAL_LLM_PROVIDER when base URL is not set', () => {
    process.env.LIMINAL_LLM_PROVIDER = 'glm';
    expect(getActiveProvider()).toBe('glm');
  });

  it('prefers LIMINAL_LLM_BASE_URL over individual API keys', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    process.env.MINIMAX_API_KEY = 'test-key';
    expect(getActiveProvider()).toBe('lmstudio');
  });

  it('prefers LIMINAL_LLM_BASE_URL over LIMINAL_LLM_PROVIDER', () => {
    process.env.LIMINAL_LLM_PROVIDER = 'glm';
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    expect(getActiveProvider()).toBe('lmstudio');
  });
});

// ===========================================================================
// getProviderConfig
// ===========================================================================

describe('getProviderConfig', () => {
  it('returns null-safe config for minimax with an API key', () => {
    process.env.MINIMAX_API_KEY = 'mm-key';
    const config = getProviderConfig('minimax');
    expect(config).not.toBeNull();
    expect(config!.provider).toBe('minimax');
    expect(config!.apiKey).toBe('mm-key');
    expect(config!.baseUrl).toBe('https://api.minimax.io/v1');
    expect(config!.model).toBe('MiniMax-M2.7');
    expect(config!.apiStyle).toBe('openai');
  });

  it('returns undefined apiKey for local providers (ollama)', () => {
    const config = getProviderConfig('ollama');
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBeUndefined();
    expect(config!.baseUrl).toBe('http://localhost:11434');
  });

  it('returns undefined apiKey for local providers (lmstudio)', () => {
    const config = getProviderConfig('lmstudio');
    expect(config).not.toBeNull();
    expect(config!.apiKey).toBeUndefined();
  });

  it('allows LIMINAL_LLM_BASE_URL to override the template baseUrl', () => {
    process.env.LIMINAL_LLM_BASE_URL = 'https://custom.example.com/v1';
    process.env.MINIMAX_API_KEY = 'key';
    const config = getProviderConfig('minimax');
    expect(config!.baseUrl).toBe('https://custom.example.com/v1');
  });

  it('allows LIMINAL_LLM_MODEL to override the template model', () => {
    process.env.LIMINAL_LLM_MODEL = 'my-custom-model';
    process.env.MINIMAX_API_KEY = 'key';
    const config = getProviderConfig('minimax');
    expect(config!.model).toBe('my-custom-model');
  });

  it('uses LIMINAL_LLM_API_KEY for custom provider', () => {
    process.env.LIMINAL_LLM_API_KEY = 'custom-key';
    const config = getProviderConfig('custom');
    expect(config!.apiKey).toBe('custom-key');
  });

  it('falls back to OPENAI_API_KEY for custom provider', () => {
    process.env.OPENAI_API_KEY = 'oai-key';
    const config = getProviderConfig('custom');
    expect(config!.apiKey).toBe('oai-key');
  });

  it('prefers LIMINAL_LLM_API_KEY over OPENAI_API_KEY for custom provider', () => {
    process.env.LIMINAL_LLM_API_KEY = 'lim-key';
    process.env.OPENAI_API_KEY = 'oai-key';
    const config = getProviderConfig('custom');
    expect(config!.apiKey).toBe('lim-key');
  });
});

// ===========================================================================
// isProviderConfigured
// ===========================================================================

describe('isProviderConfigured', () => {
  it('returns true for ollama even with no env vars (local)', () => {
    expect(isProviderConfigured('ollama')).toBe(true);
  });

  it('returns true for lmstudio even with no env vars (local)', () => {
    expect(isProviderConfigured('lmstudio')).toBe(true);
  });

  it('returns false for minimax without an API key', () => {
    expect(isProviderConfigured('minimax')).toBe(false);
  });

  it('returns true for minimax with MINIMAX_API_KEY set', () => {
    process.env.MINIMAX_API_KEY = 'key';
    expect(isProviderConfigured('minimax')).toBe(true);
  });

  it('returns false for glm without GLM_API_KEY', () => {
    expect(isProviderConfigured('glm')).toBe(false);
  });

  it('returns true for glm with GLM_API_KEY set', () => {
    process.env.GLM_API_KEY = 'key';
    expect(isProviderConfigured('glm')).toBe(true);
  });

  it('returns false for openrouter without OPENROUTER_API_KEY', () => {
    expect(isProviderConfigured('openrouter')).toBe(false);
  });

  it('returns true for openrouter with OPENROUTER_API_KEY set', () => {
    process.env.OPENROUTER_API_KEY = 'key';
    expect(isProviderConfigured('openrouter')).toBe(true);
  });

  it('returns false for custom without any API key', () => {
    expect(isProviderConfigured('custom')).toBe(false);
  });

  it('returns true for custom with LIMINAL_LLM_API_KEY', () => {
    process.env.LIMINAL_LLM_API_KEY = 'key';
    expect(isProviderConfigured('custom')).toBe(true);
  });
});

// ===========================================================================
// listConfiguredProviders
// ===========================================================================

describe('listConfiguredProviders', () => {
  it('returns only local providers when no API keys are set', () => {
    const providers = listConfiguredProviders();
    expect(providers).toContain('ollama');
    expect(providers).toContain('lmstudio');
    expect(providers).not.toContain('minimax');
    expect(providers).not.toContain('glm');
    expect(providers).not.toContain('openrouter');
    expect(providers).not.toContain('custom');
  });

  it('includes minimax when MINIMAX_API_KEY is set', () => {
    process.env.MINIMAX_API_KEY = 'key';
    const providers = listConfiguredProviders();
    expect(providers).toContain('minimax');
  });

  it('includes all providers when all keys are set', () => {
    process.env.MINIMAX_API_KEY = 'k1';
    process.env.GLM_API_KEY = 'k2';
    process.env.OPENROUTER_API_KEY = 'k3';
    process.env.LIMINAL_LLM_API_KEY = 'k4';
    const providers = listConfiguredProviders();
    expect(providers).toEqual(
      expect.arrayContaining(['minimax', 'lmstudio', 'ollama', 'openrouter', 'glm', 'custom']),
    );
    expect(providers).toHaveLength(6);
  });
});

// ===========================================================================
// getActiveProviderConfig
// ===========================================================================

describe('getActiveProviderConfig', () => {
  it('returns an LLMConfig without provider/name/description fields', () => {
    // Default is ollama — local, no key needed
    const config = getActiveProviderConfig();
    expect(config).not.toBeNull();
    expect(config!.baseUrl).toBe('http://localhost:11434');
    expect(config!.model).toBe('llama3.2');
    // Must not contain provider-specific fields
    expect('provider' in config!).toBe(false);
    expect('name' in config!).toBe(false);
    expect('description' in config!).toBe(false);
  });

  it('includes apiKey from env for cloud providers', () => {
    process.env.MINIMAX_API_KEY = 'mm-key';
    process.env.LIMINAL_LLM_BASE_URL = 'https://api.minimaxi.com/v1';
    const config = getActiveProviderConfig();
    expect(config!.apiKey).toBe('mm-key');
  });

  it('returns null when provider config is somehow missing', () => {
    // getActiveProviderConfig internally calls getActiveProvider then getProviderConfig.
    // The only null-return path is if getProviderConfig returns null, which currently
    // never happens because PROVIDER_TEMPLATES covers all ProviderTypes.
    // Still, we confirm the return type is correct.
    const config = getActiveProviderConfig();
    // Ollama always resolves — confirm non-null
    expect(config).not.toBeNull();
  });
});

// ===========================================================================
// getHarnessLLMConfig
// ===========================================================================

describe('getHarnessLLMConfig', () => {
  it('returns defaults when no harness env vars are set', () => {
    const config = getHarnessLLMConfig();
    expect(config.temperature).toBeCloseTo(0.2);
    expect(config.maxTokens).toBe(16384);
    expect(config.timeoutMs).toBe(120000);
    expect(config.maxRetries).toBe(3);
    expect(config.contextWindow).toBe(32768);
  });

  it('reads LIMINAL_HARNESS_TEMPERATURE from env', () => {
    process.env.LIMINAL_HARNESS_TEMPERATURE = '0.5';
    expect(getHarnessLLMConfig().temperature).toBeCloseTo(0.5);
  });

  it('reads LIMINAL_HARNESS_MAX_TOKENS from env', () => {
    process.env.LIMINAL_HARNESS_MAX_TOKENS = '8192';
    expect(getHarnessLLMConfig().maxTokens).toBe(8192);
  });

  it('reads LIMINAL_HARNESS_TIMEOUT from env', () => {
    process.env.LIMINAL_HARNESS_TIMEOUT = '120000';
    expect(getHarnessLLMConfig().timeoutMs).toBe(120000);
  });

  it('reads LIMINAL_HARNESS_MAX_RETRIES from env', () => {
    process.env.LIMINAL_HARNESS_MAX_RETRIES = '5';
    expect(getHarnessLLMConfig().maxRetries).toBe(5);
  });

  it('reads LIMINAL_HARNESS_CONTEXT_WINDOW from env', () => {
    process.env.LIMINAL_HARNESS_CONTEXT_WINDOW = '16384';
    expect(getHarnessLLMConfig().contextWindow).toBe(16384);
  });
});

// ===========================================================================
// getHarnessProviderConfig
// ===========================================================================

describe('getHarnessProviderConfig', () => {
  it('returns active provider config with harness overrides when no harness-specific URL is set', () => {
    // Default active provider is ollama
    const config = getHarnessProviderConfig();
    expect(config).not.toBeNull();
    expect(config!.baseUrl).toBe('http://localhost:11434');
    // Harness overrides temperature
    expect(config!.temperature).toBeCloseTo(0.2);
    expect(config!.maxTokens).toBe(16384);
  });

  it('uses harness-specific config when LIMINAL_HARNESS_BASE_URL and MODEL are set', () => {
    process.env.LIMINAL_HARNESS_BASE_URL = 'https://api.minimaxi.com/v1';
    process.env.LIMINAL_HARNESS_MODEL = 'MiniMax-M2.7';
    process.env.LIMINAL_HARNESS_API_KEY = 'harness-key';

    const config = getHarnessProviderConfig();
    expect(config).not.toBeNull();
    expect(config!.baseUrl).toBe('https://api.minimaxi.com/v1');
    expect(config!.model).toBe('MiniMax-M2.7');
    expect(config!.apiKey).toBe('harness-key');
    expect(config!.apiStyle).toBe('openai');
  });

  it('uses harness temperature override when LIMINAL_HARNESS_TEMPERATURE is set', () => {
    process.env.LIMINAL_HARNESS_BASE_URL = 'https://api.minimaxi.com/v1';
    process.env.LIMINAL_HARNESS_MODEL = 'MiniMax-M2.7';
    process.env.LIMINAL_HARNESS_TEMPERATURE = '0.4';

    const config = getHarnessProviderConfig();
    expect(config!.temperature).toBeCloseTo(0.4);
  });

  it('falls back to MINIMAX_API_KEY for minimax harness URL', () => {
    process.env.LIMINAL_HARNESS_BASE_URL = 'https://api.minimaxi.com/v1';
    process.env.LIMINAL_HARNESS_MODEL = 'MiniMax-M2.7';
    process.env.MINIMAX_API_KEY = 'mm-key';

    const config = getHarnessProviderConfig();
    expect(config!.apiKey).toBe('mm-key');
  });

  it('falls back to LIMINAL_LLM_API_KEY then OPENAI_API_KEY for non-minimax harness URL', () => {
    process.env.LIMINAL_HARNESS_BASE_URL = 'https://custom.example.com/v1';
    process.env.LIMINAL_HARNESS_MODEL = 'custom-model';
    process.env.LIMINAL_LLM_API_KEY = 'lim-key';

    const config = getHarnessProviderConfig();
    expect(config!.apiKey).toBe('lim-key');
  });

  it('does not return harness-specific config when only MODEL is set (no BASE_URL)', () => {
    process.env.LIMINAL_HARNESS_MODEL = 'MiniMax-M2.7';
    // Should fall back to active provider config
    const config = getHarnessProviderConfig();
    expect(config).not.toBeNull();
    // Should be ollama (default active provider), not harness-specific
    expect(config!.baseUrl).toBe('http://localhost:11434');
  });

  it('avoids OpenRouter for harness fallback and prefers LM Studio until explicitly overridden', () => {
    process.env.OPENROUTER_API_KEY = 'or-key';

    const config = getHarnessProviderConfig();

    expect(config).not.toBeNull();
    expect(config!.baseUrl).toBe('http://localhost:1234/v1');
    expect(config!.model).toBe('local-model');
  });
});

// ===========================================================================
// PROVIDER_TEMPLATES
// ===========================================================================

describe('PROVIDER_TEMPLATES', () => {
  it('contains all eight provider types (incl. kimi)', () => {
    const keys = Object.keys(PROVIDER_TEMPLATES) as ProviderType[];
    expect(keys).toHaveLength(8);
    expect(keys).toEqual(
      expect.arrayContaining(['minimax', 'lmstudio', 'ollama', 'openrouter', 'glm', 'moonshot', 'kimi', 'custom']),
    );
  });

  it('each template has the required fields', () => {
    for (const [, template] of Object.entries(PROVIDER_TEMPLATES)) {
      expect(template.provider).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.baseUrl).toBeTruthy();
      expect(template.model).toBeTruthy();
      expect(typeof template.temperature).toBe('number');
      expect(typeof template.maxTokens).toBe('number');
    }
  });
});
