import { describe, expect, it } from 'vitest';
import { summarizeWorkbenchBridge } from '../../gui/src/gui/workbenchTelemetry';

describe('workbenchTelemetry', () => {
  it('summarizes bridge generation progress for the workbench shell', () => {
    const now = Date.parse('2026-04-22T12:02:00.000Z');
    const startedAt = '2026-04-22T12:00:00.000Z';

    const summary = summarizeWorkbenchBridge([
      { type: 'generation.domain_plan', domains: ['three', 'p5'], startedAt, timeoutMinutes: 5, candidateCount: 3 },
      { type: 'generation.attempt.started', domain: 'three', attempt: 1, attemptTotal: 2, startedAt, timeoutMinutes: 5, candidateCount: 3 },
    ], now);

    expect(summary.active).toBe(true);
    expect(summary.phase).toBe('waiting on model');
    expect(summary.stageTitle).toBe('waiting on model');
    expect(summary.timelinePrimary).toBe('three');
    expect(summary.timelineSecondary).toContain('up to');
  });
});
