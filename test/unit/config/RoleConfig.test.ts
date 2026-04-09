import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectProviderType,
  loadRoleConfig,
  formatRoleConfig,
  getFallbacks,
  saveRoleConfig,
} from '../../../src/config/RoleConfig.js';
import type { ResolvedRoleConfig, RoleConfigFile } from '../../../src/config/RoleConfig.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// detectProviderType
// ---------------------------------------------------------------------------
describe('detectProviderType', () => {
  it('detects openrouter from URL', () => {
    expect(detectProviderType('https://openrouter.ai/api/v1')).toBe('openrouter');
  });

  it('detects minimax before anthropic (api.minimax.io contains neither "anthropic" nor "ollama")', () => {
    expect(detectProviderType('https://api.minimax.io/v1')).toBe('minimax');
  });

  it('detects anthropic from URL', () => {
    expect(detectProviderType('https://api.anthropic.com/v1')).toBe('anthropic');
  });

  it('detects google from URL', () => {
    expect(detectProviderType('https://generativelanguage.googleapis.com/v1beta')).toBe('google');
  });

  it('detects ollama from port 11434 in URL', () => {
    expect(detectProviderType('http://localhost:11434/v1')).toBe('ollama');
  });

  it('detects ollama from URL containing "ollama"', () => {
    expect(detectProviderType('http://ollama.local:11434/v1')).toBe('ollama');
  });

  it('detects anthropic from model name starting with "claude"', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'claude-sonnet-4-20250514')).toBe('anthropic');
  });

  it('detects google from model name starting with "gemini"', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'gemini-2.5-flash')).toBe('google');
  });

  it('detects ollama from model name starting with "deepseek-r1"', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'deepseek-r1')).toBe('ollama');
  });

  it('defaults to openai for unrecognized URL and model', () => {
    expect(detectProviderType('http://localhost:1234/v1')).toBe('openai');
  });

  it('defaults to openai when only model is unrecognized', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'some-random-model')).toBe('openai');
  });

  it('is case-insensitive on URL', () => {
    expect(detectProviderType('HTTPS://API.ANTHROPIC.COM/V1')).toBe('anthropic');
  });

  it('is case-insensitive on model name', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'Claude-3')).toBe('anthropic');
  });

  it('handles empty model string', () => {
    expect(detectProviderType('http://localhost:1234/v1', '')).toBe('openai');
  });

  it('returns openai for bigmodel.cn (ZhipuAI GLM) URLs', () => {
    expect(detectProviderType('https://bigmodel.cn/api/v1')).toBe('openai');
  });

  it('returns openai for moonshot URLs', () => {
    expect(detectProviderType('https://api.moonshot.cn/v1')).toBe('openai');
  });

  it('detects ollama from URL containing "ollama" in hostname', () => {
    expect(detectProviderType('http://my-ollama-server.local:11434/v1')).toBe('ollama');
  });
});

// ---------------------------------------------------------------------------
// loadRoleConfig with environment variables
// ---------------------------------------------------------------------------
describe('loadRoleConfig with env vars', () => {
  beforeEach(() => {
    CapabilityRegistry.clearOverrides();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    CapabilityRegistry.clearOverrides();
  });

  it('generator uses LIMINAL_LLM_* env vars', async () => {
    vi.stubEnv('LIMINAL_LLM_BASE_URL', 'http://gen-host:8080/v1');
    vi.stubEnv('LIMINAL_LLM_MODEL', 'test-gen-model');
    vi.stubEnv('LIMINAL_LLM_API_KEY', 'gen-key-123');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.generator.baseUrl).toBe('http://gen-host:8080/v1');
    expect(config.generator.model).toBe('test-gen-model');
    expect(config.generator.apiKey).toBe('gen-key-123');
  });

  it('harness uses harness-specific env vars over generic ones', async () => {
    vi.stubEnv('LIMINAL_HARNESS_BASE_URL', 'http://harness-host:9090/v1');
    vi.stubEnv('LIMINAL_HARNESS_MODEL', 'test-harness-model');
    vi.stubEnv('LIMINAL_LLM_BASE_URL', 'http://generic-host:8080/v1');
    vi.stubEnv('LIMINAL_LLM_MODEL', 'generic-model');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.harness.baseUrl).toBe('http://harness-host:9090/v1');
    expect(config.harness.model).toBe('test-harness-model');
  });

  it('harness falls back to generic LLM_* vars when harness-specific are absent', async () => {
    vi.stubEnv('LIMINAL_LLM_BASE_URL', 'http://generic-host:8080/v1');
    vi.stubEnv('LIMINAL_LLM_MODEL', 'generic-model');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.harness.baseUrl).toBe('http://generic-host:8080/v1');
    expect(config.harness.model).toBe('generic-model');
  });

  it('uses EVALUATOR_* env vars with fallbacks to LLM_*', async () => {
    vi.stubEnv('LIMINAL_EVALUATOR_BASE_URL', 'http://eval-specific:7070/v1');
    vi.stubEnv('LIMINAL_EVALUATOR_MODEL', 'eval-specific-model');
    vi.stubEnv('LIMINAL_EVALUATOR_API_KEY', 'eval-specific-key');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.evaluator.baseUrl).toBe('http://eval-specific:7070/v1');
    expect(config.evaluator.model).toBe('eval-specific-model');
    expect(config.evaluator.apiKey).toBe('eval-specific-key');
  });

  it('evaluator falls back to LLM_* when EVALUATOR_* not set', async () => {
    vi.stubEnv('LIMINAL_LLM_BASE_URL', 'http://llm-fallback:8080/v1');
    vi.stubEnv('LIMINAL_LLM_MODEL', 'llm-fallback-model');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.evaluator.baseUrl).toBe('http://llm-fallback:8080/v1');
    expect(config.evaluator.model).toBe('llm-fallback-model');
  });

  it('uses HARNESS_* env vars with fallbacks to LLM_*', async () => {
    vi.stubEnv('LIMINAL_HARNESS_BASE_URL', 'http://harness-specific:9090/v1');
    vi.stubEnv('LIMINAL_HARNESS_MODEL', 'harness-specific-model');
    vi.stubEnv('LIMINAL_HARNESS_API_KEY', 'harness-specific-key');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.harness.baseUrl).toBe('http://harness-specific:9090/v1');
    expect(config.harness.model).toBe('harness-specific-model');
    expect(config.harness.apiKey).toBe('harness-specific-key');
  });

  it('evaluator uses evaluator-specific env vars', async () => {
    vi.stubEnv('LIMINAL_EVALUATOR_BASE_URL', 'http://eval-host:7070/v1');
    vi.stubEnv('LIMINAL_EVALUATOR_MODEL', 'test-eval-model');
    vi.stubEnv('LIMINAL_EVALUATOR_API_KEY', 'eval-key-456');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.evaluator.baseUrl).toBe('http://eval-host:7070/v1');
    expect(config.evaluator.model).toBe('test-eval-model');
    expect(config.evaluator.apiKey).toBe('eval-key-456');
  });

  it('resolves provider from baseUrl when no explicit provider set', async () => {
    vi.stubEnv('LIMINAL_LLM_BASE_URL', 'https://api.anthropic.com/v1');
    vi.stubEnv('LIMINAL_LLM_MODEL', 'claude-test');

    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.generator.provider).toBe('anthropic');
  });
});

// We need to import CapabilityRegistry for cleanup
import { CapabilityRegistry } from '../../../src/llm/CapabilityRegistry.js';

// ---------------------------------------------------------------------------
// Role defaults
// ---------------------------------------------------------------------------
describe('role defaults', () => {
  beforeEach(() => {
    CapabilityRegistry.clearOverrides();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    CapabilityRegistry.clearOverrides();
  });

  it('generator defaults to temperature 0.7, streaming false, timeout 120000', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    expect(config.generator.temperature).toBe(0.7);
    expect(config.generator.streaming).toBe(false);
    expect(config.generator.timeout).toBe(120000);
    expect(config.generator.maxTokens).toBe(4096);
    expect(config.generator.thinking).toEqual({ enabled: false });
  });

  it('evaluator defaults to temperature 0.2, streaming false', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    expect(config.evaluator.temperature).toBe(0.2);
    expect(config.evaluator.streaming).toBe(false);
  });

  it('harness defaults to temperature 0.5, streaming true', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    expect(config.harness.temperature).toBe(0.5);
    expect(config.harness.streaming).toBe(true);
  });

  it('returns a valid baseUrl string when no config found', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    // May be user config default (e.g. minimax) or hardcoded default
    expect(typeof config.generator.baseUrl).toBe('string');
    expect(config.generator.baseUrl.length).toBeGreaterThan(0);
  });

  it('returns a valid model string when no config found', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    // May be user config default (e.g. MiniMax-M2.7) or fallback "unknown"
    expect(typeof config.generator.model).toBe('string');
    expect(config.generator.model.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatRoleConfig
// ---------------------------------------------------------------------------
describe('formatRoleConfig', () => {
  const sampleRoles: Record<string, ResolvedRoleConfig> = {
    generator: {
      provider: 'openai',
      baseUrl: 'http://localhost:1234/v1',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 120000,
      thinking: { enabled: false },
      streaming: false,
    },
    evaluator: {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.2,
      maxTokens: 4096,
      timeout: 120000,
      thinking: { enabled: false },
      streaming: false,
    },
    harness: {
      provider: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-2.5-flash',
      temperature: 0.5,
      maxTokens: 4096,
      timeout: 120000,
      thinking: { enabled: true },
      streaming: true,
    },
  };

  it('returns a string containing all three role headers', () => {
    const formatted = formatRoleConfig(sampleRoles as any);
    expect(formatted).toContain('GENERATOR');
    expect(formatted).toContain('EVALUATOR');
    expect(formatted).toContain('HARNESS');
  });

  it('includes model name and provider for each role', () => {
    const formatted = formatRoleConfig(sampleRoles as any);
    expect(formatted).toContain('gpt-4o');
    expect(formatted).toContain('openai');
    expect(formatted).toContain('claude-sonnet-4-20250514');
    expect(formatted).toContain('anthropic');
    expect(formatted).toContain('gemini-2.5-flash');
    expect(formatted).toContain('google');
  });

  it('shows thinking as "on" when enabled', () => {
    const formatted = formatRoleConfig(sampleRoles as any);
    // Harness has thinking enabled: true
    const harnessSection = formatted.split('HARNESS')[1];
    expect(harnessSection).toContain('Thinking: on');
  });

  it('shows thinking as "off" when disabled', () => {
    const formatted = formatRoleConfig(sampleRoles as any);
    // Generator has thinking enabled: false
    const generatorSection = formatted.split('EVALUATOR')[0];
    expect(generatorSection).toContain('Thinking: off');
  });

  it('shows streaming state correctly', () => {
    const formatted = formatRoleConfig(sampleRoles as any);
    expect(formatted).toContain('Stream:   on');
    expect(formatted).toContain('Stream:   off');
  });

  it('shows "auto" when provider is undefined', () => {
    const noProviderRoles = {
      ...sampleRoles,
      generator: { ...sampleRoles.generator, provider: undefined },
    };
    const formatted = formatRoleConfig(noProviderRoles as any);
    const generatorSection = formatted.split('EVALUATOR')[0];
    expect(generatorSection).toContain('Provider: auto');
  });
});

// ---------------------------------------------------------------------------
// getFallbacks
// ---------------------------------------------------------------------------
describe('getFallbacks', () => {
  it('returns empty array when config is null', () => {
    expect(getFallbacks('generator', null)).toEqual([]);
  });

  it('returns empty array when fallbacks section is absent', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://localhost:1234/v1', model: 'test' },
      },
    };
    expect(getFallbacks('generator', config)).toEqual([]);
  });

  it('returns fallback configs for a role when defined', () => {
    const fallbackConfig = { baseUrl: 'http://fallback:1234/v1', model: 'fallback-model' };
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary-model' },
      },
      fallbacks: {
        generator: [fallbackConfig],
      },
    };
    const fallbacks = getFallbacks('generator', config);
    expect(fallbacks.length).toBe(1);
    expect(fallbacks[0].model).toBe('fallback-model');
  });

  it('returns empty array for role with no fallbacks defined', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary-model' },
      },
      fallbacks: {
        evaluator: [{ baseUrl: 'http://eval:1234/v1', model: 'eval-model' }],
      },
    };
    expect(getFallbacks('generator', config)).toEqual([]);
  });

  it('returns multiple fallback configs when defined', () => {
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://primary:1234/v1', model: 'primary-model' },
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
});

// ---------------------------------------------------------------------------
// saveRoleConfig
// ---------------------------------------------------------------------------
describe('saveRoleConfig', () => {
  const tmpDir = path.join(os.tmpdir(), 'liminal-roleconfig-test-' + process.pid);

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('writes config to specified path, creating directories', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    const config: RoleConfigFile = {
      roles: {
        generator: { baseUrl: 'http://localhost:1234/v1', model: 'test-model' },
      },
    };

    await saveRoleConfig(config, configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.roles.generator.model).toBe('test-model');
    expect(parsed.roles.generator.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('overwrites existing config file', async () => {
    const configPath = path.join(tmpDir, 'config.json');
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
  });
});
