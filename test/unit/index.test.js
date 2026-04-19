import { afterEach, beforeEach, describe, it, expect } from 'vitest';
/**
 * Tests for Liminal main entry point
 * Tests the run() and runFromArgs() functions
 */

import { run, runFromArgs } from '../../src/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Liminal Main Entry Point', () => {
  let originalHome;
  let tempHome;
  let originalGlmKey;
  let originalLiminalKey;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalGlmKey = process.env.GLM_API_KEY;
    originalLiminalKey = process.env.LIMINAL_LLM_API_KEY;
    tempHome = mkdtempSync(join(tmpdir(), 'liminal-index-test-'));
    process.env.HOME = tempHome;
    delete process.env.GLM_API_KEY;
    delete process.env.LIMINAL_LLM_API_KEY;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalGlmKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalGlmKey;
    if (originalLiminalKey === undefined) delete process.env.LIMINAL_LLM_API_KEY;
    else process.env.LIMINAL_LLM_API_KEY = originalLiminalKey;
    rmSync(tempHome, { recursive: true, force: true });
  });

  describe('run()', () => {
    it('should throw error for empty prompt', async () => {
      await expect(run('')).rejects.toThrow('Prompt is required');
    });

    it('should throw error for null prompt', async () => {
      await expect(run(null)).rejects.toThrow('Prompt is required');
    });

    it('should throw when no LLM is configured', async () => {
      await expect(run('test prompt', { output: './test-output' })).rejects.toThrow(
        /No LLM configured|Liminal run failed/
      );
    }, 15000);
  });

  describe('runFromArgs()', () => {
    it('should throw when no LLM is configured', async () => {
      await expect(
        runFromArgs({ prompt: 'test prompt', maxIterations: 10, output: './test-output', project: 'cli-test' })
      ).rejects.toThrow(/No LLM configured|Liminal run failed/);
    });
  });
});
