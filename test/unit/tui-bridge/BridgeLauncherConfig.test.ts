import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import { _resetConfigCache } from '../../../src/harness/MultiProviderConfig.js';
import { resolveBridgeProviderConfig } from '../../../src/tui-bridge/BridgeLauncherConfig.js';

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

  afterAll(() => {
    homedirSpy.mockRestore();
  });
});
