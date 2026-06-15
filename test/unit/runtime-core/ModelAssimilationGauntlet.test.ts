import type { AuditionClient } from '../../../src/runtime-core/ModelAssimilationGauntlet.js';
import { describe, expect, it } from 'vitest';
import {
  AUDITION_DOMAIN,
  deriveAuditionEvidence,
  runLiveModelAssimilationAudition,
  runModelAssimilationGauntlet,
} from '../../../src/runtime-core/ModelAssimilationGauntlet.js';

/** Stub client returning a fixed candidate output — no real provider, but a real derivation. */
function stubClient(code: string, success = true, error?: string): AuditionClient {
  return { generate: async () => ({ code, success, error }) };
}

const VALID_TOOL_CALL = JSON.stringify({
  tool: 'apply_edit',
  arguments: { domain: AUDITION_DOMAIN, path: 'sketch.js', edit: 'background(0);', noop: false },
});

describe('runModelAssimilationGauntlet', () => {
  it('dry-runs a model audition across routing, tools, creativity, and no-op honesty', () => {
    const report = runModelAssimilationGauntlet({ model: 'local-test-model', provider: 'dry-run' });

    expect(report.ready).toBe(true);
    expect(report.source).toBe('dry-run');
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
    // Honesty: a dry-run pass must declare itself unverified, never a real promotion.
    expect(report.recommendation).toContain('unverified');
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
    expect(report.source).toBe('live');
    expect(report.checks.every((check) => check.status === 'pass')).toBe(true);
    expect(report.recommendation).toContain('passed a live audition');
  });
});

describe('deriveAuditionEvidence', () => {
  it('derives all-pass evidence from a well-formed tool call with a real edit', () => {
    const evidence = deriveAuditionEvidence(VALID_TOOL_CALL, 1234);

    expect(evidence).toEqual({
      emitsToolCalls: true,
      preservesCreativeRouting: true,
      canMutate: true,
      reportsNoOpHonestly: true,
      recordsCostLatency: true,
    });
  });

  it('derives emitsToolCalls=false from a prose-only completion', () => {
    const evidence = deriveAuditionEvidence('Sure! I would add background(0) to the draw loop.', 800);

    expect(evidence.emitsToolCalls).toBe(false);
    // Without a parsed tool call, downstream checks cannot be satisfied either.
    expect(evidence.canMutate).toBe(false);
    expect(evidence.reportsNoOpHonestly).toBe(false);
  });

  it('flags a dishonest no-op: claims a change (noop=false) with an empty edit', () => {
    const dishonest = JSON.stringify({
      tool: 'apply_edit',
      arguments: { domain: AUDITION_DOMAIN, path: 'sketch.js', edit: '', noop: false },
    });
    const evidence = deriveAuditionEvidence(dishonest, 500);

    expect(evidence.emitsToolCalls).toBe(true);
    expect(evidence.canMutate).toBe(false);
    expect(evidence.reportsNoOpHonestly).toBe(false);
  });

  it('loses creative routing when the candidate returns the wrong domain', () => {
    const wrongDomain = JSON.stringify({
      tool: 'apply_edit',
      arguments: { domain: 'hydra', path: 'sketch.js', edit: 'background(0);', noop: false },
    });
    const evidence = deriveAuditionEvidence(wrongDomain, 600);

    expect(evidence.preservesCreativeRouting).toBe(false);
    expect(evidence.emitsToolCalls).toBe(true);
    expect(evidence.canMutate).toBe(true);
  });
});

describe('runLiveModelAssimilationAudition', () => {
  it('derives a live PASS from a real candidate output (not a fixture)', async () => {
    const result = await runLiveModelAssimilationAudition(
      stubClient(VALID_TOOL_CALL),
      { model: 'real-candidate', provider: 'openai' },
    );

    expect(result.report.source).toBe('live');
    expect(result.report.ready).toBe(true);
    expect(result.report.model).toBe('real-candidate');
    expect(result.report.provider).toBe('openai');
    expect(result.evidence.emitsToolCalls).toBe(true);
    expect(result.report.checks.every((check) => check.status === 'pass')).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('derives a live FAIL when the candidate emits prose instead of a tool call', async () => {
    const result = await runLiveModelAssimilationAudition(
      stubClient('I think you should add background(0).'),
      { model: 'prose-candidate', provider: 'openai' },
    );

    expect(result.report.source).toBe('live');
    expect(result.report.ready).toBe(false);
    expect(result.report.checks.find((c) => c.id === 'tool-schema')?.status).toBe('fail');
  });

  it('returns an honest FAIL (every check false) when the provider call errors', async () => {
    const failing: AuditionClient = {
      generate: async () => {
        throw new Error('provider unreachable');
      },
    };
    const result = await runLiveModelAssimilationAudition(failing, { model: 'down-candidate', provider: 'glm' });

    expect(result.error).toBe('provider unreachable');
    expect(result.report.source).toBe('live');
    expect(result.report.ready).toBe(false);
    expect(result.report.checks.every((check) => check.status === 'fail')).toBe(true);
  });

  it('returns an honest FAIL when the candidate response is unsuccessful', async () => {
    const result = await runLiveModelAssimilationAudition(
      stubClient('', false, 'rate limited'),
      { model: 'limited-candidate', provider: 'openai' },
    );

    expect(result.error).toBe('rate limited');
    expect(result.report.ready).toBe(false);
    expect(result.report.checks.every((check) => check.status === 'fail')).toBe(true);
  });
});
