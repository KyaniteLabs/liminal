/**
 * GLM-5.1 Test Suite (ZhipuAI)
 * Cloud model — coding-focused flagship
 * Gate: RUN_CLOUD_MODEL_TESTS=1
 */
import { describe, it, expect } from 'vitest';
import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 120000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('GLM configured cloud model', () => {
  async function generateCode(systemPrompt: string, prompt: string): Promise<string> {
    const live = createLiveProviderClient('glm');
    expect(live?.config.provider, 'configured GLM provider is required for GLM model proof').toBe('glm');
    const response = await live!.client.generate(systemPrompt, prompt);
    expect(response.success).toBe(true);
    return response.code;
  }

  it('generates p5.js sketch', async () => {
    const code = await generateCode(
      'You are a p5.js coder. Output raw JavaScript only.',
      'Create a p5.js sketch with setup(), draw(), createCanvas(), and a blue circle.',
    );
    expect(code).toContain('createCanvas');
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Three.js scene', async () => {
    const code = await generateCode(
      'You are a Three.js coder. Output raw JavaScript only.',
      'Create a minimal Three.js scene with a scene, camera, renderer, and rotating cube.',
    );
    expect(code).toContain('THREE');
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates GLSL shader', async () => {
    const code = await generateCode(
      'You are a GLSL shader coder. Output raw fragment shader code only.',
      'Create a GLSL fragment shader with void main(), uv coordinates, and animated plasma colors.',
    );
    expect(code).toContain('void main');
    expect(code.length).toBeGreaterThan(80);
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
