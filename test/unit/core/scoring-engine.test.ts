/**
 * ScoringEngine unit tests — pluggable scoring strategies, normalization.
 */
import { describe, it, expect } from 'vitest';
import { ScoringEngine } from '../../../src/core/ScoringEngine.js';
import type { ScoringInput, ScoringStrategy } from '../../../src/core/ScoringEngine.js';

// ---------------------------------------------------------------------------
// Built-in strategies
// ---------------------------------------------------------------------------
describe('ScoringEngine built-in strategies', () => {
  const engine = new ScoringEngine('comprehensive');

  const codeInput: ScoringInput = {
    output: `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(220);
  for (let i = 0; i < 100; i++) {
    ellipse(random(width), random(height), 10);
  }
}`,
    domain: 'p5',
    prompt: 'Generative particle art',
  };

  it('comprehensive strategy returns 0-1 score with dimensions', async () => {
    const result = await engine.score(codeInput, 'comprehensive');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.strategy).toBe('comprehensive');
    expect(result.dimensions).not.toBeNull();
    expect(result.dimensions?.technical).toBeGreaterThanOrEqual(0);
    expect(result.dimensions?.technical).toBeLessThanOrEqual(1);
    expect(result.dimensions?.creative).toBeGreaterThanOrEqual(0);
    expect(result.dimensions?.creative).toBeLessThanOrEqual(1);
  });

  it('fast strategy (legacy alias for keyword) returns 0-1 score', async () => {
    const result = await engine.score(codeInput, 'fast');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.strategy).toBe('keyword'); // 'fast' is a legacy alias for 'keyword'
  });

  it('keyword strategy returns 0-1 score', async () => {
    const result = await engine.score(codeInput, 'keyword');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.strategy).toBe('keyword');
  });

  it('throws on unknown strategy', async () => {
    await expect(engine.score(codeInput, 'nonexistent')).rejects.toThrow('Unknown scoring strategy');
  });
});

// ---------------------------------------------------------------------------
// Pluggable strategies
// ---------------------------------------------------------------------------
describe('ScoringEngine custom strategies', () => {
  it('can register and use a custom strategy', async () => {
    const engine = new ScoringEngine();

    const alwaysPerfect: ScoringStrategy = {
      name: 'always-perfect',
      score() {
        return { score: 1.0, dimensions: { technical: 1.0, creative: 1.0 }, strategy: 'always-perfect' };
      },
    };

    engine.register(alwaysPerfect);
    const result = await engine.score({ output: '' }, 'always-perfect');

    expect(result.score).toBe(1.0);
    expect(result.strategy).toBe('always-perfect');
  });

  it('can unregister a strategy', async () => {
    const engine = new ScoringEngine();
    engine.unregister('keyword');
    expect(engine.listStrategies()).not.toContain('keyword');
  });

  it('can list all registered strategies', () => {
    const engine = new ScoringEngine();
    const strategies = engine.listStrategies();
    expect(strategies).toContain('comprehensive');
    expect(strategies).toContain('fast');
    expect(strategies).toContain('keyword');
  });

  it('can set default strategy', async () => {
    const engine = new ScoringEngine('keyword');
    engine.setDefault('fast');

    const result = await engine.score({ output: 'test code' });
    expect(result.strategy).toBe('keyword'); // 'fast' is a legacy alias for 'keyword'
  });

  it('setDefault throws on unknown strategy', () => {
    const engine = new ScoringEngine();
    expect(() => engine.setDefault('bogus')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// quick() convenience
// ---------------------------------------------------------------------------
describe('ScoringEngine.quick()', () => {
  it('returns a number for simple input', async () => {
    const engine = new ScoringEngine('comprehensive');
    const score = await engine.quick('function setup() { createCanvas(400, 400); }');
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Normalization — all dimensions 0-1
// ---------------------------------------------------------------------------
describe('score normalization', () => {
  const engine = new ScoringEngine();

  it('all dimension values are within 0-1', async () => {
    const strategies = ['comprehensive', 'fast', 'keyword'];

    for (const strategy of strategies) {
      const result = await engine.score({
        output: `const x = 42; function test() { return x * 2; }`,
        domain: 'code',
      }, strategy);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);

      for (const [, value] of Object.entries(result.dimensions)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Async strategy support
// ---------------------------------------------------------------------------
describe('async strategies', () => {
  it('supports async score methods', async () => {
    const engine = new ScoringEngine();

    const asyncStrategy: ScoringStrategy = {
      name: 'async-test',
      async score(input) {
        // Simulate async work
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              score: input.output.length > 10 ? 0.8 : 0.3,
              dimensions: {},
              strategy: 'async-test',
            });
          }, 1);
        });
      },
    };

    engine.register(asyncStrategy);
    const result = await engine.score({ output: 'hello world test' }, 'async-test');
    expect(result.score).toBe(0.8);
    expect(result.strategy).toBe('async-test');
  });
});
