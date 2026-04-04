import { describe, it, expect, beforeAll } from 'vitest';
/**
 * MiniMax-M2.5 Test Suite
 * Cloud model - value option, good quality, cheaper
 */

import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'https://api.minimax.io/v1',
  model: 'MiniMax-M2.5',
};

const TEST_TIMEOUT = 60000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('MiniMax-M2.5', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js sketch', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/minimax-m2-5/p5-circle',
      project: 'test-p5',
    });

    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
