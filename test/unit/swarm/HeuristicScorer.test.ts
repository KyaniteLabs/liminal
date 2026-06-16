import { describe, it, expect } from 'vitest';
import { HeuristicScorer } from '../../../src/swarm/HeuristicScorer.js';
import type { SwarmPersona, SwarmOutput } from '../../../src/swarm/types.js';

function persona(id: string): SwarmPersona {
  return {
    id,
    name: id,
    displayName: id,
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 200,
    systemPrompt: '',
    voice: '',
    thinkingStyle: '',
    votingBias: '',
    constraints: [],
    votingPower: 2,
  };
}

function output(id: string, content: string): SwarmOutput {
  return {
    personaId: id,
    personaName: id,
    content,
    model: 'test-model',
    tokensUsed: 10,
    latencyMs: 5,
    roundNum: 1,
  };
}

describe('HeuristicScorer — honest degraded marker (D12)', () => {
  it('flags the result as degraded with a token-overlap reason (not a quality score)', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', output('a', 'function draw() { const spiral = drawSpiral(); return spiral; }')],
      ['b', output('b', 'a short reply about something else entirely')],
    ]);
    const personas = [persona('a'), persona('b')];

    const result = HeuristicScorer.score(outputs, personas, 'draw a spiral', []);

    // The result carries an explicit degraded flag and reason.
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toContain('token-overlap');
    expect(result.degradedReason).toContain('not adherence quality');
  });

  it('marks every vote reasoning as [degraded] so it never reads as a quality verdict', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', output('a', 'function setup() { createCanvas(400, 400); }')],
    ]);
    const result = HeuristicScorer.score(outputs, [persona('a')], 'make a canvas', []);

    const vote = result.votes.get('a');
    expect(vote?.reasoning).toContain('[degraded:');
    expect(vote?.reasoning).toContain('token-overlap');
  });

  it('scoreConstraint is presence-only: echoing every keyword scores a perfect 1 without honoring the constraint', () => {
    // The output merely echoes the constraint's scorable keywords (len>3) in any
    // order; it does NOT actually honor the constraint, yet token-overlap → 1.0.
    // This is exactly why the score is flagged degraded, not treated as quality.
    const score = HeuristicScorer.scoreConstraint('spiral beautiful nonsense', 'draw a beautiful spiral');
    // Scorable constraint tokens (len>3): 'draw', 'beautiful', 'spiral'.
    // Output contains 'beautiful' and 'spiral' but not 'draw' → 2/3.
    expect(score).toBeCloseTo(2 / 3, 10);

    // When the output echoes ALL scorable keywords, the proxy gives a perfect score.
    const perfect = HeuristicScorer.scoreConstraint('draw beautiful spiral garbage', 'draw a beautiful spiral');
    expect(perfect).toBe(1);
  });

  it('scoreConstraint returns the neutral 0.5 fallback when the constraint has no scorable tokens', () => {
    expect(HeuristicScorer.scoreConstraint('anything', 'a an the')).toBe(0.5);
  });

  it('still selects a winner deterministically alongside the degraded marker', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['rich', output('rich', 'function draw() { for (let i = 0; i < 10; i++) { circle(i, i, 5); } } class Foo {}')],
      ['thin', output('thin', 'hi')],
    ]);
    const personas = [persona('rich'), persona('thin')];
    const result = HeuristicScorer.score(outputs, personas, 'draw circles in a loop', []);
    expect(result.winnerId).toBe('rich');
    expect(result.degraded).toBe(true);
  });
});

describe('HeuristicScorer — render-signal routing (D12 honesty)', () => {
  it('produces a render-grounded (non-degraded) score when output.metadata.renderSignals.passesRenderGate is set', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', {
        ...output('a', 'function draw() { background(0); }'),
        metadata: { renderSignals: { passesRenderGate: true, luminance: 0.7, renderScore: 0.8 } },
      }],
    ]);
    const result = HeuristicScorer.score(outputs, [persona('a')], 'make a dark canvas', []);

    expect(result.degraded).toBe(false);
    expect(result.degradedReason).toContain('render-signals');
  });

  it('marks the vote reasoning as render-grounded (no [degraded] tag) when signals are present', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', {
        ...output('a', 'function setup() { createCanvas(100, 100); }'),
        metadata: { renderSignals: { passesRenderGate: true, luminance: 0.6 } },
      }],
    ]);
    const result = HeuristicScorer.score(outputs, [persona('a')], 'make a canvas', []);
    const vote = result.votes.get('a');
    expect(vote?.reasoning).toContain('render-grounded');
    expect(vote?.reasoning).not.toContain('[degraded');
  });

  it('falls through to the legacy degraded path when no render signals are present (backward compat)', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', output('a', 'function draw() { circle(50, 50, 25); }')],
    ]);
    const result = HeuristicScorer.score(outputs, [persona('a')], 'draw a circle', []);
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toContain('token-overlap');
  });

  it('mixed batch: at least one render-grounded → batch is not degraded (the grounded path wins)', () => {
    // The aggregate `degraded` flag tracks "is the WHOLE BATCH on the proxy?".
    // If even one output has real render signals, the batch can be
    // meaningfully grounded and the result is no longer a degraded proxy.
    const outputs = new Map<string, SwarmOutput>([
      ['a', {
        ...output('a', 'function draw() { background(0); }'),
        metadata: { renderSignals: { passesRenderGate: true } },
      }],
      ['b', output('b', 'no signals here')],
    ]);
    const personas = [persona('a'), persona('b')];
    const result = HeuristicScorer.score(outputs, personas, 'draw something', []);

    expect(result.degraded).toBe(false);
    expect(result.degradedReason).toContain('render-signals');
  });

  it('all-degraded batch stays degraded even when reason is annotated with availability', () => {
    // When no output had render signals (all 0/0), the legacy proxy is the
    // only signal — the batch is degraded with the legacy reason.
    const outputs = new Map<string, SwarmOutput>([
      ['a', output('a', 'a')],
      ['b', output('b', 'b')],
    ]);
    const personas = [persona('a'), persona('b')];
    const result = HeuristicScorer.score(outputs, personas, 'constraint', []);
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toContain('token-overlap');
  });

  it('treats passesRenderGate=false as a real measured fail and surfaces it in the breakdown', () => {
    const outputs = new Map<string, SwarmOutput>([
      ['a', {
        ...output('a', 'function draw() { /* fail */ }'),
        metadata: { renderSignals: { passesRenderGate: false, luminance: 0.05, renderScore: 0.1 } },
      }],
    ]);
    const result = HeuristicScorer.score(outputs, [persona('a')], 'draw anything', []);

    // Render signals were present, so the result is grounded (not degraded).
    expect(result.degraded).toBe(false);
    // The vote reasoning surfaces the measured fail (passesRenderGate=0).
    const vote = result.votes.get('a');
    expect(vote?.reasoning).toContain('gate=0');
  });
});
