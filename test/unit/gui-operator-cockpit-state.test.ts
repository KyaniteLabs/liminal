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
});
