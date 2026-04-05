import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockFailureLogger } = vi.hoisted(() => ({
  mockFailureLogger: { log: vi.fn(), getSessionId: vi.fn(() => 'test-session') },
}));

vi.mock('../../../src/harness/FailureLogger.js', () => ({
  failureLogger: mockFailureLogger,
}));
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { HarnessUpdater } from '../../../src/harness/HarnessUpdater.js';
import type { Pattern } from '../../../src/harness/PatternDetector.js';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: 'test-pattern',
    name: 'Test Pattern',
    description: 'A test pattern',
    detector: () => true,
    occurrences: 1,
    firstSeen: '2026-01-01T00:00:00Z',
    lastSeen: '2026-01-01T00:00:00Z',
    affectedModels: ['qwen'],
    affectedDomains: ['p5'],
    ...overrides,
  };
}

describe('HarnessUpdater', () => {
  let updater: HarnessUpdater;

  beforeEach(() => {
    vi.clearAllMocks();
    updater = new HarnessUpdater();
  });

  // ── applyAdaptation dispatch ──────────────────────────────────────

  it('returns null for unknown pattern ids', () => {
    const result = updater.applyAdaptation(makePattern({ id: 'unknown-pattern' }));
    expect(result).toBeNull();
  });

  // ── Qwen thinking trap ───────────────────────────────────────────

  it('applies Qwen simplification with applied: true', () => {
    const pattern = makePattern({ id: 'qwen-thinking-trap' });
    const adaptation = updater.applyAdaptation(pattern);
    expect(adaptation).not.toBeNull();
    expect(adaptation!.applied).toBe(true);
    expect(adaptation!.success).toBe(true);
    expect(adaptation!.patternId).toBe('qwen-thinking-trap');
    expect(adaptation!.fixType).toBe('prompt');
    expect(adaptation!.action).toBe('simplifiedPromptsForQwen');
    // Description should include actionable guidance
    expect(adaptation!.description).toContain('Qwen');
    expect(adaptation!.description.length).toBeGreaterThan(20);
  });

  // ── ASCII timeout ────────────────────────────────────────────────

  it('applies ASCII simplification with applied: true', () => {
    const pattern = makePattern({ id: 'ascii-timeout' });
    const adaptation = updater.applyAdaptation(pattern);
    expect(adaptation).not.toBeNull();
    expect(adaptation!.applied).toBe(true);
    expect(adaptation!.success).toBe(true);
    expect(adaptation!.patternId).toBe('ascii-timeout');
    expect(adaptation!.fixType).toBe('config');
    expect(adaptation!.description).toContain('ASCII');
  });

  // ── GLSL undefined function ──────────────────────────────────────

  it('applies GLSL function definitions with applied: true', () => {
    const pattern = makePattern({ id: 'glsl-undefined-function' });
    const adaptation = updater.applyAdaptation(pattern);
    expect(adaptation).not.toBeNull();
    expect(adaptation!.applied).toBe(true);
    expect(adaptation!.success).toBe(true);
    expect(adaptation!.fixType).toBe('template');
    expect(adaptation!.description).toContain('noise()');
  });

  // ── Tone.js hallucinated API ─────────────────────────────────────

  it('applies Tone.js API whitelist with applied: true', () => {
    const pattern = makePattern({ id: 'tone-hallucinated-api' });
    const adaptation = updater.applyAdaptation(pattern);
    expect(adaptation).not.toBeNull();
    expect(adaptation!.applied).toBe(true);
    expect(adaptation!.success).toBe(true);
    expect(adaptation!.fixType).toBe('template');
    expect(adaptation!.description).toContain('Synth');
  });

  // ── Strudel anti-patterns ────────────────────────────────────────

  it('applies Strudel anti-patterns with applied: true', () => {
    const pattern = makePattern({ id: 'strudel-tidal-confusion' });
    const adaptation = updater.applyAdaptation(pattern);
    expect(adaptation).not.toBeNull();
    expect(adaptation!.applied).toBe(true);
    expect(adaptation!.success).toBe(true);
    expect(adaptation!.fixType).toBe('prompt');
    expect(adaptation!.description).toContain('JavaScript');
  });

  // ── Accumulation across calls ────────────────────────────────────

  it('accumulates adaptations across multiple calls', () => {
    updater.applyAdaptation(makePattern({ id: 'qwen-thinking-trap' }));
    updater.applyAdaptation(makePattern({ id: 'ascii-timeout' }));
    expect(updater.getAdaptations()).toHaveLength(2);
    expect(updater.getAdaptations().map(a => a.patternId)).toEqual([
      'qwen-thinking-trap',
      'ascii-timeout',
    ]);
  });

  // ── All adaptations have required fields ──────────────────────────

  it('all adaptations have appliedAt timestamps', () => {
    const patterns = [
      'qwen-thinking-trap',
      'ascii-timeout',
      'glsl-undefined-function',
      'tone-hallucinated-api',
      'strudel-tidal-confusion',
    ];
    for (const id of patterns) {
      const adaptation = updater.applyAdaptation(makePattern({ id }));
      expect(adaptation!.appliedAt).toBeTruthy();
      expect(new Date(adaptation!.appliedAt!).getTime()).not.toBeNaN();
    }
  });

  // ── Report generation ─────────────────────────────────────────────

  it('generateReport includes pattern names after adaptations', () => {
    updater.applyAdaptation(makePattern({ id: 'qwen-thinking-trap' }));
    const report = updater.generateReport();
    expect(report).toContain('Meta-Harness Report');
    expect(report).toContain('simplifiedPromptsForQwen');
  });

  it('generateReport shows no patterns when empty', () => {
    const report = updater.generateReport();
    expect(report).toContain('No patterns detected yet');
  });
});
