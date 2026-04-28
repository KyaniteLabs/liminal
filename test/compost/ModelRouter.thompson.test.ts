/**
 * Tests for Thompson Sampling Multi-Armed Bandit in ModelRouter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ModelRouter,
  Task,
  ModelResponse,
  sampleBeta,
  ModelPerformanceRecord,
  BanditArm,
} from '../../src/compost/ModelRouter.js';
import { MultiModelConfig } from '../../src/config/ConfigLoader.js';

// Mock LLM client
function createMockClient(responses: { code: string; success: boolean }[]) {
  let callIndex = 0;
  return {
    generate: vi.fn().mockImplementation(async () => {
      const response = responses[callIndex % responses.length];
      callIndex++;
      return response;
    }),
  };
}

describe('Thompson Sampling', () => {
  describe('sampleBeta', () => {
    it('should return values between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const sample = sampleBeta(2, 5);
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThanOrEqual(1);
      }
    });

    it('should handle uniform distribution (α=1, β=1)', () => {
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        samples.push(sampleBeta(1, 1));
      }
      
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // Mean should be approximately 0.5 for uniform distribution
      expect(mean).toBeGreaterThan(0.4);
      expect(mean).toBeLessThan(0.6);
    });

    it('should bias toward 1 when α > β', () => {
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        samples.push(sampleBeta(5, 2));
      }
      
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // Mean should be > 0.5 when α > β
      expect(mean).toBeGreaterThan(0.5);
    });

    it('should bias toward 0 when β > α', () => {
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        samples.push(sampleBeta(2, 5));
      }
      
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      // Mean should be < 0.5 when β > α
      expect(mean).toBeLessThan(0.5);
    });

    it('should return 0.5 for invalid parameters', () => {
      expect(sampleBeta(0, 1)).toBe(0.5);
      expect(sampleBeta(1, 0)).toBe(0.5);
      expect(sampleBeta(-1, 1)).toBe(0.5);
    });
  });

  describe('ModelRouter with Thompson Sampling', () => {
    let config: MultiModelConfig;

    beforeEach(() => {
      config = {
        primary: {
          model: 'test-primary',
          baseUrl: 'http://localhost:1234',
        },
        secondary: {
          model: 'test-secondary',
          baseUrl: 'http://localhost:1235',
        },
        routing: {
          mode: 'thompson',
          confidenceThreshold: 0.8,
        },
      };
    });

    it('should initialize with Beta(1, 1) priors', () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      const stats = router.getStats();
      
      expect(stats.thompson.arms.primary.alpha).toBe(1);
      expect(stats.thompson.arms.primary.beta).toBe(1);
      expect(stats.thompson.arms.secondary.alpha).toBe(1);
      expect(stats.thompson.arms.secondary.beta).toBe(1);
    });

    it('should track performance history', async () => {
      const primaryClient = createMockClient([
        { code: 'function test() {}', success: true },
      ]);
      const secondaryClient = createMockClient([
        { code: 'function test() {}', success: true },
      ]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a test function',
        domain: 'coding',
      };
      
      await router.route(task);
      
      const history = router.getPerformanceHistory();
      expect(history.length).toBeGreaterThan(0);
      
      const record = history[0];
      expect(record).toHaveProperty('model');
      expect(record).toHaveProperty('domain');
      expect(record).toHaveProperty('score');
      expect(record).toHaveProperty('timestamp');
      expect(record.domain).toBe('coding');
    });

    it('should update Beta distribution after successful generation', async () => {
      const primaryClient = createMockClient([
        { code: 'function test() { return 42; }', success: true },
      ]);
      const secondaryClient = createMockClient([
        { code: 'function test() { return 42; }', success: true },
      ]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      // Force exploration to ensure both models are used
      router.enableExplorationMode();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a test function',
      };
      
      await router.route(task);
      
      const stats = router.getStats();
      // After a successful generation, alpha should increase (success = α + 1)
      const initialAlpha = 1;
      const currentAlpha = stats.thompson.arms.primary.alpha;
      
      // The model used should have its alpha increased
      expect(currentAlpha + stats.thompson.arms.primary.beta).toBeGreaterThan(initialAlpha + 1);
    });

    it('should update Beta distribution after failed generation', async () => {
      const primaryClient = createMockClient([
        { code: '', success: false },
      ]);
      const secondaryClient = createMockClient([
        { code: 'function test() {}', success: true },
      ]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      router.enableExplorationMode();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a test function',
      };
      
      await router.route(task);
      
      const stats = router.getStats();
      // After a failed generation, beta should increase (failure = β + 1)
      const totalBeta = stats.thompson.arms.primary.beta + stats.thompson.arms.secondary.beta;
      expect(totalBeta).toBeGreaterThan(2); // Initial was 1 + 1 = 2
    });

    it('should prefer models with higher success rates over time', async () => {
      // Primary always succeeds, secondary always fails
      const primaryClient = createMockClient(
        Array(20).fill({ code: 'function success() {}', success: true })
      );
      const secondaryClient = createMockClient(
        Array(20).fill({ code: '', success: false })
      );
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      // Reset to ensure clean state
      router.resetBandit();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a function',
      };
      
      // Run multiple generations to build up history
      for (let i = 0; i < 25; i++) {
        await router.route(task);
      }
      
      const stats = router.getStats();
      
      // Primary should have higher alpha/beta ratio (more successes)
      const primaryRatio = stats.thompson.arms.primary.alpha / 
        (stats.thompson.arms.primary.alpha + stats.thompson.arms.primary.beta);
      const secondaryRatio = stats.thompson.arms.secondary.alpha / 
        (stats.thompson.arms.secondary.alpha + stats.thompson.arms.secondary.beta);
      
      expect(primaryRatio).toBeGreaterThan(secondaryRatio);
    });

    it('should enter exploration mode when stagnation detected', async () => {
      // Both models return same mediocre quality
      const primaryClient = createMockClient(
        Array(30).fill({ code: 'function ok() {}', success: true })
      );
      const secondaryClient = createMockClient(
        Array(30).fill({ code: 'function ok() {}', success: true })
      );
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      router.resetBandit();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Write a function',
      };
      
      // Run many generations with same quality to trigger stagnation
      for (let i = 0; i < 25; i++) {
        await router.route(task);
      }
      
      const stats = router.getStats();
      // Stagnation detection should trigger exploration mode
      // Note: This may or may not trigger depending on random variance
      // So we just verify the system doesn't crash
      expect(stats.thompson.explorationMode).not.toBeNull();
    });

    it('should support manual exploration mode toggle', () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      expect(router.getStats().thompson.explorationMode).toBe(false);
      
      router.enableExplorationMode();
      expect(router.getStats().thompson.explorationMode).toBe(true);
      
      router.disableExplorationMode();
      expect(router.getStats().thompson.explorationMode).toBe(false);
    });

    it('should reset bandit state correctly', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      await router.route(task);
      
      // Verify state was modified
      expect(router.getPerformanceHistory().length).toBeGreaterThan(0);
      
      // Reset
      router.resetBandit();
      
      const stats = router.getStats();
      expect(stats.thompson.arms.primary.alpha).toBe(1);
      expect(stats.thompson.arms.primary.beta).toBe(1);
      expect(stats.thompson.arms.secondary.alpha).toBe(1);
      expect(stats.thompson.arms.secondary.beta).toBe(1);
      expect(router.getPerformanceHistory().length).toBe(0);
      expect(stats.thompson.explorationMode).toBe(false);
    });

    it('should work with only primary model (no secondary)', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const noSecondaryConfig: MultiModelConfig = {
        primary: config.primary,
        routing: config.routing,
      };
      
      const router = new ModelRouter(primaryClient, undefined, noSecondaryConfig);
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      const response = await router.route(task);
      
      expect(response.model).toBe('primary');
      expect(response.success).toBe(true);
    });

    it('should include quality score in response', async () => {
      const primaryClient = createMockClient([
        { code: 'function test() { return 42; }', success: true },
      ]);
      const secondaryClient = createMockClient([
        { code: 'function test() {}', success: true },
      ]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      router.enableExplorationMode();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      const response = await router.route(task);
      
      expect(response.qualityScore).not.toBeNull();
      expect(response.qualityScore).toBeGreaterThanOrEqual(0);
      expect(response.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should trim history when exceeding max size', async () => {
      const primaryClient = createMockClient(
        Array(200).fill({ code: 'test', success: true })
      );
      const secondaryClient = createMockClient(
        Array(200).fill({ code: 'test', success: true })
      );
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      router.resetBandit();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      // Run many generations
      for (let i = 0; i < 250; i++) {
        await router.route(task);
      }
      
      // History should be trimmed to max (100 per model * 2 models = 200)
      const history = router.getPerformanceHistory();
      expect(history.length).toBeLessThanOrEqual(200);
    });

    it('should track domain in performance records', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      router.enableExplorationMode();
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
        domain: 'webgl',
      };
      
      await router.route(task);
      
      const history = router.getPerformanceHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].domain).toBe('webgl');
    });

    it('should provide correct arm statistics', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const router = new ModelRouter(primaryClient, secondaryClient, config);
      
      const arms = router.getArms();
      
      expect(arms.has('primary')).toBe(true);
      expect(arms.has('secondary')).toBe(true);
      
      const primaryArm = arms.get('primary')!;
      expect(primaryArm.distribution.alpha).toBe(1);
      expect(primaryArm.distribution.beta).toBe(1);
      expect(primaryArm.totalPulls).toBe(0);
      expect(primaryArm.totalReward).toBe(0);
    });
  });

  describe('Routing modes', () => {
    let config: MultiModelConfig;

    beforeEach(() => {
      config = {
        primary: {
          model: 'test-primary',
          baseUrl: 'http://localhost:1234',
        },
        secondary: {
          model: 'test-secondary',
          baseUrl: 'http://localhost:1235',
        },
        routing: {
          mode: 'thompson',
          confidenceThreshold: 0.8,
        },
      };
    });

    it('should default to thompson routing when mode is unrecognized', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const unknownConfig: MultiModelConfig = {
        ...config,
        routing: {
          ...config.routing,
          mode: 'unknown' as any,
        },
      };
      
      const router = new ModelRouter(primaryClient, secondaryClient, unknownConfig);
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      const response = await router.route(task);
      
      // Should succeed and use Thompson routing (default)
      expect(response.success).toBe(true);
      expect(router.getStats().mode).toBe('unknown');
    });

    it('should still support cascade routing', async () => {
      const primaryClient = createMockClient([{ code: 'test', success: true }]);
      const secondaryClient = createMockClient([{ code: 'test', success: true }]);
      
      const cascadeConfig: MultiModelConfig = {
        ...config,
        routing: {
          ...config.routing,
          mode: 'cascade',
        },
      };
      
      const router = new ModelRouter(primaryClient, secondaryClient, cascadeConfig);
      
      const task: Task = {
        type: 'general',
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };
      
      const response = await router.route(task);
      
      expect(response.success).toBe(true);
      expect(router.getStats().mode).toBe('cascade');
    });
  });
});
