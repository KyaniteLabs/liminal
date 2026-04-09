import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveRoleConfig,
  getFallbacks,
  detectProviderType,
} from '../../../src/config/RoleConfig.js';
import type { RoleConfigFile } from '../../../src/config/RoleConfig.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Setup and cleanup
// ---------------------------------------------------------------------------

const tmpDir = path.join(os.tmpdir(), 'liminal-roleconfig-test-' + process.pid);

beforeEach(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {}
});

// ===========================================================================
// getFallbacks tests
// ===========================================================================

describe('getFallbacks', () => {
  it('returns empty array when config is null', () => {
    const result = getFallbacks('generator', null);
    expect(result).toEqual([]);
  });

  it('returns empty array when fallbacks section is absent', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness' },
      },
    };
    expect(getFallbacks('generator', config)).toEqual([]);
    expect(getFallbacks('evaluator', config)).toEqual([]);
    expect(getFallbacks('harness', config)).toEqual([]);
  });

  it('returns fallback configs for a role when defined', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness' },
      },
      fallbacks: {
        generator: [
          { baseUrl: 'http://fallback1:1234/v1', model: 'fallback-1' },
          { baseUrl: 'http://fallback2:1234/v1', model: 'fallback-2' },
        ],
      },
    };
    const fallbacks = getFallbacks('generator', config);
    expect(fallbacks.length).toBe(2);
    expect(fallbacks[0].model).toBe('fallback-1');
    expect(fallbacks[1].model).toBe('fallback-2');
  });

  it('returns empty array for role with no fallbacks defined', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness' },
      },
      fallbacks: {
        evaluator: [{ baseUrl: 'http://eval-fallback:1234/v1', model: 'eval-fallback' }],
      },
    };
    expect(getFallbacks('generator', config)).toEqual([]);
    expect(getFallbacks('harness', config)).toEqual([]);
  });

  it('returns multiple fallback configs when defined', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness' },
      },
      fallbacks: {
        generator: [
          { baseUrl: 'http://fb1:1234/v1', model: 'fallback-1' },
          { baseUrl: 'http://fb2:1234/v1', model: 'fallback-2' },
          { baseUrl: 'http://fb3:1234/v1', model: 'fallback-3' },
        ],
      },
    };
    const fallbacks = getFallbacks('generator', config);
    expect(fallbacks.length).toBe(3);
    expect(fallbacks[0].baseUrl).toBe('http://fb1:1234/v1');
    expect(fallbacks[2].model).toBe('fallback-3');
  });
});

// ===========================================================================
// detectProviderType edge cases
// ===========================================================================

describe('detectProviderType edge cases', () => {
  it('returns openai for unknown URLs with no model hint', () => {
    expect(detectProviderType('http://unknown-server:8080/v1')).toBe('openai');
  });

  it('returns openai for generic localhost URLs', () => {
    expect(detectProviderType('http://localhost:1234/v1')).toBe('openai');
    expect(detectProviderType('http://127.0.0.1:1234/v1')).toBe('openai');
  });

  it('returns openai for arbitrary IP addresses', () => {
    expect(detectProviderType('http://192.168.1.100:8080/v1')).toBe('openai');
    expect(detectProviderType('http://10.0.0.5:1234/v1')).toBe('openai');
  });

  it('is case-insensitive on URL matching', () => {
    expect(detectProviderType('HTTPS://API.ANTHROPIC.COM/V1')).toBe('anthropic');
    expect(detectProviderType('https://OPENROUTER.AI/api/v1')).toBe('openrouter');
    expect(detectProviderType('https://API.MINIMAX.IO/v1')).toBe('minimax');
  });

  it('detects minimax from URL with api.minimax.io', () => {
    expect(detectProviderType('https://api.minimax.io/v1')).toBe('minimax');
    expect(detectProviderType('https://api.minimax.io/anthropic')).toBe('minimax');
  });

  it('handles empty model string', () => {
    expect(detectProviderType('http://localhost:1234/v1', '')).toBe('openai');
  });

  it('detects anthropic from claude model name', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'claude-3-opus')).toBe('anthropic');
  });

  it('detects google from gemini model name', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'gemini-pro')).toBe('google');
  });

  it('detects ollama from deepseek-r1 model name', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'deepseek-r1')).toBe('ollama');
  });

  it('detects openrouter from URL', () => {
    expect(detectProviderType('https://openrouter.ai/api/v1')).toBe('openrouter');
    expect(detectProviderType('https://api.openrouter.ai/v1')).toBe('openrouter');
  });

  it('detects google from generativelanguage.googleapis.com URL', () => {
    expect(detectProviderType('https://generativelanguage.googleapis.com/v1beta')).toBe('google');
  });

  it('detects ollama from port 11434', () => {
    expect(detectProviderType('http://localhost:11434/v1')).toBe('ollama');
  });

  it('detects ollama from URL containing ollama', () => {
    expect(detectProviderType('http://my-ollama-server.local:11434/v1')).toBe('ollama');
  });

  it('defaults to openai for unrecognized combination', () => {
    expect(detectProviderType('http://custom-api.example.com/v1', 'unknown-model')).toBe('openai');
  });
});

// ===========================================================================
// saveRoleConfig tests
// ===========================================================================

describe('saveRoleConfig', () => {
  it('writes config to specified path creating directories', async () => {
    const configPath = path.join(tmpDir, 'nested', 'deep', 'config.json');
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://test:1234/v1', model: 'test-model' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval-model' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness-model' },
      },
    };

    await saveRoleConfig(config, configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.roles.generator.model).toBe('test-model');
    expect(parsed.roles.evaluator.model).toBe('eval-model');
    expect(parsed.roles.harness.model).toBe('harness-model');
  });

  it('overwrites existing config file', async () => {
    const configPath = path.join(tmpDir, 'overwrite-test.json');

    const config1: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://first:1234/v1', model: 'first-model' },
      },
    };
    const config2: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://second:1234/v1', model: 'second-model' },
      },
    };

    await saveRoleConfig(config1, configPath);
    await saveRoleConfig(config2, configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.roles.generator.model).toBe('second-model');
    expect(parsed.roles.generator.baseUrl).toBe('http://second:1234/v1');
  });

  it('writes config with fallbacks', async () => {
    const configPath = path.join(tmpDir, 'with-fallbacks.json');
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary' },
        evaluator: { baseUrl: 'http://eval:1234/v1', model: 'eval' },
        harness: { baseUrl: 'http://harness:1234/v1', model: 'harness' },
      },
      fallbacks: {
        generator: [
          { baseUrl: 'http://fallback:1234/v1', model: 'fallback-model' },
        ],
      },
    };

    await saveRoleConfig(config, configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.fallbacks.generator[0].model).toBe('fallback-model');
  });

  it('writes config with capabilities', async () => {
    const configPath = path.join(tmpDir, 'with-caps.json');
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://test:1234/v1', model: 'custom-model' },
      },
      capabilities: {
        'custom-model': {
          supportsStreaming: true,
          contextWindow: 32000,
        },
      },
    };

    await saveRoleConfig(config, configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.capabilities['custom-model'].supportsStreaming).toBe(true);
    expect(parsed.capabilities['custom-model'].contextWindow).toBe(32000);
  });
});
