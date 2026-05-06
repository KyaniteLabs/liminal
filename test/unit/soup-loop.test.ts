import { describe, it, expect } from 'vitest';
/**
 * SoupLoop tests (W1-S) - population of K candidates; pick two, merge, evaluate, replace one.
 * TDD: red → green → refactor.
 */
import path from 'path';
import os from 'os';

const TEST_GALLERY_DIR = path.join(os.tmpdir(), 'atelier-soup-loop-test');

describe('SoupLoop (W1-S)', () => {
  it('maintains K candidates; step = pick two, merge, evaluate, replace one', async () => {
    const { SoupLoop } = await import('../../src/core/SoupLoop.js');
    const steps: { populationSize: number; merged: boolean }[] = [];
    const result = await SoupLoop.run('blue particles', {
      populationSize: 3,
      maxSteps: 5,
      galleryDir: TEST_GALLERY_DIR,
      project: 'soup-test',
      onStep: (data) => steps.push({ populationSize: data.population.length, merged: data.merged }),
    });

    expect(result.population?.length).toBe(3);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    // Each step should attempt a merge (merged may be false if the merge scores lower)
    expect(steps.every((s) => s.populationSize === 3)).toBe(true);
    expect(result.bestCode).not.toBeNull();
    expect(result.bestScore).toBeGreaterThanOrEqual(0);
  });
});
