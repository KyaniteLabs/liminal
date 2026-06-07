/**
 * OnboardingWizard unit tests — Phase 12 Increment 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OnboardingWizard } from '../../../src/agent/OnboardingWizard.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('OnboardingWizard', () => {
  let wizard: OnboardingWizard;
  let tempHome: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    for (const key of [
      'LLM_BASE_URL',
      'LIMINAL_LLM_BASE_URL',
      'LLM_MODEL',
      'LIMINAL_LLM_MODEL',
      'LLM_PROVIDER',
      'LIMINAL_LLM_PROVIDER',
      'LLM_API_KEY',
      'LIMINAL_LLM_API_KEY',
      'MINIMAX_API_KEY',
      'GLM_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
      'KIMI_API_KEY',
      'MOONSHOT_API_KEY',
    ]) {
      delete process.env[key];
    }
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-onboarding-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tempHome);
    wizard = new OnboardingWizard();
  });

  afterEach(async () => {
    // Restore env
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it('has three steps: detect, validate, write', () => {
    const steps = wizard.getSteps();
    expect(steps).toHaveLength(3);
    expect(steps[0].id).toBe('detect');
    expect(steps[1].id).toBe('validate');
    expect(steps[2].id).toBe('write');
    // All steps start as pending
    for (const step of steps) {
      expect(step.status).toBe('pending');
    }
  });

  it('fails detection when no baseUrl or apiKey provided', async () => {
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;

    const result = await wizard.run();
    expect(result.configWritten).toBe(false);
    expect(result.steps[0].status).toBe('failed');
  });

  it('fails validation when apiKey is missing', async () => {
    process.env.LLM_BASE_URL = 'https://api.example.com/v1';
    delete process.env.LLM_API_KEY;

    const result = await wizard.run();
    expect(result.configWritten).toBe(false);
    expect(result.steps[1].status).toBe('failed');
  });

  it('writes config when overrides provide both baseUrl and apiKey', async () => {
    const configDir = path.join(os.homedir(), '.sinter');
    const configPath = path.join(configDir, 'config.json');

    const result = await wizard.run({
      provider: 'test-provider',
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key-12345',
      model: 'test-model',
    });

    expect(result.configWritten).toBe(true);
    expect(result.configPath).toBe(configPath);
    expect(result.steps[0].status).toBe('complete');
    expect(result.steps[1].status).toBe('complete');
    expect(result.steps[2].status).toBe('complete');

    // Verify config file contents
    const raw = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.defaultProvider).toBe('custom');
    expect(config.providers.custom.baseUrl).toBe('https://api.test.com/v1');
    expect(config.providers.custom.model).toBe('test-model');
  });

  it('detects provider-specific keys and writes canonical runtime defaults', async () => {
    process.env.GLM_API_KEY = 'glm-key';

    const result = await wizard.run();
    expect(result.configWritten).toBe(true);

    const raw = await fs.readFile(result.configPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.defaultProvider).toBe('glm');
    expect(config.providers.glm.baseUrl).toBe('https://api.z.ai/api/anthropic');
    expect(config.providers.glm.model).toBe('GLM-5v-turbo');
    expect(config.providers.glm.apiKey).toBe('glm-key');
  });

  it('getSteps returns a copy, not the internal array', () => {
    const steps1 = wizard.getSteps();
    const steps2 = wizard.getSteps();
    expect(steps1).not.toBe(steps2);
    expect(steps1).toEqual(steps2);
  });
});
