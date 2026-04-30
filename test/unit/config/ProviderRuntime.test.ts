import { describe, expect, it } from 'vitest';
import {
  PROVIDER_DEFAULTS,
  apiKeyEnvNamesForEndpoint,
  apiKeyEnvNamesForProvider,
  detectProviderAdapter,
  detectProviderLabel,
  detectRoleProviderType,
  inferProviderVisionSupport,
  normalizeProviderBaseUrl,
  resolveProviderAlias,
  resolveProviderRuntime,
} from '../../../src/config/ProviderRuntime.js';

describe('ProviderRuntime', () => {
  it('centralizes provider aliases and defaults used by model switching', () => {
    expect(resolveProviderAlias('openai')).toBe('custom');
    expect(resolveProviderAlias('gpt')).toBe('custom');
    expect(resolveProviderAlias('z')).toBe('glm');
    expect(PROVIDER_DEFAULTS.glm).toMatchObject({
      baseUrl: 'https://api.z.ai/api/anthropic',
      model: 'GLM-5v-turbo',
      requiresKey: true,
    });
  });

  it('normalizes deprecated provider endpoints without changing supported custom endpoints', () => {
    expect(normalizeProviderBaseUrl('glm', 'https://api.z.ai/api/coding/paas')).toBe('https://api.z.ai/api/anthropic');
    expect(normalizeProviderBaseUrl('minimax', 'https://api.minimax.io/v1')).toBe('https://api.minimax.io/anthropic');
    expect(normalizeProviderBaseUrl('glm', 'https://custom.example/v1')).toBe('https://custom.example/v1');
  });

  it('detects status labels separately from provider adapters', () => {
    expect(detectProviderLabel('https://api.z.ai/api/anthropic', 'glm-5.1')).toBe('glm');
    expect(detectProviderLabel('http://127.0.0.1:11434', 'llama3.2')).toBe('ollama');
    expect(detectProviderAdapter({ baseUrl: 'https://api.z.ai/api/anthropic', model: 'glm-5.1' })).toBe('anthropic');
    expect(detectRoleProviderType('https://api.z.ai/api/anthropic', 'glm-5.1')).toBe('anthropic');
  });

  it('keeps API key env order provider-specific', () => {
    expect(apiKeyEnvNamesForProvider('glm')).toEqual(['GLM_API_KEY', 'ANTHROPIC_AUTH_TOKEN']);
    expect(apiKeyEnvNamesForProvider('custom')).toEqual(['OPENAI_API_KEY']);
    expect(apiKeyEnvNamesForProvider('lmstudio')).toEqual([]);
    expect(apiKeyEnvNamesForEndpoint('https://api.anthropic.com/v1', 'claude-sonnet')).toEqual(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']);
    expect(apiKeyEnvNamesForEndpoint('https://generativelanguage.googleapis.com/v1beta', 'gemini-2.5-flash')).toEqual(['GOOGLE_API_KEY', 'GEMINI_API_KEY']);
  });

  it('reports GLM 5V as vision-capable but ordinary GLM as text-only', () => {
    expect(inferProviderVisionSupport('glm', 'GLM-5v-turbo')).toBe('yes');
    expect(inferProviderVisionSupport('glm', 'glm-5.1')).toBe('no');
  });

  it('resolves runtime selection with usable current keys and status labels', () => {
    const runtime = resolveProviderRuntime({
      provider: 'custom',
      model: 'gpt-5.4-mini',
      configuredApiKey: 'YOUR_OPENAI_API_KEY_HERE',
      current: {
        provider: 'openai',
        apiKey: 'sk-live',
      },
      env: {},
    });

    expect(runtime).toMatchObject({
      provider: 'custom',
      statusProvider: 'openai',
      adapter: 'openai',
      label: 'OpenAI',
      apiKey: 'sk-live',
      model: 'gpt-5.4-mini',
    });
  });
});
