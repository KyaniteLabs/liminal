import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../../../src/core/ScoringEngine.js';
import { AestheticStrategy } from '../../../src/aesthetic/AestheticStrategy.js';
import type { ScoringStrategy } from '../../../src/core/ScoringEngine.js';

describe('AestheticStrategy', () => {
  it('implements ScoringStrategy interface', () => {
    const strategy: ScoringStrategy = new AestheticStrategy();
    expect(strategy.name).toBe('aesthetic');
    expect(typeof strategy.score).toBe('function');
  });

  it('returns ScoringResult with aesthetic dimension', async () => {
    const strategy = new AestheticStrategy();
    const result = await strategy.score({ output: 'fill("#ff0000"); rect(10, 10, 100, 100);' });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.dimensions.aesthetic).toBeDefined();
    expect(result.strategy).toBe('aesthetic');
  });

  it('can be registered into ScoringEngine', () => {
    const engine = new ScoringEngine();
    engine.register(new AestheticStrategy());
    expect(engine.getStrategy('aesthetic')).toBeDefined();
  });

  it('maps violations to issues', async () => {
    const strategy = new AestheticStrategy();
    // Code with many colors to trigger violations
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff', '#ff6633', '#33ff66'];
    const code = colors.map(c => `fill('${c}');`).join(' ');
    const result = await strategy.score({ output: code });
    expect(result.issues).toBeDefined();
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
