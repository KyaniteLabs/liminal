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

describe('MODEL_IDS', () => {
  it('contains exactly 6 model identifiers', () => {
    expect(Object.values(MODEL_IDS).length).toBe(6);
  });

  it('has expected model ID values', () => {
    expect(MODEL_IDS.MINIMAX_M2_7).toBe('minimax-m2.7');
    expect(MODEL_IDS.MINIMAX_M2_5).toBe('minimax-m2.5');
    expect(MODEL_IDS.QWEN_35_9B).toBe('qwen3.5-9b');
    expect(MODEL_IDS.QWEN_CODER_40B).toBe('qwen3-coder-40b');
    expect(MODEL_IDS.GEMMA_3_4B).toBe('gemma3-4b');
    expect(MODEL_IDS.KIMI_K2_5).toBe('kimi-k2.5');
  });
});

describe('DOMAIN_ROUTING', () => {
  it('defines routing for all 8 domains', () => {
    const domains = Object.keys(DOMAIN_ROUTING).sort();
    expect(domains).toEqual(['ascii', 'glsl', 'html', 'hydra', 'p5', 'revideo', 'strudel', 'three']);
  });

  it('every domain has required routing fields with valid data', () => {
    for (const [, routing] of Object.entries(DOMAIN_ROUTING)) {
      expect(Array.isArray(routing.preferred)).toBe(true);
      expect(routing.preferred.length).toBeGreaterThan(0);
      expect(Array.isArray(routing.avoid)).toBe(true);
      expect(typeof routing.minSize).toBe('number');
      expect(routing.minSize).toBeGreaterThan(0);
      expect(Array.isArray(routing.rankings)).toBe(true);
      expect(routing.rankings.length).toBeGreaterThan(0);
      expect(Array.isArray(routing.promptHints)).toBe(true);
    }
  });

  it('every ranking has complete fields with valid score ranges', () => {
    for (const [, routing] of Object.entries(DOMAIN_ROUTING)) {
      for (const ranking of routing.rankings) {
        expect(typeof ranking.id).toBe('string');
        expect(ranking.quality).toBeGreaterThanOrEqual(1);
        expect(ranking.quality).toBeLessThanOrEqual(10);
        expect(ranking.speed).toBeGreaterThanOrEqual(1);
        expect(ranking.speed).toBeLessThanOrEqual(10);
        expect(ranking.reliability).toBeGreaterThanOrEqual(1);
        expect(ranking.reliability).toBeLessThanOrEqual(10);
        expect(typeof ranking.avgTimeSeconds).toBe('number');
        expect(typeof ranking.avgSizeBytes).toBe('number');
        expect(Array.isArray(ranking.issues)).toBe(true);
      }
    }
  });

  it('three avoid list includes qwen3.5-9b', () => {
    expect(DOMAIN_ROUTING.three.avoid).toContain('qwen3.5-9b');
  });

  it('hydra avoid list includes 4 models that failed the audit', () => {
    expect(DOMAIN_ROUTING.hydra.avoid).toEqual([
      'qwen3.5-9b',
      'qwen3-coder-40b',
      'minimax-m2.5',
      'kimi-k2.5',
    ]);
  });

  it('p5 and glsl domains have empty avoid lists', () => {
    expect(DOMAIN_ROUTING.p5.avoid).toEqual([]);
    expect(DOMAIN_ROUTING.glsl.avoid).toEqual([]);
  });
});

describe('getBestModel', () => {
  it('returns first preferred model for each known domain', () => {
    expect(getBestModel('p5')).toBe('minimax-m2.5');
    expect(getBestModel('glsl')).toBe('kimi-k2.5');
    expect(getBestModel('three')).toBe('minimax-m2.7');
    expect(getBestModel('hydra')).toBe('minimax-m2.7');
    expect(getBestModel('strudel')).toBe('qwen3-coder-40b');
  });

  it('is case-insensitive', () => {
    expect(getBestModel('P5')).toBe('minimax-m2.5');
    expect(getBestModel('GLSL')).toBe('kimi-k2.5');
    expect(getBestModel('Three')).toBe('minimax-m2.7');
  });

  it('returns minimax-m2.5 as fallback for unknown domain', () => {
    expect(getBestModel('unknown')).toBe('minimax-m2.5');
    expect(getBestModel('')).toBe('minimax-m2.5');
  });
});

describe('getPreferredModels', () => {
  it('returns ordered list for a known domain', () => {
    const preferred = getPreferredModels('p5');
    expect(preferred[0]).toBe('minimax-m2.5');
    expect(preferred.length).toBe(6);
  });

  it('is case-insensitive', () => {
    expect(getPreferredModels('P5')).toEqual(getPreferredModels('p5'));
  });

  it('returns all model IDs for unknown domain', () => {
    const preferred = getPreferredModels('nonexistent');
    const allIds = Object.values(MODEL_IDS);
    expect(preferred.sort()).toEqual(allIds.sort());
  });
});

describe('shouldAvoidModel', () => {
  it('returns true for qwen3.5-9b in three domain', () => {
    expect(shouldAvoidModel('three', 'qwen3.5-9b')).toBe(true);
  });

  it('returns false for minimax-m2.7 in three domain', () => {
    expect(shouldAvoidModel('three', 'minimax-m2.7')).toBe(false);
  });

  it('returns true for all hydra avoid list models', () => {
    expect(shouldAvoidModel('hydra', 'qwen3.5-9b')).toBe(true);
    expect(shouldAvoidModel('hydra', 'qwen3-coder-40b')).toBe(true);
    expect(shouldAvoidModel('hydra', 'minimax-m2.5')).toBe(true);
    expect(shouldAvoidModel('hydra', 'kimi-k2.5')).toBe(true);
  });

  it('returns false for good models in hydra', () => {
    expect(shouldAvoidModel('hydra', 'minimax-m2.7')).toBe(false);
    expect(shouldAvoidModel('hydra', 'gemma3-4b')).toBe(false);
  });

  it('is case-insensitive on domain', () => {
    expect(shouldAvoidModel('THREE', 'qwen3.5-9b')).toBe(true);
  });

  it('returns false for unknown domain', () => {
    expect(shouldAvoidModel('unknown', 'any-model')).toBe(false);
  });
});

describe('getMinSizeForDomain', () => {
  it('returns correct minimum sizes for all known domains', () => {
    expect(getMinSizeForDomain('p5')).toBe(1000);
    expect(getMinSizeForDomain('glsl')).toBe(800);
    expect(getMinSizeForDomain('three')).toBe(1000);
    expect(getMinSizeForDomain('hydra')).toBe(200);
    expect(getMinSizeForDomain('strudel')).toBe(100);
    expect(getMinSizeForDomain('revideo')).toBe(800);
    expect(getMinSizeForDomain('html')).toBe(600);
    expect(getMinSizeForDomain('ascii')).toBe(1500);
  });

  it('returns 500 for unknown domain', () => {
    expect(getMinSizeForDomain('unknown')).toBe(500);
  });

  it('is case-insensitive', () => {
    expect(getMinSizeForDomain('P5')).toBe(1000);
  });
});

describe('getModelRanking', () => {
  it('returns ranking with specific values for a known domain and model', () => {
    const ranking = getModelRanking('p5', 'minimax-m2.5');
    expect(ranking?.id).toBe('minimax-m2.5');
    expect(ranking!.id).toBe('minimax-m2.5');
    expect(ranking!.quality).toBe(9);
    expect(ranking!.speed).toBe(10);
    expect(ranking!.reliability).toBe(10);
    expect(ranking!.avgTimeSeconds).toBe(18);
    expect(ranking!.avgSizeBytes).toBe(4175);
  });

  it('returns undefined for unknown model in a known domain', () => {
    expect(getModelRanking('p5', 'nonexistent-model')).toBeUndefined();
  });

  it('returns undefined for unknown domain', () => {
    expect(getModelRanking('unknown', 'minimax-m2.7')).toBeUndefined();
  });

  it('returns correct low ranking for three.js qwen3.5-9b failure', () => {
    const ranking = getModelRanking('three', 'qwen3.5-9b');
    expect(ranking?.id).toBe('qwen3.5-9b');
    expect(ranking!.quality).toBe(1);
    expect(ranking!.reliability).toBe(3);
    expect(ranking!.issues).toEqual(['FAILED - 66b empty output']);
  });
});

describe('getPromptHints', () => {
  it('returns hints for known domains', () => {
    const hints = getPromptHints('p5');
    expect(Array.isArray(hints)).toBe(true);
    expect(hints.length).toBeGreaterThan(0);
  });

  it('hydra hints mention 50% failure rate', () => {
    const hints = getPromptHints('hydra');
    expect(hints.some(h => h.includes('50% failure rate'))).toBe(true);
  });

  it('returns empty array for unknown domain', () => {
    expect(getPromptHints('unknown')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(getPromptHints('HYDRA')).toEqual(getPromptHints('hydra'));
  });
});
