import { describe, it, expect } from 'vitest';
/**
 * MiniMax-M2.7-highspeed Test Suite
 * Cloud model - same quality as M2.7 but faster (100 tps vs 60 tps)
 */

import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 45000; // Faster model

describe.skipIf(!process.env.RUN_MINIMAX_HIGHSPEED_MODEL_TESTS)('MiniMax-M2.7-highspeed', () => {
  it('generates p5.js quickly', async () => {
    const startTime = Date.now();
    const live = createLiveProviderClient('minimax', 'MiniMax-M2.7-highspeed');
    expect(live, 'MINIMAX_API_KEY with highspeed entitlement is required for MiniMax highspeed proof').not.toBeNull();
    const response = await live!.client.generate(
      'You are a p5.js coder. Output raw JavaScript only.',
      'Create a p5.js sketch with setup(), draw(), createCanvas(), and a blue circle.',
    );
    const duration = Date.now() - startTime;

    expect(response.success).toBe(true);
    expect(response.code).toContain('createCanvas');
    expect(response.code).not.toContain('<think');
    expect(duration).toBeLessThan(30000); // Should be fast
  }, TEST_TIMEOUT);
});
