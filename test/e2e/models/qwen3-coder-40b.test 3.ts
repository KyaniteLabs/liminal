import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Qwen 3 Coder 40B Test Suite
 * Local model via LM Studio - larger but slower
 */

import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'http://localhost:1234/v1',
  model: 'qwen3-coder-next-reap-40b-a3b-i1',
};

const TEST_TIMEOUT = 180000; // 3 minutes - slower model

describe.skipIf(process.env.CI || !process.env.LIMINAL_LLM_BASE_URL)('Qwen 3 Coder 40B', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js with high quality', async () => {
    const result = await run('blue particles with trails', {
      maxIterations: 2,
      output: './test-results/models/qwen3-coder-40b/p5-particles',
      project: 'test-p5',
    });

    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates GLSL shader', async () => {
    const result = await run('neon plasma shader', {
      maxIterations: 2,
      output: './test-results/models/qwen3-coder-40b/glsl',
      project: 'test-shader',
    });

    expect(result.code).toContain('void main');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
