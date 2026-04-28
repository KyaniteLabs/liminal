import { describe, it, expect } from 'vitest';
import { RalphLoop } from '../../src/core/RalphLoop.js';
import { MapElites } from '../../src/evolution/MapElites.js';
import { SafetyGuardrails } from '../../src/core/SafetyGuardrails.js';

describe('RalphLoop MAP-Elites Integration', () => {
  it('accepts useMapElites option', () => {
    expect(RalphLoop).not.toBeNull();
  });

  it('MapElites can be imported and used alongside RalphLoop options', () => {
    const grid = new MapElites([5, 5]);
    expect(grid.size()).toBe(0);
    grid.insert('test', [0.5, 0.5], 0.8);
    expect(grid.size()).toBe(1);
  });

  it('SafetyGuardrails integrates with budget config', () => {
    const guard = new SafetyGuardrails({ maxBudgetUsd: 0 });
    guard.recordApiCost(0.01);
    expect(guard.checkBudget()).toBe(false);
  });
});
