// Allow localhost for tests
process.env.LIMINAL_ALLOW_LOCALHOST_LLM = "true";

import { describe, it, expect, beforeEach, afterEach, test } from 'vitest';
/**
 * E2E full loop with local LLM (Ollama).
 * Runs run() with ATELIER_LLM_PROVIDER=ollama; skips with clear message when Ollama
 * is not running or unreachable (same skip pattern as dual-llm.test.ts).
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { run } from '../../src/index.js';
import { getEffectiveConfig } from '../../src/config/ConfigLoader.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { metaHarness } from '../../src/harness/MetaHarnessIntegration.js';

const LLM_REQUEST_TIMEOUT_MS = 20000;
const E2E_TIMEOUT_MS = 120000; // full loop with 2 iterations can be slow

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

/** Same skip pattern as dual-llm.test.ts: Ollama not running or unreachable → skip. */
async function isOllamaReachable(): Promise<boolean> {
  const config = await getEffectiveConfig();
  if (config.provider !== 'ollama') return false;
  const client = new LLMClient({
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  try {
    const response = await client.generateP5Sketch('simple blue circle', undefined, controller.signal);
    clearTimeout(timeout);
    if (!response.success) {
      const reason = response.error || 'unknown';
      if (/connection|refused|unreachable|timeout|404/i.test(reason)) return false;
    }
    return response.success === true;
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|AbortError|404/i.test(msg)) return false;
    throw err;
  }
}

describe('E2E full loop (local Ollama)', () => {
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
    process.env.LIMINAL_LLM_PROVIDER = 'ollama';
    process.env.LIMINAL_LLM_BASE_URL = process.env.LIMINAL_LLM_BASE_URL || 'http://localhost:11434';
    process.env.LIMINAL_LLM_MODEL = process.env.LIMINAL_LLM_MODEL || 'llama3.2';
    delete process.env.LIMINAL_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    restoreEnv(envBackup);
  });

  test('run() full loop: result.code, iterations >= 1, setup/draw, output files exist', async () => {
    const startTime = Date.now();
    const reachable = await isOllamaReachable();
    if (!reachable) {
      console.warn(
        'Skipping E2E full-loop-local: Ollama not running or unreachable (connection refused, 404, or timeout).'
      );
      return;
    }

    const uniqueId = `e2e-full-loop-${Date.now()}`;
    const outputDir = path.join(os.tmpdir(), uniqueId);
    const project = uniqueId;
    const prompt = 'Draw a simple blue circle';

    let result: Awaited<ReturnType<typeof run>>;
    let testPassed = false;
    let testError: string | undefined;
    
    try {
      result = await run(prompt, {
        maxIterations: 2,
        output: outputDir,
        project,
      });

      expect(result).not.toBeNull();
      expect(result.code).not.toBeNull();
      expect(typeof result.code).toBe('string');
      expect(result.code).toMatch(/function\s+setup\s*\(/);
      expect(result.code).toMatch(/function\s+draw\s*\(/);
      expect(result.iterations).toBeGreaterThanOrEqual(1);

      expect(result.jsPath).not.toBeNull();
      expect(result.htmlPath).not.toBeNull();
      const jsExists = await fs.access(result.jsPath!).then(() => true).catch(() => false);
      const htmlExists = await fs.access(result.htmlPath!).then(() => true).catch(() => false);
      expect(jsExists).toBe(true);
      expect(htmlExists).toBe(true);
      
      testPassed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      testError = msg;
      if (
        /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|AbortError|connection|refused|unreachable|404/i.test(
          msg
        )
      ) {
        console.warn(
          'Skipping E2E full-loop-local: Ollama became unreachable during run (' + msg + ').'
        );
        return;
      }
      throw err;
    } finally {
      // Report test result to Meta-Harness
      await metaHarness.onGenerationComplete({
        success: testPassed,
        model: 'ollama',
        domain: 'p5',
        prompt: prompt,
        error: testError,
        duration: Date.now() - startTime,
      });
      
      // Cleanup temp output
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    }
  }, E2E_TIMEOUT_MS);
});
