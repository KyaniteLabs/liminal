import { describe, it, expect } from 'vitest';
/**
 * MiniMax-M2.7-highspeed Test Suite
 * Entitlement-gated MiniMax fast-path proof. This suite must stay outside
 * launch claims unless RUN_MINIMAX_HIGHSPEED_MODEL_TESTS passes with a token
 * plan that can actually access MiniMax-M2.7-highspeed.
 */

import { createLiveProviderClient } from '../helpers/liveProviderTestEnv.js';

const TEST_TIMEOUT = 45000;

describe.skipIf(!process.env.RUN_MINIMAX_HIGHSPEED_MODEL_TESTS)('MiniMax-M2.7-highspeed', () => {
  it('generates p5.js quickly', async () => {
    const startTime = Date.now();
    const live = createLiveProviderClient('minimax', 'MiniMax-M2.7-highspeed');
    expect(live?.config.model, 'MINIMAX_API_KEY with highspeed entitlement is required for MiniMax highspeed proof').toBe('MiniMax-M2.7-highspeed');
    const response = await live!.client.generate(
      'You are a p5.js coder. Output raw JavaScript only.',
      'Create a p5.js sketch with setup(), draw(), createCanvas(), and a blue circle.',
    );
    const duration = Date.now() - startTime;

    expect(response.success).toBe(true);
    expect(response.code).toContain('createCanvas');
    expect(response.code).not.toContain('<think');
    // The speed assertion is meaningful only after the entitlement check above
    // proves the provider accepts the highspeed model for this token plan.
    expect(duration).toBeLessThan(30000);
  }, TEST_TIMEOUT);
});
