import { describe, it, expect } from 'vitest';
/**
 * E2E sandbox self-improve (optional).
 * - Sandbox: runInSandbox(minimal p5) completes without timeout/crash; skip if Puppeteer/Chrome unavailable.
 * - Self-improve: one improvement step via requestImprovement; skip if LLM unavailable.
 * TDD. No full-loop, GUI, or other E2E.
 */

import { runInSandbox } from '../../src/sandbox/index.js';
import { requestImprovement } from '../../src/improvement/requestImprovement.js';
import { LLMClient } from '../../src/llm/LLMClient.js';

const MINIMAL_P5 = `
function setup() {
  createCanvas(400, 400);
  background(220);
}
function draw() {
  ellipse(200, 200, 50, 50);
  noLoop();
}
`;

const E2E_SANDBOX_TIMEOUT_MS = 45000;

function isChromeUnavailableError(error: string | undefined): boolean {
  if (!error) return false;
  const msg = String(error).toLowerCase();
  return (
    /could not find|failed to launch|executable doesn't exist|no usable sandbox|could not find chrome|chromium/i.test(msg)
  );
}

describe.skipIf(process.env.CI)('E2E sandbox self-improve', () => {
  describe('SandboxRunner.runInSandbox', () => {
    it('runs minimal p5 sketch: no timeout, no crash, result indicates success', async () => {
      const result = await runInSandbox(MINIMAL_P5, { timeoutMs: 20000 });

      if (!result.completed && isChromeUnavailableError(result.error)) {
        console.warn(
          'Skipping E2E sandbox test: Puppeteer/Chrome unavailable. Install Chrome or set PUPPETEER_EXECUTABLE_PATH.'
        );
        return;
      }

      expect(result?.completed).toBe(true);
      expect(result.error).toBeUndefined();
    }, E2E_SANDBOX_TIMEOUT_MS);

    it('returns a result object with completed flag', async () => {
      const result = await runInSandbox(MINIMAL_P5, { timeoutMs: 15000 });

      if (!result.completed && isChromeUnavailableError(result.error)) {
        console.warn(
          'Skipping E2E sandbox test: Puppeteer/Chrome unavailable.'
        );
        return;
      }

      expect(result).toHaveProperty('completed');
      expect(result.completed === true || result.completed === false).toBe(true);
      if (result.completed) {
        expect(result.error).toBeUndefined();
      }
    }, E2E_SANDBOX_TIMEOUT_MS);
  });

  describe('requestImprovement (one improvement step)', () => {
    it('code -> requestImprovement -> returns improved code (skip if LLM unavailable)', async () => {
      if (!LLMClient.isConfigured()) {
        console.warn(
          'Skipping E2E improvement test: LLM unavailable (set LIMINAL_LLM_API_KEY or ATELIER_LLM_API_KEY or ATELIER_LLM_BASE_URL).'
        );
        return;
      }

      const result = await requestImprovement(MINIMAL_P5);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('code');
      expect(typeof result.code).toBe('string');
      expect(result.code.length).toBeGreaterThan(0);
      expect(result.code).toMatch(/function\s+setup\s*\(/);
      expect(result.code).toMatch(/createCanvas\s*\(/);
    }, 60000);
  });
});
