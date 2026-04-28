import { describe, expect, it } from 'vitest';
import { runLevel6ReleaseGate } from '../../../src/runtime-core/Level6ReleaseGate.js';

describe('runLevel6ReleaseGate', () => {
  it('combines self-improvement, domain, cognition, model, and market gates', () => {
    const gate = runLevel6ReleaseGate({ includeMarketReadiness: false });

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
});
