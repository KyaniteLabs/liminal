import { describe, it, expect } from 'vitest';
/**
 * MiniMax-M2.5 Test Suite
 * Cloud model - value option, good quality, cheaper
 */

import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 60000;

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('MiniMax-M2.5', () => {
  it('generates p5.js sketch', async () => {
    const live = createLiveProviderClient('minimax', 'MiniMax-M2.5');
    expect(live?.config.model, 'MINIMAX_API_KEY is required for MiniMax proof').toBe('MiniMax-M2.5');
    const response = await live!.client.generate(
      'You are a p5.js coder. Output raw JavaScript only.',
      'Create a p5.js sketch with setup(), draw(), createCanvas(), and a blue circle.',
    );
    expect(response.success).toBe(true);
    expect(response.code).toContain('createCanvas');
    expect(response.code).not.toContain('<think');
  }, TEST_TIMEOUT);
});
