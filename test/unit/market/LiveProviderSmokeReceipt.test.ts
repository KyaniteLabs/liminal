import { describe, expect, it } from 'vitest';
import { buildLiveProviderSmokeReceipt, selectLiveSmokeProvider } from '../../../src/market/LiveProviderSmokeReceipt.js';

describe('LiveProviderSmokeReceipt', () => {
  it('prefers configured cloud providers for market smoke', () => {
    expect(selectLiveSmokeProvider(['ollama', 'minimax', 'glm'])).toBe('glm');
    expect(selectLiveSmokeProvider(['ollama', 'minimax'])).toBe('minimax');
  });

  it('records a pass only when provider generation returns usable p5 code', () => {
    const receipt = buildLiveProviderSmokeReceipt({
      provider: 'glm',
      model: 'GLM-5v-turbo',
      durationMs: 123,
      artifactPath: '.omx/proof/live-provider-smoke/p5.js',
      code: 'function setup(){ createCanvas(400, 400); }',
    });

    expect(receipt.status).toBe('pass');
    expect(receipt.checks.nonEmptyCode).toBe(true);
    expect(receipt.checks.p5Setup).toBe(true);
    expect(receipt.checks.p5Canvas).toBe(true);
  });

  it('fails incomplete provider output instead of treating any text as ready', () => {
    const receipt = buildLiveProviderSmokeReceipt({
      provider: 'glm',
      model: 'GLM-5v-turbo',
      durationMs: 123,
      artifactPath: '.omx/proof/live-provider-smoke/p5.js',
      code: 'hello world',
    });

    expect(receipt.status).toBe('fail');
    expect(receipt.blockers).toContain('Generated p5 code is missing setup()');
    expect(receipt.blockers).toContain('Generated p5 code is missing createCanvas()');
  });
});
