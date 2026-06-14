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

  it('fails every check when no candidate model is named', () => {
    const report = runModelAssimilationGauntlet({ model: '' });

    expect(report.ready).toBe(false);
    expect(report.checks.every((check) => check.status === 'fail')).toBe(true);
    expect(report.checks.find((c) => c.id === 'tool-schema')?.evidence).toContain('No candidate model named');
    expect(report.recommendation).toContain('not eligible');
  });

  it('fails the tool-schema check when the candidate emits prose-only completions', () => {
    const report = runModelAssimilationGauntlet({
      model: 'prose-only-model',
      auditionEvidence: { emitsToolCalls: false },
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.id === 'tool-schema')?.status).toBe('fail');
    expect(report.checks.find((c) => c.id === 'tool-schema')?.evidence).toContain('prose-only');
    // Other checks still pass because only tool-calling failed.
    expect(report.checks.find((c) => c.id === 'creative-routing')?.status).toBe('pass');
  });

  it('fails the no-op-honesty check when a candidate reports a no-op run as success', () => {
    const report = runModelAssimilationGauntlet({
      model: 'dishonest-model',
      auditionEvidence: { reportsNoOpHonestly: false },
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.id === 'no-op-honesty')?.status).toBe('fail');
    expect(report.checks.find((c) => c.id === 'no-op-honesty')?.evidence).toContain('dishonest');
  });

  it('fails the self-improvement-mutation check when the candidate cannot mutate files', () => {
    const report = runModelAssimilationGauntlet({
      model: 'inspect-only-model',
      auditionEvidence: { canMutate: false },
    });

    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.id === 'self-improvement-mutation')?.status).toBe('fail');
  });

  it('passes when real audition evidence satisfies every condition', () => {
    const report = runModelAssimilationGauntlet({
      model: 'good-model',
      provider: 'openai',
      auditionEvidence: {
        emitsToolCalls: true,
        preservesCreativeRouting: true,
        canMutate: true,
        reportsNoOpHonestly: true,
        recordsCostLatency: true,
      },
    });

    expect(report.ready).toBe(true);
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true);
  });
});
