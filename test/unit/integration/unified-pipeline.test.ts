/**
 * Integration test — unified pipeline: CreativeFragment → ScoringEngine → CollaborationEngine.
 *
 * Verifies that the consolidation work (Phases 1-3) produces a cohesive system.
 */
import { describe, it, expect } from 'vitest';
import {
  seedToFragment,
  compostFragmentToFragment,
  minedFragmentToFragment,
  scavengerToFragment,
  isFromOrigin,
  type CreativeFragment,
} from '../../../src/core/types.js';
import { ScoringEngine } from '../../../src/core/ScoringEngine.js';
import type { ScoringInput } from '../../../src/core/ScoringEngine.js';
import { EvaluationFramework } from '../../../src/core/EvaluationFramework.js';

// ---------------------------------------------------------------------------
// Cross-system fragment flow
// ---------------------------------------------------------------------------
describe('unified pipeline integration', () => {
  it('fragment from any subsystem can be scored by ScoringEngine', async () => {
    const engine = new ScoringEngine('comprehensive');

    const seed = seedToFragment({
      id: 'seed-1',
      content: 'function setup() { createCanvas(800, 600); background(20); }',
      score: 0.8,
      source: { fragments: ['f1'], collisionType: 'cross', domains: ['visual'] },
      promotedAt: '2026-03-20T00:00:00Z',
    });

    const comp = compostFragmentToFragment({
      id: 'comp-1',
      content: 'A recursive L-system branching structure',
      source: '/art/l-system.js',
      domain: 'code',
      tags: ['l-system'],
      score: 0.7,
    });

    const mined = minedFragmentToFragment({
      id: 'mined-1',
      text: 'Crystal resonance patterns in the void',
      source: 'session-42',
      score: 8,
      persona: 'nova',
      round: 3,
      tags: ['nova'],
      extractedAt: '2026-03-20T00:00:00Z',
    });

    const scav = scavengerToFragment({
      id: 'scav-1',
      content: 'Perlin noise flow field with color gradients',
      domain: 'code',
      score: 0.75,
      tags: ['noise', 'flow'],
    });

    // All fragments should be scorable
    for (const frag of [seed, comp, mined, scav]) {
      const input: ScoringInput = {
        output: frag.content,
        domain: 'p5',
      };
      const result = await engine.score(input, 'comprehensive');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it('fragment origin is preserved through scoring', async () => {
    const engine = new ScoringEngine('comprehensive');

    const fragments: Array<{ frag: CreativeFragment; origin: string }> = [
      {
        frag: seedToFragment({
          id: 's', content: 'test code', score: 0.5,
          source: { fragments: [], collisionType: 'x', domains: [] },
          promotedAt: '2026-01-01T00:00:00Z',
        }),
        origin: 'compost',
      },
      {
        frag: minedFragmentToFragment({
          id: 'm', text: 'test', source: 's', score: 5, persona: 'p',
          round: 1, tags: [], extractedAt: '2026-01-01T00:00:00Z',
        }),
        origin: 'swarm',
      },
      {
        frag: scavengerToFragment({ id: 'v', content: 'test', domain: 'd' }),
        origin: 'scavenger',
      },
    ];

    for (const { frag, origin } of fragments) {
      expect(frag.origin).toBe(origin);
      expect(isFromOrigin(frag, origin)).toBe(true);

      // Score it — origin should not affect scoring
      const result = await engine.score({ output: frag.content }, 'comprehensive');
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('EvaluationFramework delegates to ScoringEngine transparently', async () => {
    const code = 'function setup() { createCanvas(400, 400); } function draw() { circle(200, 200, 50); }';

    // Both entry points should return valid scores
    const frameworkResult = await EvaluationFramework.evaluate(code, 'detailed', { criteria: ['technical', 'creative'] });

    const engine = EvaluationFramework.getEngine();
    const engineResult = await engine.score({ output: code, criteria: ['technical', 'creative'] }, 'comprehensive');

    expect(frameworkResult.score).toBeGreaterThanOrEqual(0);
    expect(frameworkResult.score).toBeLessThanOrEqual(1);
    expect(engineResult.score).toBeGreaterThanOrEqual(0);
    expect(engineResult.score).toBeLessThanOrEqual(1);
    // They should produce the same result since EvaluationFramework delegates to ScoringEngine
    expect(frameworkResult.score).toBeCloseTo(engineResult.score, 5);
  });

  it('custom scoring strategy works end-to-end', async () => {
    const engine = new ScoringEngine();

    engine.register({
      name: 'length-only',
      score(input) {
        const score = Math.min(input.output.length / 1000, 1);
        return { score, dimensions: { length: score }, strategy: 'length-only' };
      },
    });

    const result = await engine.score({ output: 'short' }, 'length-only');
    expect(result.score).toBeLessThan(0.01); // "short" is 5 chars
    expect(result.strategy).toBe('length-only');

    const longResult = await engine.score({ output: 'x'.repeat(1000) }, 'length-only');
    expect(longResult.score).toBe(1.0);
  });
});
