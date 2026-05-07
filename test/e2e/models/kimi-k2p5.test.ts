/**
 * Kimi-k2p5 Test Suite (Moonshot AI)
 * Cloud model — coding agent optimized
 * Gate: RUN_CLOUD_MODEL_TESTS=1
 */
import { describe, it, expect } from 'vitest';
import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 120000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('Kimi-k2p5', () => {
  async function generateCode(systemPrompt: string, prompt: string): Promise<string> {
    const live = createLiveProviderClient('kimi');
    expect(live?.config.provider, 'KIMI_API_KEY or configured Kimi provider is required for Kimi proof').toBe('kimi');
    const response = await live!.client.generate(systemPrompt, prompt);
    expect(response.success).toBe(true);
    return response.code;
  }

  it('generates p5.js sketch', async () => {
    const code = await generateCode(
      'You are a p5.js coder. Output raw JavaScript only. No reasoning.',
      'Create a p5.js sketch with setup(), draw(), createCanvas(), and a blue circle.',
    );
    expect(code).toContain('createCanvas');
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates Three.js scene', async () => {
    const code = await generateCode(
      'You are a Three.js coder. Output raw JavaScript only. No reasoning.',
      'Create a minimal Three.js scene with a scene, camera, renderer, and rotating cube.',
    );
    expect(code).toContain('THREE');
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);

  it('generates GLSL shader', async () => {
    const code = await generateCode(
      'You are a GLSL shader coder. Output raw fragment shader code only. No reasoning.',
      'Create a GLSL fragment shader with void main(), uv coordinates, and animated plasma colors.',
    );
    expect(code).toContain('void main');
    expect(code.length).toBeGreaterThan(80);
    expect(code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
