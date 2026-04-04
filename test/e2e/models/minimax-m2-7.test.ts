import { describe, it, expect, beforeAll } from 'vitest';
/**
 * MiniMax-M2.7 Test Suite
 * Cloud model - best quality
 */

import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'https://api.minimax.io/v1',
  model: 'MiniMax-M2.7',
};

const TEST_TIMEOUT = 60000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('MiniMax-M2.7', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
    // API key should be in MINIMAX_API_KEY env var
  });

  it('generates p5.js sketch', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/minimax-m2-7/p5-circle',
      project: 'test-p5',
    });

    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Three.js scene', async () => {
    const result = await run('rotating cube 3d', {
      maxIterations: 2,
      output: './test-results/models/minimax-m2-7/three-cube',
      project: 'test-three',
    });

    expect(result.code).toContain('THREE');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
