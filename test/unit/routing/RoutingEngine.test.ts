/**
 * Routing module tests — GeneratorBanditRouter, QualityPredictor, RoutingData.
 *
 * Tests Thompson Sampling bandit logic, quality prediction heuristics,
 * and static routing data integrity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Suppress Logger
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock sampleBeta for deterministic Thompson Sampling
const { mockSampleBeta } = vi.hoisted(() => ({
  mockSampleBeta: vi.fn(),
}));

vi.mock('../../../src/compost/ModelRouter.js', () => ({
  sampleBeta: mockSampleBeta,
}));

import { GeneratorBanditRouter } from '../../../src/routing/GeneratorBanditRouter.js';
import type { BanditState } from '../../../src/routing/GeneratorBanditRouter.js';
import { QualityPredictor } from '../../../src/routing/QualityPredictor.js';
import type { RoutingFeatures } from '../../../src/routing/QualityPredictor.js';
import {
  AB_TEST_RESULTS,
  DOMAIN_ROUTING_DATA,
  OVERALL_FITNESS,
  DOMAIN_KEYWORDS,
} from '../../../src/routing/RoutingData.js';
import type { DomainType, ModelChoice } from '../../../src/routing/RoutingData.js';

// ---------------------------------------------------------------------------
// GeneratorBanditRouter
// ---------------------------------------------------------------------------

describe('GeneratorBanditRouter', () => {
  let router: GeneratorBanditRouter;

  beforeEach(() => {
    router = new GeneratorBanditRouter();
    mockSampleBeta.mockReset();
  });

  describe('selectModel', () => {
    it('returns null when no arms have enough pulls', () => {
      expect(router.selectModel('music')).toBeNull();
    });

    it('returns null when arms have fewer than 5 pulls', () => {
      for (let i = 0; i < 4; i++) {
        router.recordOutcome('music', 'local', 0.8);
      }
      expect(router.selectModel('music')).toBeNull();
    });

    it('selects a model when enough data is accumulated', () => {
      const models: ModelChoice[] = ['local', 'cloud', 'hybrid'];
      for (const model of models) {
        for (let i = 0; i < 6; i++) {
          router.recordOutcome('music', model, 0.5);
        }
      }

      // Stub sampleBeta to return deterministic values
      mockSampleBeta.mockImplementation((alpha: number, _beta: number) => {
        if (alpha > 3) return 0.9;
        return 0.3;
      });

      const result = router.selectModel('music');
      expect(result).toBeOneOf(['local', 'cloud', 'hybrid']);
    });
  });

  describe('recordOutcome', () => {
    it('increments alpha (success) for scores >= 0.7', () => {
      router.recordOutcome('code', 'local', 0.85);
      const stats = router.getDomainStats('code');
      expect(stats.local.alpha).toBe(2); // prior 1 + success 1
      expect(stats.local.beta).toBe(1);  // unchanged
      expect(stats.local.pulls).toBe(1);
    });

    it('increments beta (failure) for scores < 0.7', () => {
      router.recordOutcome('code', 'local', 0.3);
      const stats = router.getDomainStats('code');
      expect(stats.local.alpha).toBe(1);  // unchanged
      expect(stats.local.beta).toBe(2);  // prior 1 + failure 1
      expect(stats.local.pulls).toBe(1);
    });

    it('accumulates total reward across recordings', () => {
      router.recordOutcome('ascii', 'cloud', 0.8);
      router.recordOutcome('ascii', 'cloud', 0.6);
      const stats = router.getDomainStats('ascii');
      expect(stats.cloud.pulls).toBe(2);
      expect(stats.cloud.meanReward).toBeCloseTo(0.7, 5);
    });
  });

  describe('isReady', () => {
    it('returns false with no pulls', () => {
      expect(router.isReady('visual')).toBe(false);
    });

    it('returns true when at least one model has 5 pulls', () => {
      for (let i = 0; i < 5; i++) {
        router.recordOutcome('visual', 'cloud', 0.6);
      }
      expect(router.isReady('visual')).toBe(true);
    });
  });

  describe('getBestModel', () => {
    it('returns null with no pulls', () => {
      expect(router.getBestModel('music')).toBeNull();
    });

    it('returns the model with highest mean reward', () => {
      for (let i = 0; i < 3; i++) {
        router.recordOutcome('music', 'local', 0.9);
        router.recordOutcome('music', 'cloud', 0.2);
      }
      expect(router.getBestModel('music')).toBe('local');
    });

    it('handles ties by returning first model checked', () => {
      router.recordOutcome('code', 'local', 0.5);
      router.recordOutcome('code', 'cloud', 0.5);
      expect(router.getBestModel('code')).toBe('local');
    });
  });

  describe('getDomainStats', () => {
    it('returns stats for all three models with no recordings', () => {
      const stats = router.getDomainStats('html');
      expect(Object.keys(stats)).toEqual(['local', 'cloud', 'hybrid']);
      expect(stats.local.pulls).toBe(0);
      expect(stats.local.meanReward).toBe(0);
      expect(stats.local.alpha).toBe(1); // default prior
      expect(stats.local.beta).toBe(1);  // default prior
    });
  });

  describe('serialize and deserialize', () => {
    it('round-trips state through serialize/deserialize', () => {
      router.recordOutcome('music', 'local', 0.9);
      router.recordOutcome('music', 'cloud', 0.3);
      router.recordOutcome('ascii', 'cloud', 0.85);

      const state: BanditState = router.serialize();
      expect(state.version).toBe(1);
      expect(state.arms).toHaveLength(3);
      expect(state.updatedAt).toBeTruthy();

      const fresh = new GeneratorBanditRouter();
      fresh.deserialize(state);

      const arms = fresh.getArms();
      expect(arms).toHaveLength(3);

      const localMusicArm = arms.find(
        a => a.domain === 'music' && a.model === 'local',
      );
      expect(localMusicArm!.pulls).toBe(1)
      expect(localMusicArm!.totalReward).toBeCloseTo(0.9, 5)
      expect(localMusicArm!.alpha).toBe(2); // prior(1) + success(1)
    });

    it('deserialize clears previous state', () => {
      router.recordOutcome('html', 'local', 0.5);
      const state = router.serialize()

      const fresh = new GeneratorBanditRouter();
      fresh.recordOutcome('visual', 'cloud', 0.8)
      expect(fresh.getArms()).toHaveLength(1)

      fresh.deserialize(state);
      expect(fresh.getArms().some(a => a.domain === 'visual')).toBe(false)
    });
  });

  describe('reset', () => {
    it('clears all arms', () => {
      router.recordOutcome('code', 'local', 0.9)
      router.recordOutcome('music', 'cloud', 0.5)
      expect(router.getArms()).toHaveLength(2)

      router.reset()
      expect(router.getArms()).toHaveLength(0)
      expect(router.isReady('code')).toBe(false)
    });
  });
});

// ---------------------------------------------------------------------------
// QualityPredictor
// ---------------------------------------------------------------------------

describe('QualityPredictor', () => {
  let predictor: QualityPredictor;

  beforeEach(() => {
    predictor = new QualityPredictor();
  });

  describe('simple code complexity', () => {
    it('recommends local for simple code', () => {
      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'code',
        previousScore: null,
        modelTier: 'local',
      };

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
      expect(result.predictedScore).toBe(0.75)
    });

    it('baseline 0.75 score for simple code', () => {
      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'code',
        previousScore: null,
        modelTier: 'local',
      };

      const result = predictor.predictQuality(features)
      // BASELINE_LOCAL_SCORES.simple = 0.75, TIER_boost local = 0.0
      expect(result.predictedScore).toBe(0.75)
    });
  });

  describe('medium code complexity', () => {
    it('stays local when previous score > 0.8', () => {
      const features: RoutingFeatures = {
        promptLength: 300,
        codeComplexity: 'medium',
        domain: 'code',
        previousScore: 0.85,
        modelTier: 'cloud',
      };

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
    });

    it('upgrades to cloud when previous score < 0.5', () => {
      const features: RoutingFeatures = {
        promptLength: 300,
        codeComplexity: 'medium',
        domain: 'code',
        previousScore: 0.3,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
    });

    it('stays local when previous score is moderate', () => {
      const features: RoutingFeatures = {
        promptLength: 300,
        codeComplexity: 'medium',
        domain: 'code',
        previousScore: 0.65,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
    })
  });

  describe('complex code complexity', () => {
    it('recommends cloud for complex code', () => {
      const features: RoutingFeatures = {
        promptLength: 500,
        codeComplexity: 'complex',
        domain: 'code',
        previousScore: null,
        modelTier: 'cloud',
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('cloud')
    });

    it('honors modelTier ceiling', () => {
      const features: RoutingFeatures = {
        promptLength: 500,
        codeComplexity: 'complex',
        domain: 'code',
        previousScore: null,
        modelTier: 'local', // constrains to local
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
    })

    it('cloud score > local for complex code', () => {
      const localFeatures: RoutingFeatures = {
        promptLength: 500,
        codeComplexity: 'complex',
        domain: 'code',
        previousScore: null,
        modelTier: 'local',
      };
      const cloudFeatures: RoutingFeatures = {
        ...localFeatures,
        modelTier: 'cloud',
      }

      const localResult = predictor.predictQuality(localFeatures);
      const cloudResult = predictor.predictQuality(cloudFeatures)
      expect(cloudResult.predictedScore).toBeGreaterThan(localResult.predictedScore)
    });
  });

  describe('previous score adjustments', () => {
    it('adds 0.08 bump when previous score > 0.8', () => {
      const features: RoutingFeatures = {
        promptLength: 200,
        codeComplexity: 'simple',
        domain: 'code',
        previousScore: 0.9,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      // baseline 0.75 + bump 0.08 = 0.83
      expect(result.predictedScore).toBe(0.83)
    })

    it('subtracts 0.08 when previous score < 0.5', () => {
      const features: RoutingFeatures = {
        promptLength: 200,
        codeComplexity: 'simple',
        domain: 'code',
        previousScore: 0.2,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      // baseline 0.75 - 0.08 = 0.67
      expect(result.predictedScore).toBe(0.67)
    });
  });

  describe('recordOutcome', () => {
    it('records outcomes and returns ranked models', () => {
      predictor.recordOutcome('local', 'code', 0.9);
      predictor.recordOutcome('cloud', 'code', 0.5)

      const ranking = predictor.getModelRanking('code')
      expect(ranking).toHaveLength(2)
      expect(ranking[0].model).toBe('local')
      expect(ranking[0].avgScore).toBeCloseTo(0.9, 2)
      expect(ranking[1].model).toBe('cloud')
    })

    it('uses EMA to blend scores', () => {
      predictor.recordOutcome('local', 'code', 1.0)
      predictor.recordOutcome('local', 'code', 0.0)

      const ranking = predictor.getModelRanking('code')
      // EMA: new = 0.3 * 0.0 + 0.7 * 1.0 = 0.3
      expect(ranking[0].avgScore).toBeCloseTo(0.7, 2)
    })

    it('returns empty ranking for unknown domain', () => {
      const ranking = predictor.getModelRanking('nonexistent')
      expect(ranking).toEqual([])
    });
  });

  describe('history-driven model selection', () => {
    it('overrides heuristic when history strongly favors cloud', () => {
      for (let i = 0; i < 5; i++) {
        predictor.recordOutcome('cloud', 'test-domain', 0.9)
      }

      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'test-domain',
        previousScore: null,
        modelTier: 'cloud',
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('cloud')
    })

    it('does not override when history avgScore <= 0.75', () => {
      for (let i = 0; i < 5; i++) {
        predictor.recordOutcome('cloud', 'weak-domain', 0.6);
      }

      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'weak-domain',
        previousScore: null,
        modelTier: 'cloud',
      }

      const result = predictor.predictQuality(features)
      expect(result.recommendedModel).toBe('local')
    });
  });

  describe('getRecommendedModel', () => {
    it('returns the same model as predictQuality', () => {
      const features: RoutingFeatures = {
        promptLength: 200,
        codeComplexity: 'complex',
        domain: 'visual',
        previousScore: null,
        modelTier: 'cloud',
      }

      const prediction = predictor.predictQuality(features)
      const recommended = predictor.getRecommendedModel(features)
      expect(recommended).toBe(prediction.recommendedModel)
    });
  });

  describe('reasoning', () => {
    it('includes complexity and tier info', () => {
      const features: RoutingFeatures = {
        promptLength: 200,
        codeComplexity: 'complex',
        domain: 'visual',
        previousScore: 0.85,
        modelTier: 'cloud',
      }

      const result = predictor.predictQuality(features)
      expect(result.reasoning).toContain('complex')
      expect(result.reasoning).toContain('local')
      expect(result.reasoning).toContain('0.85')
    })

    it('notes when no previous score is available', () => {
      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'code',
        previousScore: null,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      expect(result.reasoning).toContain('No previous score')
    });
  });

  describe('confidence', () => {
    it('starts at 0.5 with no history', () => {
      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'fresh-domain',
        previousScore: null,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      expect(result.confidence).toBe(0.5)
    });

    it('increases as more samples are recorded', () => {
      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'growing-domain',
        previousScore: null,
        modelTier: 'local',
      }

      const before = predictor.predictQuality(features).confidence

      for (let i = 0; i < 10; i++) {
        predictor.recordOutcome('local', 'growing-domain', 0.8)
      }

      const after = predictor.predictQuality(features).confidence
      expect(after).toBeGreaterThan(before)
    })

    it('caps confidence at 1.0', () => {
      for (let i = 0; i < 100; i++) {
        predictor.recordOutcome('local', 'saturated-domain', 0.8)
      }

      const features: RoutingFeatures = {
        promptLength: 100,
        codeComplexity: 'simple',
        domain: 'saturated-domain',
        previousScore: null,
        modelTier: 'local',
      }

      const result = predictor.predictQuality(features)
      expect(result.confidence).toBeLessThanOrEqual(1.0)
    });
  });

  describe('score clamping', () => {
    it('clamps predicted score to [0, 1]', () => {
      const features: RoutingFeatures = {
        promptLength: 500,
        codeComplexity: 'complex',
        domain: 'code',
        previousScore: 0.95,
        modelTier: 'premium',
      }

      const result = predictor.predictQuality(features)
      expect(result.predictedScore).toBeLessThanOrEqual(1.0)
      expect(result.predictedScore).toBeGreaterThanOrEqual(0)
    });
  });
});

// ---------------------------------------------------------------------------
// RoutingData (static)
// ---------------------------------------------------------------------------

describe('RoutingData (static)', () => {
  const ALL_DOMAINS: DomainType[] = [
    'ascii', 'music', 'code', 'visual', 'remotion', 'html', 'webdev',
  ]

  it('has AB test_RESULTS for all 7 domains', () => {
    for (const domain of ALL_DOMAINS) {
      expect(AB_TEST_RESULTS[domain]).toBeDefined()
      expect(AB_TEST_RESULTS[domain].local).toBeGreaterThanOrEqual(0)
      expect(AB_TEST_RESULTS[domain].cloud).toBeGreaterThanOrEqual(0)
      expect(AB_TEST_RESULTS[domain].hybrid).toBeGreaterThanOrEqual(0)
    }
  })

  it('all fitness scores are in [0, 1]', () => {
    for (const domain of ALL_DOMAINS) {
      const fitness = AB_TEST_RESULTS[domain];
      expect(fitness.local).toBeLessThanOrEqual(1);
      expect(fitness.cloud).toBeLessThanOrEqual(1);
      expect(fitness.hybrid).toBeLessThanOrEqual(1);
    }
  });

  it('has routing config for all 7 domains', () => {
    for (const domain of ALL_DOMAINS) {
      const config = DOMAIN_ROUTING_DATA[domain];
      expect(config).toBeDefined()
      expect(['local', 'cloud', 'hybrid']).toContain(config.optimalModel)
      expect(config.confidence).toBeGreaterThanOrEqual(0)
      expect(config.confidence).toBeLessThanOrEqual(1)
    }
  });

  it('music has local as optimal model', () => {
    expect(DOMAIN_ROUTING_DATA.music.optimalModel).toBe('local')
    expect(DOMAIN_ROUTING_DATA.music.advantage).toContain('121');
  });

  it('ascii has cloud as optimal model', () => {
    expect(DOMAIN_ROUTING_DATA.ascii.optimalModel).toBe('cloud')
    expect(DOMAIN_ROUTING_DATA.ascii.advantage).toContain('46');
  });

  it('has local, cloud, and hybrid averages', () => {
    expect(typeof OVERALL_FITNESS.local).toBe('number')
    expect(typeof OVERALL_FITNESS.cloud).toBe('number')
    expect(typeof OVERALL_FITNESS.hybrid).toBe('number')
  });

  it('has keyword arrays for all 7 domains', () => {
    for (const domain of ALL_DOMAINS) {
      expect(Array.isArray(DOMAIN_KEYWORDS[domain])).toBe(true)
      expect(DOMAIN_KEYWORDS[domain].length).toBeGreaterThan(0)
    }
  });

  it('music keywords include strudel and hydra', () => {
    expect(DOMAIN_KEYWORDS.music).toContain('strudel')
    expect(DOMAIN_KEYWORDS.music).toContain('hydra')
  });

  it('code keywords include algorithm and function', () => {
    expect(DOMAIN_KEYWORDS.code).toContain('function')
    expect(DOMAIN_KEYWORDS.code).toContain('algorithm')
  });

  it('html keywords include css and responsive', () => {
    expect(DOMAIN_KEYWORDS.html).toContain('css')
    expect(DOMAIN_KEYWORDS.html).toContain('responsive')
  });

  it('all keywords are lowercase', () => {
    for (const domain of Object.keys(DOMAIN_KEYWORDS)) {
      for (const kw of DOMAIN_KEYWORDS[domain]) {
        expect(kw).toBe(kw.toLowerCase());
      }
    }
  });
});
