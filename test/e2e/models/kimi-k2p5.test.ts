/**
 * Kimi-k2p5 Test Suite (Moonshot AI)
 * Cloud model — coding agent optimized
 * Gate: RUN_CLOUD_MODEL_TESTS=1
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'https://api.kimi.com/coding/v1',
  model: 'kimi-k2p5',
};

const TEST_TIMEOUT = 120000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('Kimi-k2p5', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js sketch', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/kimi-k2p5/p5-circle',
      project: 'test-p5',
    });
    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Three.js scene', async () => {
    const result = await run('rotating cube 3d', {
      maxIterations: 2,
      output: './test-results/models/kimi-k2p5/three-cube',
      project: 'test-three',
    });
    expect(result.code).toContain('THREE');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates GLSL shader', async () => {
    const result = await run('neon plasma effect with color cycling', {
      maxIterations: 2,
      output: './test-results/models/kimi-k2p5/shader-plasma',
      project: 'test-shader',
    });
    expect(result.code.length).toBeGreaterThan(200);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
