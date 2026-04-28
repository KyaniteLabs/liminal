import { describe, it, expect, beforeEach, test } from 'vitest';
import { MetaMode } from '../../../src/evolution/MetaMode.js';

describe('MetaMode', () => {
  let meta: MetaMode;

  beforeEach(() => {
    meta = new MetaMode();
  });

  test('constructor initializes empty state', () => {
    expect(meta.getAllExperiments()).toEqual([]);
    expect(meta.getBestExperiment()).toBeNull();
    expect(meta.getCompletedCount()).toBe(0);
  });

  test('generateHypotheses returns 6 experiments', () => {
    const experiments = meta.generateHypotheses(0.5);
    expect(experiments).toHaveLength(6);
  });

  test('generateHypotheses experiments have correct structure', () => {
    const experiments = meta.generateHypotheses(0.42);

    for (const exp of experiments) {
      expect(exp.name).toMatch(/^exp-\d+$/);
      expect(exp.params).not.toBeNull();
      expect(typeof exp.params.noveltyWeight).toBe('number');
      expect(typeof exp.params.qualityWeight).toBe('number');
      expect(typeof exp.params.temperature).toBe('number');
      expect(typeof exp.params.populationSize).toBe('number');
      expect(exp.baselineScore).toBe(0.42);
    }
  });

  test('generateHypotheses experiments have undefined experimentScore', () => {
    const experiments = meta.generateHypotheses(0.5);

    for (const exp of experiments) {
      expect(exp.experimentScore).toBeUndefined();
      expect(exp.improvement).toBeUndefined();
    }
  });

  test('runExperiment returns a number between 0 and 1', async () => {
    const experiments = meta.generateHypotheses(0.5);
    const score = await meta.runExperiment(experiments[0]);

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('runExperiment updates experiment.experimentScore', async () => {
    const experiments = meta.generateHypotheses(0.5);
    await meta.runExperiment(experiments[0]);

    expect(experiments[0].experimentScore).not.toBeNull();
    expect(typeof experiments[0].experimentScore).toBe('number');
  });

  test('runExperiment updates experiment.improvement', async () => {
    const experiments = meta.generateHypotheses(0.5);
    await meta.runExperiment(experiments[0]);

    expect(typeof experiments[0].improvement).toBe('number');
    expect(experiments[0].improvement).toBe(
      experiments[0].experimentScore! - experiments[0].baselineScore,
    );
  });

  test('getBestExperiment returns null before any experiments run', () => {
    expect(meta.getBestExperiment()).toBeNull();
  });

  test('getBestExperiment returns the best experiment after running', async () => {
    const experiments = meta.generateHypotheses(0.5);

    await meta.runExperiment(experiments[0]);
    await meta.runExperiment(experiments[1]);

    const best = meta.getBestExperiment();
    expect(best).not.toBeNull();
    expect([experiments[0], experiments[1]]).toContain(best);
    expect(best!.experimentScore).toBeGreaterThanOrEqual(
      experiments[0].experimentScore!,
    );
    expect(best!.experimentScore).toBeGreaterThanOrEqual(
      experiments[1].experimentScore!,
    );
  });

  test('getAllExperiments returns all experiments', () => {
    const experiments = meta.generateHypotheses(0.5);
    expect(meta.getAllExperiments()).toEqual(experiments);
  });

  test('getCompletedCount returns 0 initially', () => {
    expect(meta.getCompletedCount()).toBe(0);
  });

  test('getCompletedCount increments after each runExperiment', async () => {
    const experiments = meta.generateHypotheses(0.5);

    expect(meta.getCompletedCount()).toBe(0);
    await meta.runExperiment(experiments[0]);
    expect(meta.getCompletedCount()).toBe(1);
    await meta.runExperiment(experiments[1]);
    expect(meta.getCompletedCount()).toBe(2);
    await meta.runExperiment(experiments[2]);
    expect(meta.getCompletedCount()).toBe(3);
  });

  test('reset clears all state', async () => {
    meta.generateHypotheses(0.5);
    const experiments = meta.getAllExperiments();
    await meta.runExperiment(experiments[0]);

    expect(meta.getAllExperiments().length).toBeGreaterThan(0);
    expect(meta.getBestExperiment()).not.toBeNull();
    expect(meta.getCompletedCount()).toBeGreaterThan(0);

    meta.reset();

    expect(meta.getAllExperiments()).toEqual([]);
    expect(meta.getBestExperiment()).toBeNull();
    expect(meta.getCompletedCount()).toBe(0);
  });

  test('full workflow: generate -> run all -> get best', async () => {
    const experiments = meta.generateHypotheses(0.3);
    expect(experiments).toHaveLength(6);

    const scores: number[] = [];
    for (const exp of experiments) {
      const score = await meta.runExperiment(exp);
      scores.push(score);
    }

    expect(meta.getCompletedCount()).toBe(6);

    const best = meta.getBestExperiment();
    expect(best).not.toBeNull();
    expect(best!.experimentScore).toBe(Math.max(...scores));

    // Every experiment should have been scored
    for (const exp of experiments) {
      expect(exp.experimentScore).not.toBeNull();
      expect(exp.improvement).not.toBeNull();
    }
  });
});
