import { describe, it, expect, beforeAll, afterEach, afterAll, test } from 'vitest';
/**
 * E2E: seed and quality gate via public run() API.
 * - Seed: run() with seedCode (minimal p5 sketch), assert result reflects seed.
 * - Quality gate: run() with minQualityScore 0.99, assert early exit with reason "quality".
 * Skips when LLM is unavailable (dual-llm skip pattern).
 */

import { run, RalphLoop } from '../../src/index.js';
import path from 'path';
import fs from 'fs/promises';

const LLM_REQUEST_TIMEOUT_MS = 60000;
const E2E_GALLERY_DIR = path.join(process.cwd(), 'test-e2e-seed-quality-gallery');

function isLLMUnavailable(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|401|403|404|network|fetch failed|AbortError|No LLM configured/i.test(msg)
  );
}

describe('E2E: seed and quality gate', () => {
  beforeAll(async () => {
    await fs.mkdir(E2E_GALLERY_DIR, { recursive: true });
  });

  afterEach(() => {
    RalphLoop.reset();
  });

  afterAll(async () => {
    try {
      await fs.rm(E2E_GALLERY_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('seed: run() with seedCode produces code reflecting seed', async () => {
    RalphLoop.reset();
    const seedCode =
      'function setup(){ createCanvas(400,400); } function draw(){ background(0); }';
    const prompt = 'improve this';
    const maxIterations = 2;

    let result;
    try {
      result = await run(prompt, {
        seedCode,
        maxIterations,
        galleryDir: E2E_GALLERY_DIR,
        project: 'e2e-seed',
      });
    } catch (err) {
      if (isLLMUnavailable(err)) {
        console.warn(
          'Skipping E2E seed test: LLM not available (no API key, unreachable, or timeout).'
        );
        return;
      }
      throw err;
    }

    expect(result).not.toBeNull();

    expect(typeof result.code).toBe('string');
    expect(result.code?.length).toBeGreaterThan(0);
    // First or final code reflects seed: createCanvas(400,400) or evolved (createCanvas + setup/draw)
    const hasCreateCanvas = /\bcreateCanvas\s*\(/.test(result.code);
    const hasSetupDraw = /function\s+setup\s*\(/.test(result.code) && /function\s+draw\s*\(/.test(result.code);
    expect(hasCreateCanvas).toBe(true);
    expect(hasSetupDraw).toBe(true);
  }, LLM_REQUEST_TIMEOUT_MS + 5000);

  test('quality gate: run() with minQualityScore 0.99 exits with reason containing "quality" and iterations < max', async () => {
    RalphLoop.reset();
    const prompt = 'simple blue circle';
    const maxIterations = 3;
    const minQualityScore = 0.99;

    let result;
    try {
      result = await run(prompt, {
        minQualityScore,
        maxIterations,
        galleryDir: E2E_GALLERY_DIR,
        project: 'e2e-quality-gate',
      });
    } catch (err) {
      if (isLLMUnavailable(err)) {
        console.warn(
          'Skipping E2E quality gate test: LLM not available (no API key, unreachable, or timeout).'
        );
        return;
      }
      throw err;
    }

    expect(result).not.toBeNull();
    expect(result.reason).not.toBeNull();
    expect(result.reason.toLowerCase()).toContain('quality');
    expect(result.iterations).toBeLessThan(maxIterations);
  }, LLM_REQUEST_TIMEOUT_MS + 5000);
});
