/**
 * EnvironmentValidator unit tests — Phase 12 Increment 4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnvironmentValidator } from '../../../src/agent/EnvironmentValidator.js';
import type { DiagnosticCheck, DiagnosticReport } from '../../../src/agent/EnvironmentValidator.js';

const PROVIDER_ENV_KEYS = [
  'LLM_BASE_URL',
  'LLM_API_KEY',
  'LLM_MODEL',
  'LLM_PROVIDER',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_API_KEY',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_LLM_PROVIDER',
  'OPENAI_API_KEY',
  'MINIMAX_API_KEY',
  'GLM_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENROUTER_API_KEY',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
] as const;

function clearProviderEnv(): void {
  for (const key of PROVIDER_ENV_KEYS) delete process.env[key];
}

function providerCheck(report: DiagnosticReport): DiagnosticCheck {
  const check = report.checks.find(c => c.name === 'Provider');
  expect(check?.name).toBe('Provider');
  return check!;
}

describe('EnvironmentValidator', () => {
  let validator: EnvironmentValidator;

  beforeEach(() => {
    clearProviderEnv();
    validator = new EnvironmentValidator();
  });

  afterEach(() => {
    clearProviderEnv();
    vi.restoreAllMocks();
  });

  it('returns a report with checks array and allPassed boolean', async () => {
    const report = await validator.validate();
    expect(report.checks).toBeInstanceOf(Array);
    expect(report.checks.length).toBe(4); // Node, Go, Config, Provider
    expect(report.allPassed === true || report.allPassed === false).toBe(true);
    expect(typeof report.timestamp).toBe('string');
  });

  it('checks Node.js version', async () => {
    const report = await validator.validate();
    const nodeCheck = report.checks.find(c => c.name === 'Node.js');

    expect(nodeCheck!.status).toMatch(/^(pass|fail)$/);
    // We're running on Node 18+, so it should pass
    expect(nodeCheck!.status).toBe('pass');
    expect(nodeCheck!.message).toContain('v');
  });

  it('checks Go toolchain', async () => {
    const report = await validator.validate();
    const goCheck = report.checks.find(c => c.name === 'Go');

    // Go may or may not be installed — either pass or warn
    expect(goCheck!.status).toMatch(/^(pass|warn)$/);
  });

  it('checks config file presence', async () => {
    const report = await validator.validate();
    const configCheck = report.checks.find(c => c.name === 'Config');

    expect(configCheck!.status).toMatch(/^(pass|warn)$/);
  });

  it('checks provider config', async () => {
    const report = await validator.validate();
    const check = providerCheck(report);

    expect(check.status).toMatch(/^(pass|warn)$/);
  });

  it('fails GLM diagnostics with exact key guidance when GLM is selected without credentials', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'glm';

    const report = await validator.validate();
    const check = providerCheck(report);

    expect(check.status).toBe('fail');
    expect(check.message).toContain('GLM');
    expect(check.message).toContain('GLM_API_KEY');
    expect(report.allPassed).toBe(false);
  });

  it('passes GLM diagnostics when only GLM_API_KEY is configured', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'glm';
    process.env.GLM_API_KEY = 'glm-key';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('pass');
    expect(check.message).toContain('GLM');
    expect(check.message).toContain('GLM_API_KEY');
  });

  it('passes local provider diagnostics without requiring an API key', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'lmstudio';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('pass');
    expect(check.message).toContain('LM Studio');
    expect(check.message).toContain('no API key required');
  });

  it('detects provider-specific credentials even when no provider is selected', async () => {
    process.env.GLM_API_KEY = 'glm-key';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('pass');
    expect(check.message).toContain('GLM');
    expect(check.message).toContain('GLM_API_KEY');
  });

  it('does not infer GLM from Anthropic-compatible fallback tokens without provider or URL evidence', async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-style-token';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('warn');
    expect(check.message).not.toContain('GLM configured');
  });

  it('fails OpenRouter diagnostics with provider-specific key guidance', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'openrouter';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('fail');
    expect(check.message).toContain('OpenRouter');
    expect(check.message).toContain('OPENROUTER_API_KEY');
  });

  it('keeps fully configured legacy generic provider envs as valid', async () => {
    process.env.LLM_BASE_URL = 'https://api.example.com/v1';
    process.env.LLM_API_KEY = 'legacy-key';

    const check = providerCheck(await validator.validate());

    expect(check.status).toBe('pass');
    expect(check.message).toContain('LLM_BASE_URL');
    expect(check.message).toContain('LLM_API_KEY');
  });

  it('allPassed is false if any check fails', async () => {
    // At minimum, we can verify the boolean logic
    const report = await validator.validate();
    const hasFailure = report.checks.some(c => c.status === 'fail');
    expect(report.allPassed).toBe(!hasFailure);
  });

  it('each check has name, status, and message', async () => {
    const report = await validator.validate();
    for (const check of report.checks) {
      expect(check.name).toBeTruthy();
      expect(check.status).toMatch(/^(pass|fail|warn)$/);
      expect(check.message).toBeTruthy();
    }
  });
});
