import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _resetConfigCache } from '../../../src/harness/MultiProviderConfig.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig, summarizeBridgeRuntime } from '../../../src/tui-bridge/BridgeLauncherConfig.js';

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
    'LIMINAL_EVALUATOR_BASE_URL',
    'LIMINAL_EVALUATOR_MODEL',
    'LIMINAL_EVALUATOR_API_KEY',
    'EVALUATOR_BASE_URL',
    'EVALUATOR_MODEL',
    'EVALUATOR_API_KEY',
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
    homedirSpy.mockReturnValue('/nonexistent-test-home');
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

  it('does not overwrite an explicitly configured evaluator role', () => {
    const env: NodeJS.ProcessEnv = {
      LIMINAL_EVALUATOR_BASE_URL: 'https://openrouter.ai/api/v1',
      LIMINAL_EVALUATOR_MODEL: 'google/gemini-2.5-flash',
      LIMINAL_EVALUATOR_API_KEY: 'vision-key',
    };
    applyBridgeProviderEnv(env, {
      provider: 'glm',
      baseUrl: 'https://api.z.ai/api/anthropic',
      model: 'glm-5.1',
      apiKey: 'glm-key',
    });

    expect(env.LIMINAL_LLM_MODEL).toBe('glm-5.1');
    expect(env.LIMINAL_HARNESS_MODEL).toBe('glm-5.1');
    expect(env.LIMINAL_EVALUATOR_MODEL).toBe('google/gemini-2.5-flash');
    expect(env.LIMINAL_EVALUATOR_API_KEY).toBe('vision-key');
  });

  it('summarizes generator, harness, and evaluator roles without exposing keys', () => {
    const env: NodeJS.ProcessEnv = {
      LIMINAL_LLM_PROVIDER: 'glm',
      LIMINAL_LLM_BASE_URL: 'https://api.z.ai/api/anthropic',
      LIMINAL_LLM_MODEL: 'glm-5.1',
      LIMINAL_HARNESS_BASE_URL: 'https://api.z.ai/api/anthropic',
      LIMINAL_HARNESS_MODEL: 'glm-5.1',
      LIMINAL_EVALUATOR_BASE_URL: 'https://openrouter.ai/api/v1',
      LIMINAL_EVALUATOR_MODEL: 'google/gemini-2.5-flash',
      LIMINAL_EVALUATOR_API_KEY: 'vision-key',
    };

    const summary = summarizeBridgeRuntime(env);

    expect(summary.roles.generator.model).toBe('glm-5.1');
    expect(summary.roles.harness.model).toBe('glm-5.1');
    expect(summary.roles.evaluator.model).toBe('google/gemini-2.5-flash');
    expect(summary.roles.evaluator.provider).toBe('openrouter');
    expect(summary.evaluation.multimodal).toBe('yes');
    expect(JSON.stringify(summary)).not.toContain('vision-key');
  });

  it('marks GPT-5 evaluators as vision-capable', () => {
    const summary = summarizeBridgeRuntime({
      LIMINAL_LLM_PROVIDER: 'glm',
      LIMINAL_LLM_BASE_URL: 'https://api.z.ai/api/anthropic',
      LIMINAL_LLM_MODEL: 'glm-4.5-air',
      LIMINAL_EVALUATOR_BASE_URL: 'https://api.openai.com/v1',
      LIMINAL_EVALUATOR_MODEL: 'gpt-5.4-mini',
    });

    expect(summary.roles.evaluator.provider).toBe('openai');
    expect(summary.roles.evaluator.multimodal).toBe('yes');
    expect(summary.evaluation.multimodal).toBe('yes');
  });

  it('marks GLM-5v-turbo evaluators as vision-capable through the GLM provider', () => {
    const summary = summarizeBridgeRuntime({
      LIMINAL_LLM_PROVIDER: 'glm',
      LIMINAL_LLM_BASE_URL: 'https://api.z.ai/api/anthropic',
      LIMINAL_LLM_MODEL: 'GLM-5v-turbo',
      LIMINAL_EVALUATOR_BASE_URL: 'https://api.z.ai/api/anthropic',
      LIMINAL_EVALUATOR_MODEL: 'GLM-5v-turbo',
    });

    expect(summary.roles.evaluator.provider).toBe('glm');
    expect(summary.roles.evaluator.multimodal).toBe('yes');
    expect(summary.evaluation.multimodal).toBe('yes');
  });

  it('applies persisted evaluator role config from ~/.liminal/config.json', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-role-config-'));
    homedirSpy.mockReturnValue(home);
    fs.mkdirSync(path.join(home, '.liminal'), { recursive: true });
    fs.writeFileSync(path.join(home, '.liminal', 'config.json'), JSON.stringify({
      defaultProvider: 'glm',
      providers: {
        glm: {
          baseUrl: 'https://api.z.ai/api/anthropic',
          model: 'glm-5.1',
          apiKey: 'glm-key',
        },
      },
      roles: {
        evaluator: {
          provider: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'google/gemini-2.5-flash',
          apiKey: 'vision-key',
        },
      },
    }));
    _resetConfigCache();

    const env: NodeJS.ProcessEnv = {};
    const config = resolveBridgeProviderConfig();
    applyBridgeProviderEnv(env, config);

    expect(env.LIMINAL_LLM_MODEL).toBe('glm-5.1');
    expect(env.LIMINAL_EVALUATOR_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(env.LIMINAL_EVALUATOR_MODEL).toBe('google/gemini-2.5-flash');
    expect(env.LIMINAL_EVALUATOR_API_KEY).toBe('vision-key');
    expect(summarizeBridgeRuntime(env).evaluation.multimodal).toBe('yes');
  });

  it('does not let evaluator role keys overwrite provider-global generator keys', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-role-keys-'));
    homedirSpy.mockReturnValue(home);
    fs.mkdirSync(path.join(home, '.liminal'), { recursive: true });
    fs.writeFileSync(path.join(home, '.liminal', 'config.json'), JSON.stringify({
      defaultProvider: 'openrouter',
      providers: {
        openrouter: {
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'openai/gpt-5.4-mini',
          apiKey: 'provider-key',
        },
      },
      roles: {
        generator: {
          provider: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'openai/gpt-5.4-mini',
          apiKey: 'generator-key',
        },
        evaluator: {
          provider: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'google/gemini-2.5-flash',
          apiKey: 'evaluator-key',
        },
      },
    }));
    _resetConfigCache();

    const env: NodeJS.ProcessEnv = {};
    const config = resolveBridgeProviderConfig();
    applyBridgeProviderEnv(env, config);

    expect(env.OPENROUTER_API_KEY).toBe('provider-key');
    expect(env.LLM_API_KEY).toBe('generator-key');
    expect(env.EVALUATOR_API_KEY).toBe('evaluator-key');
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
