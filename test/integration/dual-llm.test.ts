import { describe, it, expect, beforeEach, afterEach, test } from 'vitest';
/**
 * Dual LLM integration tests: critical path getEffectiveConfig + LLMClient
 * with cloud (lmstudio) and local (ollama) backends.
 * Tests pass when the respective backend is available; skip with a clear message when not.
 */

import { getEffectiveConfig } from '../../src/config/ConfigLoader.js';
import { LLMClient } from '../../src/llm/LLMClient.js';

const LLM_REQUEST_TIMEOUT_MS = 10000;

function restoreEnv(backup: Record<string, string | undefined>) {
  for (const key of Object.keys(backup)) {
    if (backup[key] !== undefined) {
      process.env[key] = backup[key];
    } else {
      delete process.env[key];
    }
  }
}

function backupEnv(keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of keys) {
    out[k] = process.env[k];
  }
  return out;
}

describe.skipIf(process.env.CI)('Dual LLM (cloud vs local)', () => {
  const envKeys = [
    'LIMINAL_LLM_PROVIDER',
    'LIMINAL_LLM_BASE_URL',
    'LIMINAL_LLM_MODEL',
    'LIMINAL_LLM_API_KEY',
    'OPENAI_API_KEY',
    'MINIMAX_API_KEY',
  ];
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = backupEnv(envKeys);
  });

  afterEach(() => {
    restoreEnv(envBackup);
  });

  test.skipIf(process.env.CI || !process.env.LIMINAL_LLM_BASE_URL)('getEffectiveConfig + LLMClient path with cloud (lmstudio) backend', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'lmstudio';
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:1234/v1';
    process.env.LIMINAL_LLM_MODEL = process.env.LIMINAL_LLM_MODEL || 'local-model';
    // LIMINAL_LLM_API_KEY left from env if set

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('lmstudio');

    const client = new LLMClient({
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);

    let response: Awaited<ReturnType<LLMClient['generateP5Sketch']>>;
    try {
      response = await client.generateP5Sketch('simple blue circle', undefined, controller.signal);
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|401|403|network|fetch failed/i.test(msg) ||
        msg.includes('AbortError')
      ) {
        console.warn(
          'Skipping cloud (lmstudio) test: backend not available (no API key, unreachable, or timeout).'
        );
        return;
      }
      throw err;
    }
    clearTimeout(timeout);

    if (!response.success) {
      console.warn(
        'Skipping cloud (lmstudio) test: backend not available (' + (response.error || 'unknown') + ').'
      );
      return;
    }

    expect(response.success).toBe(true);
    expect(response.code).toBeDefined();
    expect(typeof response.code).toBe('string');
    expect(response.code).toMatch(/function\s+setup\s*\(/);
    expect(response.code).toMatch(/function\s+draw\s*\(/);
  }, LLM_REQUEST_TIMEOUT_MS + 5000);

  test('getEffectiveConfig + LLMClient path with local (ollama) backend', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'ollama';
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:11434';
    process.env.LIMINAL_LLM_MODEL = process.env.LIMINAL_LLM_MODEL || 'llama3.2';
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('ollama');

    const client = new LLMClient({
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);

    let response: Awaited<ReturnType<LLMClient['generateP5Sketch']>>;
    try {
      response = await client.generateP5Sketch('simple blue circle', undefined, controller.signal);
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|AbortError/i.test(msg)
      ) {
        console.warn(
          'Skipping local (ollama) test: Ollama not running or unreachable.'
        );
        return;
      }
      throw err;
    }
    clearTimeout(timeout);

    if (!response.success) {
      const reason = response.error || 'unknown';
      if (/connection|refused|unreachable|timeout|404/i.test(reason)) {
        console.warn(
          'Skipping local (ollama) test: Ollama not running or model not found (' + reason + ').'
        );
        return;
      }
    }

    expect(response.success).toBe(true);
    expect(response.code).toBeDefined();
    expect(typeof response.code).toBe('string');
    expect(response.code).toMatch(/function\s+setup\s*\(/);
    expect(response.code).toMatch(/function\s+draw\s*\(/);
  }, LLM_REQUEST_TIMEOUT_MS + 5000);
});
