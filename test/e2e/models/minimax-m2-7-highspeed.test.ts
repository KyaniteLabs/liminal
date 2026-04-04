import { describe, it, expect, beforeAll } from 'vitest';
/**
 * MiniMax-M2.7-highspeed Test Suite
 * Cloud model - same quality as M2.7 but faster (100 tps vs 60 tps)
 */

import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'https://api.minimax.io/v1',
  model: 'MiniMax-M2.7-highspeed',
};

const TEST_TIMEOUT = 45000; // Faster model

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('MiniMax-M2.7-highspeed', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js quickly', async () => {
    const startTime = Date.now();
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/minimax-m2-7-highspeed/p5-circle',
      project: 'test-p5',
    });
    const duration = Date.now() - startTime;

    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
    expect(duration).toBeLessThan(30000); // Should be fast
  }, TEST_TIMEOUT);
});
