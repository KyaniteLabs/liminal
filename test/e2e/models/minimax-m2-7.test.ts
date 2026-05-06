import { describe, it, expect } from 'vitest';
/**
 * MiniMax-M2.7 Test Suite
 * Cloud model - best quality
 */

import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 60000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('MiniMax-M2.7', () => {
  async function generateCode(systemPrompt: string, prompt: string): Promise<string> {
    const live = createLiveProviderClient('minimax', 'MiniMax-M2.7');
    expect(live, 'MINIMAX_API_KEY is required for MiniMax proof').not.toBeNull();
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
});
