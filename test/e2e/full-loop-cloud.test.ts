import { describe, it, expect, beforeEach, afterEach, test } from 'vitest';
/**
 * E2E full loop with cloud LLM: run() from built package (dist/index.js)
 * with ATELIER_LLM_PROVIDER=lmstudio. Skips with clear message when cloud
 * is unavailable (no API key, 400/401, timeout).
 */

import fs from 'fs';
import path from 'path';

// Check if LM Studio is available (skips LLM-dependent tests if not)
async function isLLMAvailable() {
  try {
    const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

const E2E_TIMEOUT_MS = 300000; // 5 minutes - 2 iterations with slow local models

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

describe('E2E full loop (cloud LLM)', () => {
  const envKeys = [
    // Provider is no longer used - baseUrl + model is all that's needed
    'LIMINAL_LLM_BASE_URL',
    'LIMINAL_LLM_MODEL',
    'LIMINAL_LLM_API_KEY',
    'OPENAI_API_KEY',
  ];
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = backupEnv(envKeys);
  });

  afterEach(() => {
    restoreEnv(envBackup);
  });

  test.skipIf(process.env.CI || !process.env.RUN_CLOUD_MODEL_TESTS)('run() full loop with cloud (lmstudio): result has code, iterations, output files', async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    if (!fs.existsSync(distPath)) {
      console.warn('Skipping E2E cloud test: dist/index.js not found (run npm run build first).');
      return;
    }

    if (!await isLLMAvailable()) {
      console.warn('Skipping E2E cloud test: No LLM available at localhost:1234');
      return;
    }

    // Provider is no longer used - baseUrl + model is all that's needed
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:1234/v1';
    process.env.LIMINAL_LLM_MODEL = process.env.LIMINAL_LLM_MODEL || 'qwen3.5-9b';  // Use actual model from LM Studio

    const stamp = Date.now();
    const projectName = `e2e-cloud-${stamp}`;
    const outputDir = path.join(process.cwd(), 'tmp-e2e', projectName);

    const { run } = await import('../../dist/index.js');

    let result: Awaited<ReturnType<typeof run>>;
    try {
      result = await run('simple blue circle', {
        maxIterations: 2,
        output: outputDir,
        project: projectName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|400|401|403|network|fetch failed|no api key|AbortError/i.test(msg)
      ) {
        console.warn(
          'Skipping E2E cloud test: backend not available (no API key, unreachable, or timeout).'
        );
        return;
      }
      throw err;
    }

    expect(result).not.toBeNull();
    expect(result.code).not.toBeNull();
    expect(typeof result.code).toBe('string');

    // Skip assertions if the LLM backend was unreachable (code contains error comment)
    if (/LLM generation failed|LLM improvement failed/.test(result.code)) {
      console.warn('Skipping E2E cloud test assertions: LLM backend returned an error.');
      return;
    }

    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.code).toMatch(/function\s+setup\s*\(/);
    expect(result.code).toMatch(/function\s+draw\s*\(/);
    expect(result.htmlPath).not.toBeNull();
    expect(result.jsPath).not.toBeNull();
    expect(fs.existsSync(result.htmlPath!)).toBe(true);
    expect(fs.existsSync(result.jsPath!)).toBe(true);
  }, E2E_TIMEOUT_MS + 5000);
});
