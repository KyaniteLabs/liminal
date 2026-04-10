import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Liquid Foundation Model 2.5 1.2B Test Suite
 * Local model via LM Studio - very small, very fast
 * Skips in CI or when no local LLM is configured.
 */

import { run } from '../../../src/index.js';
import { CodeValidator } from '../../../src/core/CodeValidator.js';

const MODEL_CONFIG = {
  baseUrl: 'http://localhost:1234/v1',
  model: 'lfm2.5-1.2b-instruct',
};

const TEST_TIMEOUT = 60000; // 1 minute - small model

// Skip when running in CI or when no local LLM is explicitly configured
const skipNoLLM = process.env.CI || !process.env.LIMINAL_LLM_BASE_URL?.includes('localhost');
describe.skipIf(skipNoLLM)('LFM 2.5 1.2B', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js blue circle', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/lfm-2-5-1-2b/p5-circle',
      project: 'test-p5',
    });

    expect(result.code).toContain('createCanvas');
    expect(result.code).toContain('circle');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates basic sketch', async () => {
    const result = await run('red rectangle moving', {
      maxIterations: 2,
      output: './test-results/models/lfm-2-5-1-2b/p5-rect',
      project: 'test-p5',
    });

    expect(result.code.length).toBeGreaterThan(10);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('output passes validation', async () => {
    const result = await run('simple animation', {
      maxIterations: 2,
      output: './test-results/models/lfm-2-5-1-2b/validation',
      project: 'test-validate',
    });

    const validation = CodeValidator.validate(result.code);
    expect(validation.cleanedCode.length).toBeGreaterThan(0);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
