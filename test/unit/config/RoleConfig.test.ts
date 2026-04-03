import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectProviderType,
  loadRoleConfig,
  formatRoleConfig,
} from '../../../src/config/RoleConfig.js';
import { CapabilityRegistry } from '../../../src/llm/CapabilityRegistry.js';
import type { ResolvedRoleConfig } from '../../../src/config/RoleConfig.js';

// ---------------------------------------------------------------------------
// detectProviderType
// ---------------------------------------------------------------------------
describe('detectProviderType', () => {
  it('detects anthropic from URL', () => {
    expect(detectProviderType('https://api.anthropic.com/v1')).toBe('anthropic');
  });

  it('detects openrouter from URL', () => {
    expect(detectProviderType('https://openrouter.ai/api/v1')).toBe('openrouter');
  });

  it('detects google from URL', () => {
    expect(
      detectProviderType('https://generativelanguage.googleapis.com/v1beta'),
    ).toBe('google');
  });

  it('detects ollama from port 11434 in URL', () => {
    expect(detectProviderType('http://localhost:11434/v1')).toBe('ollama');
  });

  it('detects anthropic from model name starting with claude', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'claude-sonnet-4-20250514')).toBe(
      'anthropic',
    );
  });

  it('detects google from model name starting with gemini', () => {
    expect(detectProviderType('http://localhost:1234/v1', 'gemini-2.5-flash')).toBe('google');
  });

  it('defaults to openai when no match', () => {
    expect(detectProviderType('http://localhost:1234/v1')).toBe('openai');
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

    // Use a temp dir with no project config so only env vars apply
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');

    expect(config.generator.baseUrl).toBe('http://gen-host:8080/v1');
    expect(config.generator.model).toBe('test-gen-model');
    expect(config.generator.apiKey).toBe('gen-key-123');
  });

  it('harness uses harness-specific env vars', async () => {
    vi.stubEnv('LIMINAL_HARNESS_BASE_URL', 'http://harness-host:9090/v1');
    vi.stubEnv('LIMINAL_HARNESS_MODEL', 'test-harness-model');

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
});

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

  it('generator defaults to temperature 0.7, streaming false', async () => {
    const config = await loadRoleConfig('/tmp/nonexistent-liminal-test');
    expect(config.generator.temperature).toBe(0.7);
    expect(config.generator.streaming).toBe(false);
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
});

// ---------------------------------------------------------------------------
// formatRoleConfig
// ---------------------------------------------------------------------------
describe('formatRoleConfig', () => {
  it('returns a string containing all three roles', () => {
    const roles: Record<string, ResolvedRoleConfig> = {
      generator: {
        provider: 'openai',
        baseUrl: 'http://localhost:1234/v1',
        model: 'test-model',
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
        thinking: { enabled: false },
        streaming: true,
      },
    };

    const formatted = formatRoleConfig(roles as any);

    expect(formatted).toContain('GENERATOR');
    expect(formatted).toContain('EVALUATOR');
    expect(formatted).toContain('HARNESS');
  });

  it('includes model name and provider for each role', () => {
    const roles: Record<string, ResolvedRoleConfig> = {
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
        thinking: { enabled: false },
        streaming: true,
      },
    };

    const formatted = formatRoleConfig(roles as any);

    expect(formatted).toContain('gpt-4o');
    expect(formatted).toContain('openai');
    expect(formatted).toContain('claude-sonnet-4-20250514');
    expect(formatted).toContain('anthropic');
    expect(formatted).toContain('gemini-2.5-flash');
    expect(formatted).toContain('google');
  });
});
