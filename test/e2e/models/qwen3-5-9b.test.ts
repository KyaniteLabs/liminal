import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Qwen 3.5 9B Test Suite
 * Local model via LM Studio
 */

import { run } from '../../../src/index.js';
import { CodeValidator } from '../../../src/core/CodeValidator.js';

const MODEL_CONFIG = {
  baseUrl: 'http://localhost:1234/v1',
  model: 'qwen3.5-9b',
};

const TEST_TIMEOUT = 120000;

describe.skipIf(process.env.CI || !process.env.LIMINAL_LLM_BASE_URL)('Qwen 3.5 9B', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js blue circle', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/qwen3-5-9b/p5-circle',
      project: 'test-p5',
    });

    expect(result.code).toContain('createCanvas');
    expect(result.code).toContain('circle');
    expect(result.finalScore).toBeGreaterThan(0.3);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Strudel pattern', async () => {
    const result = await run('techno beat 130 bpm', {
      maxIterations: 2,
      output: './test-results/models/qwen3-5-9b/strudel',
      project: 'test-strudel',
    });

    expect(result.code.length).toBeGreaterThan(10);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('output passes validation', async () => {
    const result = await run('flowing particles', {
      maxIterations: 2,
      output: './test-results/models/qwen3-5-9b/validation',
      project: 'test-validate',
    });

    const validation = CodeValidator.validate(result.code);
    expect(validation.cleanedCode.length).toBeGreaterThan(0);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
