import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import { _resetConfigCache } from '../../../src/harness/MultiProviderConfig.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig } from '../../../src/tui-bridge/BridgeLauncherConfig.js';

describe('BridgeLauncherConfig', () => {
  const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue('/nonexistent-test-home');
  const providerEnvKeys = [
    'LIMINAL_LLM_PROVIDER',
    'LIMINAL_LLM_BASE_URL',
    'LIMINAL_LLM_MODEL',
    'LIMINAL_LLM_API_KEY',
    'LLM_PROVIDER',
    'LLM_BASE_URL',
    'LLM_MODEL',
    'LLM_API_KEY',
    'LIMINAL_HARNESS_BASE_URL',
    'LIMINAL_HARNESS_MODEL',
    'LIMINAL_HARNESS_API_KEY',
    'HARNESS_BASE_URL',
    'HARNESS_MODEL',
    'HARNESS_API_KEY',
    'OPENAI_API_KEY',
    'GLM_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'MINIMAX_API_KEY',
    'OPENROUTER_API_KEY',
    'MOONSHOT_API_KEY',
    'KIMI_API_KEY',
  ] as const;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of providerEnvKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    _resetConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const key of providerEnvKeys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    _resetConfigCache();
  });

  it('uses ollama by default when no env is set', () => {
    const config = resolveBridgeProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.baseUrl).toBe('http://localhost:11434');
    expect(config.apiKey).toBeUndefined();
  });

  it('uses glm when glm credentials are present', () => {
    vi.stubEnv('GLM_API_KEY', 'glm-key');
    const config = resolveBridgeProviderConfig();
    expect(config.provider).toBe('glm');
    expect(config.apiKey).toBe('glm-key');
  });

  it('applies shared provider env vars', () => {
    const env: NodeJS.ProcessEnv = {};
    applyBridgeProviderEnv(env, {
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen',
    });

    expect(env.LIMINAL_LLM_PROVIDER).toBe('lmstudio');
    expect(env.LIMINAL_LLM_BASE_URL).toBe('http://localhost:1234/v1');
    expect(env.LIMINAL_LLM_MODEL).toBe('qwen');
    expect(env.LLM_API_KEY).toBeUndefined();
  });

  it('applies provider-specific api key env vars when present', () => {
    const env: NodeJS.ProcessEnv = {};
    applyBridgeProviderEnv(env, {
      provider: 'glm',
      baseUrl: 'https://api.z.ai/api/anthropic',
      model: 'glm-5.1',
      apiKey: 'glm-key',
    });

    expect(env.GLM_API_KEY).toBe('glm-key');
    expect(env.LIMINAL_HARNESS_API_KEY).toBe('glm-key');
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.LIMINAL_LLM_API_KEY).toBeUndefined();
  });

  it('exports config-file OpenAI keys only as OpenAI-specific env', () => {
    const env: NodeJS.ProcessEnv = {};
    applyBridgeProviderEnv(env, {
      provider: 'custom',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      apiKey: 'openai-key',
    });

    expect(env.OPENAI_API_KEY).toBe('openai-key');
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.LIMINAL_LLM_API_KEY).toBeUndefined();
  });

  afterAll(() => {
    homedirSpy.mockRestore();
  });
});
