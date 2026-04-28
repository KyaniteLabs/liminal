import { describe, expect, it } from 'vitest';
import { runModelAssimilationGauntlet } from '../../../src/runtime-core/ModelAssimilationGauntlet.js';

describe('runModelAssimilationGauntlet', () => {
  it('dry-runs a model audition across routing, tools, creativity, and no-op honesty', () => {
    const report = runModelAssimilationGauntlet({ model: 'local-test-model', provider: 'dry-run' });

    expect(report.ready).toBe(true);
    expect(report.model).toBe('local-test-model');
    expect(report.provider).toBe('dry-run');
    expect(report.checks.map((check) => check.id)).toEqual([
      'tool-schema',
      'creative-routing',
      'self-improvement-mutation',
      'no-op-honesty',
      'cost-latency-record',
    ]);
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true);
    expect(report.recommendation).toContain('eligible');
  });
});
