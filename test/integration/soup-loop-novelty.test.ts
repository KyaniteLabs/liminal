import { describe, it, expect } from 'vitest';
import { SoupLoop } from '../../src/core/SoupLoop.js';

describe('SoupLoop Novelty Selection', () => {
  it('accepts useNoveltySelection option without error', async () => {
    const result = await SoupLoop.run('flowing particles', {
      populationSize: 3,
      maxSteps: 2,
      useNoveltySelection: true,
    });
    expect(result).toHaveProperty('population');
    expect(result).toHaveProperty('bestCode');
    expect(result).toHaveProperty('bestScore');
    expect(result.population.length).toBe(3);
    expect(typeof result.bestCode).toBe('string');
    expect(result.bestScore).toBeGreaterThan(0);
  });

  it('backward compatible without useNoveltySelection', async () => {
    const result = await SoupLoop.run('flowing particles', {
      populationSize: 3,
      maxSteps: 2,
    });
    expect(result.population.length).toBe(3);
  });

  it('accepts mapElitesDims option', async () => {
    const result = await SoupLoop.run('flowing particles', {
      populationSize: 3,
      maxSteps: 2,
      useNoveltySelection: true,
      mapElitesDims: [5, 5],
    });
    expect(result.population.length).toBe(3);
  });
});
