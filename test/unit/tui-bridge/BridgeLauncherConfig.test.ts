import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import { _resetConfigCache } from '../../../src/harness/MultiProviderConfig.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig } from '../../../src/tui-bridge/BridgeLauncherConfig.js';

describe('BridgeLauncherConfig', () => {
  const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue('/nonexistent-test-home');

  afterEach(() => {
    vi.unstubAllEnvs();
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
  });

  afterAll(() => {
    homedirSpy.mockRestore();
  });
});
