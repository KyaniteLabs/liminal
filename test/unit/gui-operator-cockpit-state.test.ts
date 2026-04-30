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

  it('keeps provider failure receipts visible in cockpit state', () => {
    const state = deriveCockpit([
      { type: 'generation.domain_plan', domains: ['hydra'], candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.attempt.started', domain: 'hydra', attempt: 1, attemptTotal: 1, executionMode: 'draft' },
      {
        type: 'generation.attempt.failed',
        domain: 'hydra',
        attempt: 1,
        attemptTotal: 1,
        error: 'LLM generation failed: OpenAI API error 429: rate limited',
        provider: 'openai',
        model: 'gpt-5.4-mini',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        statusCode: 429,
        retryable: true,
        responseBody: '{"error":"rate limited"}',
      },
    ]);

    expect(state.phase).toBe('fallback');
    expect(state.attempts[0].detail).toContain('openai / gpt-5.4-mini');
    expect(state.attempts[0].detail).toContain('HTTP 429');
    expect(state.failureReceipts).toEqual([
      expect.objectContaining({
        title: 'hydra attempt 1 / 1 failed',
        provider: 'openai',
        model: 'gpt-5.4-mini',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        statusCode: 429,
        retryable: true,
        responseBody: '{"error":"rate limited"}',
        summary: expect.stringContaining('retryable'),
      }),
    ]);
    expect(state.humanReview.summary).toContain('openai / gpt-5.4-mini');
    expect(state.humanReview.issueReport).toContain('HTTP 429');
  });

  it('marks the cockpit phase as verified preview after preview verification arrives', () => {
    const state = deriveCockpit([
      { type: 'generation.route.selected', domain: 'p5', domains: ['p5'], executionMode: 'draft', candidateCount: 1, timeoutMinutes: 1 },
      { type: 'generation.domain_plan', domains: ['p5'], startedAt: '2026-04-29T02:00:00.000Z', candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.attempt.started', domain: 'p5', attempt: 1, attemptTotal: 1, startedAt: '2026-04-29T02:00:01.000Z', executionMode: 'draft' },
      { type: 'artifact.found', artifactLabel: 'p5 HTML preview', artifactPath: '.omx/proof/live-previews/p5.html' },
      { type: 'preview.completed', content: 'abc', previewType: 'image', imageUrl: '.omx/proof/live-previews/p5.png' },
      { type: 'preview.verified', previewType: 'image', artifactPath: '.omx/proof/live-previews/p5.png', checks: ['screenshot rendered'] },
    ], Date.parse('2026-04-29T02:00:04.000Z'));

    expect(state.phase).toBe('verified preview');
    expect(state.latestMessage).toContain('screenshot rendered');
    expect(state.activeWork).toContain('Preview verified');
  });

  it('does not treat an empty event history as disconnected', () => {
    const state = deriveCockpit([]);

    expect(state.phase).toBe('idle');
    expect(state.activeWork).toBe('Idle');
    expect(state.etaLabel).toContain('left');
  });

  it('marks stopped and missing-preview states as terminal surface states', () => {
    const stopped = deriveCockpit([
      { type: 'generation.route.selected', domain: 'p5', domains: ['p5'], executionMode: 'draft', candidateCount: 1 },
      { type: 'generation.attempt.started', domain: 'p5', attempt: 1, attemptTotal: 1, executionMode: 'draft' },
      { type: 'generation.cancelled', reason: 'operator-stop', cancelledAt: '2026-04-29T03:00:00.000Z' },
    ], Date.parse('2026-04-29T03:00:01.000Z'));

    expect(stopped.phase).toBe('stopped');
    expect(stopped.etaLabel).toBe('done');
    expect(stopped.progressPercent).toBe(1);
    expect(stopped.activeWork).toContain('stopped by operator');

    const missing = deriveCockpit([
      { type: 'generation.route.selected', domain: 'three', domains: ['three'], executionMode: 'draft' },
      { type: 'artifact.found', artifactLabel: 'three HTML preview', artifactPath: '.omx/proof/live-previews/three.html' },
      { type: 'preview.missing', previewType: 'image', reason: 'screenshot render failed', artifactPath: '.omx/proof/live-previews/three.html' },
    ], Date.parse('2026-04-29T03:00:01.000Z'));

    expect(missing.phase).toBe('preview missing');
    expect(missing.latestMessage).toContain('screenshot render failed');
    expect(missing.activeWork).toContain('Preview unavailable');
  });

  it('does not keep the cockpit disconnected after newer events arrive', () => {
    const state = deriveCockpit([
      { type: 'generation.route.selected', domain: 'three', domains: ['three'], executionMode: 'draft' },
      { type: 'stream.disconnected', message: 'Workbench event stream disconnected; create a new session.' },
      { type: 'preview.completed', content: 'abc', previewType: 'image', imageUrl: '.omx/proof/live-previews/three.png' },
      { type: 'generation.complete', iterations: 1, finalScore: 0, duration: 1200, model: 'qwen', reason: 'draft artifact ready', executionMode: 'draft' },
    ], Date.parse('2026-04-29T03:00:01.000Z'));

    expect(state.phase).toBe('complete');
    expect(state.latestMessage).not.toContain('event stream disconnected');
    expect(state.activeWork).toContain('Preview ready from three');
    expect(state.etaLabel).toBe('done');
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

  it('describes backup domains without implying a fallback already happened', () => {
    const state = deriveCockpit([
      { type: 'generation.route.selected', domain: 'p5', domains: ['p5', 'three'], startedAt: '2026-04-29T02:00:00.000Z', candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.domain_plan', domains: ['p5', 'three'], startedAt: '2026-04-29T02:00:00.000Z', candidateCount: 1, executionMode: 'draft' },
      { type: 'generation.attempt.started', domain: 'p5', attempt: 1, attemptTotal: 2, startedAt: '2026-04-29T02:00:01.000Z', candidateCount: 1, executionMode: 'draft' },
    ], Date.parse('2026-04-29T02:00:05.000Z'));

    expect(state.latestMessage).toBe('Selected p5; backup domains if needed: three');
    expect(state.activeWork).toBe('Generating first usable preview in p5.');
    expect(`${state.latestMessage} ${state.activeWork}`).not.toMatch(/fallback/i);
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
    expect(state.latestMessage).not.toMatch(/fallback/i);
    expect(state.selectedDomain).toBe('three');
  });

});
