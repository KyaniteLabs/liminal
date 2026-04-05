import { describe, it, expect } from 'vitest';
import {
  DOMAIN_ROUTING,
  MODEL_IDS,
  getBestModel,
  getPreferredModels,
  shouldAvoidModel,
  getMinSizeForDomain,
  getModelRanking,
  getPromptHints,
} from '../../../src/config/model-routing.js';

describe('model-routing', () => {
  it('exports DOMAIN_ROUTING with all expected domains', () => {
    const domains = Object.keys(DOMAIN_ROUTING);
    expect(domains).toContain('p5');
    expect(domains).toContain('glsl');
    expect(domains).toContain('three');
    expect(domains).toContain('hydra');
    expect(domains).toContain('strudel');
    expect(domains.length).toBeGreaterThanOrEqual(7);
  });

  it('returns a best model for known domain', () => {
    const model = getBestModel('p5');
    expect(typeof model).toBe('string');
    expect(model).toBeTruthy();
  });

  it('returns fallback for unknown domain', () => {
    expect(getBestModel('nonexistent')).toBe(MODEL_IDS.MINIMAX_M2_5);
  });

  it('identifies models to avoid', () => {
    expect(shouldAvoidModel('three', MODEL_IDS.QWEN_35_9B)).toBe(true);
    expect(shouldAvoidModel('p5', MODEL_IDS.MINIMAX_M2_5)).toBe(false);
  });

  it('returns min size per domain', () => {
    expect(getMinSizeForDomain('hydra')).toBe(200);
    expect(getMinSizeForDomain('unknown')).toBe(500);
  });

  it('returns model ranking for a domain', () => {
    const ranking = getModelRanking('p5', MODEL_IDS.MINIMAX_M2_5);
    expect(ranking).toBeDefined();
    expect(ranking!.quality).toBeGreaterThanOrEqual(1);
  });

  it('returns prompt hints for known domain', () => {
    const hints = getPromptHints('glsl');
    expect(hints.length).toBeGreaterThan(0);
  });
});
