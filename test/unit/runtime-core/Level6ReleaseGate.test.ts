import { describe, expect, it } from 'vitest';
import { runLevel6ReleaseGate } from '../../../src/runtime-core/Level6ReleaseGate.js';

describe('runLevel6ReleaseGate', () => {
  it('combines self-improvement, domain, cognition, model, and market gates in candidate mode', () => {
    const gate = runLevel6ReleaseGate({ includeMarketReadiness: false, candidate: true });

    expect(gate.level).toBe('level-6-candidate');
    expect(gate.ready).toBe(true);
    expect(gate.checks.map((check) => check.id)).toEqual([
      'self-improvement-gauntlet',
      'creative-domain-gauntlet',
      'cognitive-receipts',
      'model-assimilation',
      'workbench-front-door',
    ]);
    expect(gate.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('does not treat dry-run-only evidence as completed Level 6', () => {
    const gate = runLevel6ReleaseGate({ includeMarketReadiness: false });

    expect(gate.level).toBe('not-level-6');
    expect(gate.ready).toBe(false);
    expect(gate.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('Live creative-domain execution'),
      expect.stringContaining('Live model assimilation'),
    ]));
  });
});
