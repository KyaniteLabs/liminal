import { describe, it, expect } from 'vitest';
import { ModelRouter } from '../../src/swarm/ModelRouter.js';

describe('ModelRouter', () => {
  it('should select from a single option', () => {
    const router = new ModelRouter();
    const decision = router.select([
      { model: 'qwen2.5-coder:7b', taskType: 'geometric' },
    ]);

    expect(decision.model).toBe('qwen2.5-coder:7b');
    expect(decision.taskType).toBe('geometric');
    expect(decision.sampledValue).toBeGreaterThanOrEqual(0);
    expect(decision.sampledValue).toBeLessThanOrEqual(1);
    expect(decision.stats.alpha).toBe(1);
    expect(decision.stats.beta).toBe(1);
  });

  it('should throw on empty options', () => {
    const router = new ModelRouter();
    expect(() => router.select([])).toThrow('No routing options');
  });

  it('should favor models with better history over time', () => {
    const router = new ModelRouter();
    const taskType = 'fractal';

    // Give model-a a strong winning record
    for (let i = 0; i < 20; i++) {
      router.update('model-a', taskType, 0.9);
    }
    // Give model-b a losing record
    for (let i = 0; i < 20; i++) {
      router.update('model-b', taskType, 0.3);
    }

    // Run many selections — model-a should win most
    let aWins = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const decision = router.select([
        { model: 'model-a', taskType },
        { model: 'model-b', taskType },
      ]);
      if (decision.model === 'model-a') aWins++;
    }

    // With 20 successes vs 20 failures, model-a should win >80% of the time
    expect(aWins).toBeGreaterThan(trials * 0.8);
  });

  it('should update stats correctly on success', () => {
    const router = new ModelRouter();
    router.update('test-model', 'generation', 0.8);
    const stats = router.getStats('test-model', 'generation');

    expect(stats.alpha).toBe(2); // prior(1) + success(1)
    expect(stats.beta).toBe(1);  // prior(1), no failure
    expect(stats.totalCalls).toBe(1);
    expect(stats.avgScore).toBeCloseTo(0.8);
  });

  it('should update stats correctly on failure', () => {
    const router = new ModelRouter();
    router.update('test-model', 'generation', 0.4);
    const stats = router.getStats('test-model', 'generation');

    expect(stats.alpha).toBe(1); // prior(1), no success
    expect(stats.beta).toBe(2);  // prior(1) + failure(1)
    expect(stats.totalCalls).toBe(1);
    expect(stats.avgScore).toBeCloseTo(0.4);
  });

  it('should maintain running average across multiple updates', () => {
    const router = new ModelRouter();
    router.update('m', 't', 0.6);
    router.update('m', 't', 0.8);
    router.update('m', 't', 0.4);
    const stats = router.getStats('m', 't');

    expect(stats.totalCalls).toBe(3);
    expect(stats.avgScore).toBeCloseTo(0.6);
  });

  it('should track stats per model+task pair independently', () => {
    const router = new ModelRouter();
    router.update('model-a', 'geometric', 0.9);
    router.update('model-a', 'organic', 0.3);
    router.update('model-b', 'geometric', 0.5);

    const aGeo = router.getStats('model-a', 'geometric');
    const aOrg = router.getStats('model-a', 'organic');
    const bGeo = router.getStats('model-b', 'geometric');

    expect(aGeo.alpha).toBe(2); // success
    expect(aGeo.beta).toBe(1);
    expect(aOrg.alpha).toBe(1);
    expect(aOrg.beta).toBe(2); // failure
    expect(bGeo.alpha).toBe(1);
    expect(bGeo.beta).toBe(2); // failure (< 0.7)
  });

  it('should serialize and deserialize correctly', () => {
    const router = new ModelRouter();
    router.update('m1', 't1', 0.9);
    router.update('m1', 't1', 0.8);
    router.update('m2', 't2', 0.3);

    const json = router.toJSON();
    const restored = ModelRouter.fromJSON(json);

    expect(restored.getStats('m1', 't1')).toEqual(router.getStats('m1', 't1'));
    expect(restored.getStats('m2', 't2')).toEqual(router.getStats('m2', 't2'));
  });

  it('should explore unknown models (prior is uniform)', () => {
    const router = new ModelRouter();
    const taskType = 'test';

    // model-a has 10 failures, model-b is unknown (prior only)
    for (let i = 0; i < 10; i++) {
      router.update('model-a', taskType, 0.2);
    }

    // model-b (unknown) should still win sometimes due to uniform prior
    let bWins = 0;
    for (let i = 0; i < 1000; i++) {
      const d = router.select([
        { model: 'model-a', taskType },
        { model: 'model-b', taskType },
      ]);
      if (d.model === 'model-b') bWins++;
    }

    // Uniform prior Beta(1,1) vs Beta(1,11) — unknown should still win ~5-15%
    expect(bWins).toBeGreaterThan(20);
  });

  it('should return alternatives in the decision', () => {
    const router = new ModelRouter();
    const decision = router.select([
      { model: 'm1', taskType: 't1' },
      { model: 'm2', taskType: 't1' },
      { model: 'm3', taskType: 't1' },
    ]);

    expect(decision.alternatives).toHaveLength(2);
    expect(decision.alternatives.map(a => a.model)).not.toContain(decision.model);
  });
});
