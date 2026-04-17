/**
 * GLM-5.1 Test Suite (ZhipuAI)
 * Cloud model — coding-focused flagship
 * Gate: RUN_CLOUD_MODEL_TESTS=1
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { run } from '../../../src/index.js';

const MODEL_CONFIG = {
  baseUrl: 'https://api.z.ai/api/anthropic',
  model: 'glm-5.1',
};

const TEST_TIMEOUT = 120000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('GLM-5.1', () => {
  beforeAll(() => {
    process.env.LIMINAL_LLM_BASE_URL = MODEL_CONFIG.baseUrl;
    process.env.LIMINAL_LLM_MODEL = MODEL_CONFIG.model;
  });

  it('generates p5.js sketch', async () => {
    const result = await run('simple blue circle', {
      maxIterations: 2,
      output: './test-results/models/glm-5-1/p5-circle',
      project: 'test-p5',
    });
    expect(result.code).toContain('createCanvas');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Three.js scene', async () => {
    const result = await run('rotating cube 3d', {
      maxIterations: 2,
      output: './test-results/models/glm-5-1/three-cube',
      project: 'test-three',
    });
    expect(result.code).toContain('THREE');
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates GLSL shader', async () => {
    const result = await run('neon plasma effect with color cycling', {
      maxIterations: 2,
      output: './test-results/models/glm-5-1/shader-plasma',
      project: 'test-shader',
    });
    expect(result.code.length).toBeGreaterThan(200);
    expect(result.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
