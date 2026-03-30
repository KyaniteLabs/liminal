import { describe, it, expect, beforeEach, afterEach, test } from 'vitest';
/**
 * E2E full loop with cloud LLM: run() from built package (dist/index.js)
 * with ATELIER_LLM_PROVIDER=lmstudio. Skips with clear message when cloud
 * is unavailable (no API key, 400/401, timeout).
 */

import fs from 'fs';
import path from 'path';

const E2E_TIMEOUT_MS = 120000; // 2 iterations + LLM calls over network

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

  test.skipIf(process.env.CI)('run() full loop with cloud (lmstudio): result has code, iterations, output files', async () => {
    const distPath = path.join(process.cwd(), 'dist', 'index.js');
    if (!fs.existsSync(distPath)) {
      console.warn('Skipping E2E cloud test: dist/index.js not found (run npm run build first).');
      return;
    }

    process.env.LIMINAL_LLM_PROVIDER = 'lmstudio';
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:1234/v1';
    process.env.LIMINAL_LLM_MODEL = process.env.LIMINAL_LLM_MODEL || 'local-model';

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

    expect(result).toBeDefined();
    expect(result.code).toBeDefined();
    expect(typeof result.code).toBe('string');

    // Skip assertions if the LLM backend was unreachable (code contains error comment)
    if (/LLM generation failed|LLM improvement failed/.test(result.code)) {
      console.warn('Skipping E2E cloud test assertions: LLM backend returned an error.');
      return;
    }

    expect(result.iterations).toBeGreaterThanOrEqual(1);
    expect(result.code).toMatch(/function\s+setup\s*\(/);
    expect(result.code).toMatch(/function\s+draw\s*\(/);
    expect(result.htmlPath).toBeDefined();
    expect(result.jsPath).toBeDefined();
    expect(fs.existsSync(result.htmlPath!)).toBe(true);
    expect(fs.existsSync(result.jsPath!)).toBe(true);
  }, E2E_TIMEOUT_MS + 5000);
});
