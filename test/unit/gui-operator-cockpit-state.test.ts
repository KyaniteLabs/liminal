import { describe, expect, it } from 'vitest';
import { deriveCockpit } from '../../gui/src/components/OperatorCockpit';

describe('OperatorCockpit state derivation', () => {
  it('shows elapsed time, bounded ETA, and estimated progress while a model request is still pending', () => {
    const now = Date.parse('2026-04-22T12:01:15.000Z');
    const startedAt = '2026-04-22T12:00:00.000Z';

    const state = deriveCockpit([
      { type: 'generation.domain_plan', domains: ['three', 'p5', 'hydra'], startedAt, timeoutMinutes: 5, candidateCount: 3 },
      { type: 'generation.attempt.started', domain: 'three', attempt: 1, attemptTotal: 3, startedAt, timeoutMinutes: 5, candidateCount: 3 },
    ], now);

    expect(state.phase).toBe('waiting on model');
    expect(state.elapsedLabel).toBe('1m 15s');
    expect(state.etaLabel).toBe('up to 13m 45s left');
    expect(state.progressPercent).toBeGreaterThan(0);
    expect(state.progressPercent).toBeLessThan(0.2);
    expect(state.activeWork).toContain('3 candidates');
  });

  it('surfaces human-only review focus and copyable context after artifacts complete', () => {
    const state = deriveCockpit([
      { type: 'generation.domain_plan', domains: ['tone'], startedAt: '2026-04-22T12:00:00.000Z', candidateCount: 3 },
      { type: 'generation.attempt.started', domain: 'tone', attempt: 1, attemptTotal: 1, startedAt: '2026-04-22T12:00:01.000Z' },
      { type: 'artifact.found', artifactLabel: 'tone HTML preview', artifactPath: '.omx/proof/live-cognition/tone.html' },
      {
        type: 'generation.cognitive_receipt',
        loop: 'creative',
        receipts: [{ organ: 'memory', status: 'observed', detail: 'Retrieved prior tone run.' }],
      },
      { type: 'generation.complete', iterations: 1, finalScore: 0.82, duration: 1200, model: 'GLM-5v-turbo', reason: 'complete' },
    ], Date.parse('2026-04-22T12:00:03.000Z'));

    expect(state.humanReview.status).toBe('ready');
    expect(state.humanReview.summary).toContain('humans should judge');
    expect(state.humanReview.checks.some((check) => check.detail.includes('audio feel'))).toBe(true);
    expect(state.humanReview.issueReport).toContain('tone HTML preview');
    expect(state.humanReview.issueReport).toContain('memory:observed');
  });


  it('marks completed draft previews as done instead of showing future fallback work', () => {
    const state = deriveCockpit([
      { type: 'generation.domain_plan', domains: ['p5', 'three', 'hydra', 'glsl'], startedAt: '2026-04-28T04:13:00.000Z', timeoutMinutes: 5, candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.attempt.started', domain: 'p5', attempt: 1, attemptTotal: 4, startedAt: '2026-04-28T04:13:01.000Z', timeoutMinutes: 5, candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.complete', iterations: 1, finalScore: 0, duration: 58000, model: 'MiniMax-M2.7', reason: 'draft artifact ready (unscored)', qualityState: 'unscored', executionMode: 'draft' },
      { type: 'artifact.found', artifactLabel: 'three preview image', artifactPath: '/tmp/three.png' },
      { type: 'preview.completed', content: 'abc', previewType: 'image', imageUrl: '/tmp/three.png' },
    ], Date.parse('2026-04-28T04:14:30.000Z'));

    expect(state.phase).toBe('complete');
    expect(state.progressPercent).toBe(1);
    expect(state.etaLabel).toBe('done');
    expect(state.activeWork).toContain('no more domains are running');
    expect(state.selectedDomain).toBe('three');
  });

});
