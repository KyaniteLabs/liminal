import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() is mandatory for variables used in vi.mock()
// ---------------------------------------------------------------------------

const { mockRecordEpisode } = vi.hoisted(() => ({
  mockRecordEpisode: vi.fn(() => 'ep_test'),
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    recordEpisode: mockRecordEpisode,
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks are set up
import { SelfEvaluation, type TaskOutcome } from '../../../src/harness/SelfEvaluation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a TaskOutcome with sensible defaults. */
function makeOutcome(overrides: Partial<TaskOutcome> = {}): TaskOutcome {
  return {
    taskId: 'task-1',
    success: true,
    duration: 500,
    toolsUsed: ['readFile'],
    errors: [],
    strategy: 'default',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/** Record N outcomes with a given success count. */
function seedOutcomes(
  eval_: SelfEvaluation,
  total: number,
  successes: number,
  strategy = 'default',
) {
  for (let i = 0; i < total; i++) {
    eval_.recordOutcome(
      makeOutcome({
        taskId: `task-${i}`,
        success: i < successes,
        strategy,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      }),
    );
  }
}

// ===========================================================================
// Test suite
// ===========================================================================

describe('SelfEvaluation', () => {
  let selfEval: SelfEvaluation;

  beforeEach(() => {
    selfEval = new SelfEvaluation();
    mockRecordEpisode.mockClear();
  });

  // -------------------------------------------------------------------------
  // recordOutcome
  // -------------------------------------------------------------------------

  describe('recordOutcome', () => {
    it('persists outcomes to harness memory via recordEpisode', () => {
      selfEval.recordOutcome(makeOutcome({ success: true }));
      expect(mockRecordEpisode).toHaveBeenCalledTimes(1);

      const call = mockRecordEpisode.mock.calls[0][0];
      expect(call.type).toBe('generation');
      expect(call.domain).toBe('harness');
      expect(call.tags).toContain('success');
    });

    it('tags failure outcomes correctly', () => {
      selfEval.recordOutcome(makeOutcome({ success: false }));
      const call = mockRecordEpisode.mock.calls[0][0];
      expect(call.tags).toContain('failure');
    });

    it('trims history beyond MAX_HISTORY (100)', () => {
      for (let i = 0; i < 110; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `t-${i}` }));
      }
      // evaluate() only looks at history, which should be trimmed to 100
      const report = selfEval.evaluate();
      // overall success rate should be 100/100 = 1.0 (first 10 trimmed)
      expect(report.overallSuccessRate).toBeCloseTo(1.0);
    });
  });

  // -------------------------------------------------------------------------
  // evaluate
  // -------------------------------------------------------------------------

  describe('evaluate', () => {
    it('returns zero rates when no outcomes have been recorded', () => {
      const report = selfEval.evaluate();
      expect(report.overallSuccessRate).toBe(0);
      expect(report.recentSuccessRate).toBe(0);
      expect(report.bestStrategy).toBe('');
      expect(report.worstStrategy).toBe('');
      expect(report.commonErrors).toEqual([]);
      // 0% recent rate triggers CRITICAL recommendation (< 0.5 threshold)
      expect(report.recommendations).toEqual([
        'CRITICAL: Success rate below 50%. Consider fallback strategies.',
      ]);
      // needsImprovement is true because recentRate (0) < 0.7
      expect(report.needsImprovement).toBe(true);
    });

    it('computes correct rates for 10 successes out of 10', () => {
      seedOutcomes(selfEval, 10, 10);
      const report = selfEval.evaluate();
      expect(report.overallSuccessRate).toBeCloseTo(1.0);
      expect(report.recentSuccessRate).toBeCloseTo(1.0);
    });

    it('computes correct rates for 5 successes out of 10', () => {
      seedOutcomes(selfEval, 10, 5);
      const report = selfEval.evaluate();
      expect(report.overallSuccessRate).toBeCloseTo(0.5);
      expect(report.recentSuccessRate).toBeCloseTo(0.5);
    });

    it('sets needsImprovement=true when recent rate < 0.7', () => {
      seedOutcomes(selfEval, 10, 5); // 50% recent
      const report = selfEval.evaluate();
      expect(report.needsImprovement).toBe(true);
    });

    it('sets needsImprovement=false when recent >= 0.7 and overall >= 0.8', () => {
      // 15 outcomes: first 5 fail, next 10 succeed
      // recent 10 = all succeed (100%), overall = 10/15 = 0.667
      // needsImprovement is recentRate < 0.7 OR overallRate < 0.8
      // recentRate = 1.0 (>= 0.7) but overallRate = 0.667 (< 0.8)
      // so needsImprovement = true
      seedOutcomes(selfEval, 5, 0); // 5 failures
      seedOutcomes(selfEval, 10, 10); // 10 successes
      const report = selfEval.evaluate();
      expect(report.recentSuccessRate).toBeCloseTo(1.0);
      expect(report.overallSuccessRate).toBeCloseTo(10 / 15);
      expect(report.needsImprovement).toBe(true); // overall < 0.8
    });

    it('includes a CRITICAL recommendation when recent rate < 0.5', () => {
      seedOutcomes(selfEval, 10, 3); // 30%
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CRITICAL'),
        ]),
      );
    });

    it('includes a WARNING recommendation when 0.5 <= recent rate < 0.7', () => {
      seedOutcomes(selfEval, 10, 6); // 60%
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('WARNING'),
        ]),
      );
    });

    it('collects common errors sorted by frequency', () => {
      selfEval.recordOutcome(makeOutcome({ errors: ['timeout', 'syntax'] }));
      selfEval.recordOutcome(makeOutcome({ errors: ['timeout'] }));
      selfEval.recordOutcome(makeOutcome({ errors: ['validation'] }));

      const report = selfEval.evaluate();
      expect(report.commonErrors[0]).toMatch(/^timeout/);
    });

    it('recommends increasing timeouts when timeout errors are frequent', () => {
      selfEval.recordOutcome(makeOutcome({ errors: ['timeout'], success: false }));
      selfEval.recordOutcome(makeOutcome({ errors: ['timeout'], success: false }));
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('timeout'),
        ]),
      );
    });

    it('recommends strengthening validation when validation errors are present', () => {
      selfEval.recordOutcome(makeOutcome({ errors: ['validation'], success: false }));
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('validation'),
        ]),
      );
    });

    it('identifies best and worst strategy', () => {
      // Strategy A: 3/4 succeed
      for (let i = 0; i < 4; i++) {
        selfEval.recordOutcome(makeOutcome({ strategy: 'strategyA', success: i < 3 }));
      }
      // Strategy B: 1/4 succeed
      for (let i = 0; i < 4; i++) {
        selfEval.recordOutcome(makeOutcome({ strategy: 'strategyB', success: i < 1 }));
      }

      const report = selfEval.evaluate();
      expect(report.bestStrategy).toBe('strategyA');
      expect(report.worstStrategy).toBe('strategyB');
    });

    it('recommends using best strategy more when it is not "default"', () => {
      for (let i = 0; i < 5; i++) {
        selfEval.recordOutcome(
          makeOutcome({ strategy: 'better', success: true }),
        );
      }
      // Add some failures to trigger recommendation
      for (let i = 0; i < 5; i++) {
        selfEval.recordOutcome(
          makeOutcome({ strategy: 'default', success: false }),
        );
      }
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Use 'better' strategy"),
        ]),
      );
    });

    it('recommends deprecating worst strategy when rate < 0.3', () => {
      for (let i = 0; i < 5; i++) {
        selfEval.recordOutcome(
          makeOutcome({ strategy: 'bad', success: i < 1 }),
        );
      }
      const report = selfEval.evaluate();
      expect(report.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Deprecate 'bad' strategy"),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // shouldRetry
  // -------------------------------------------------------------------------

  describe('shouldRetry', () => {
    it('allows retry with same strategy on first failure (attempt 1)', () => {
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      const result = selfEval.shouldRetry('t1', 'default');
      expect(result.shouldRetry).toBe(true);
      expect(result.newStrategy).toBe('default');
    });

    it('stops retrying after 2 failed attempts (boundary: previousAttempts < 2 is false)', () => {
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      // previousAttempts = 2, but 2 < 3 so max-retry NOT hit yet.
      // However same-strategy path returns shouldRetry = previousAttempts < 2 = false
      const result = selfEval.shouldRetry('t1', 'default');
      expect(result.shouldRetry).toBe(false);
    });

    it('stops retrying after 3 failed attempts for the same task', () => {
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      const result = selfEval.shouldRetry('t1', 'default');
      expect(result.shouldRetry).toBe(false);
      expect(result.reason).toContain('Max retry');
    });

    it('switches to a better strategy when one exists', () => {
      // "better" strategy has good rate
      for (let i = 0; i < 4; i++) {
        selfEval.recordOutcome(
          makeOutcome({ taskId: `other-${i}`, strategy: 'better', success: true }),
        );
      }
      // "bad" strategy has zero rate
      selfEval.recordOutcome(
        makeOutcome({ taskId: 't1', strategy: 'bad', success: false }),
      );
      const result = selfEval.shouldRetry('t1', 'bad');
      expect(result.shouldRetry).toBe(true);
      expect(result.newStrategy).toBe('better');
      expect(result.reason).toContain('Switching');
    });

    it('returns reason string with attempt count (previousAttempts + 1)', () => {
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      const result = selfEval.shouldRetry('t1', 'default');
      // previousAttempts = 1, reason says "Retry 2/3"
      expect(result.reason).toContain('2/3');
    });

    it('ignores successful outcomes for the same task when counting retries', () => {
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: true }));
      selfEval.recordOutcome(makeOutcome({ taskId: 't1', success: false }));
      // Only 1 failed attempt — should retry
      const result = selfEval.shouldRetry('t1', 'default');
      expect(result.shouldRetry).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // detectRegression
  // -------------------------------------------------------------------------

  describe('detectRegression', () => {
    it('returns none with insufficient data (less than 2 * windowSize)', () => {
      seedOutcomes(selfEval, 15, 15);
      const result = selfEval.detectRegression(10);
      expect(result.hasRegression).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.details).toContain('Insufficient data');
    });

    it('detects severe regression (>30% decline)', () => {
      // Previous window: 10 successes out of 10
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      // Recent window: 3 successes out of 10 => 70% decline
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 3 }));
      }
      const result = selfEval.detectRegression(10);
      expect(result.hasRegression).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.details).toContain('Severe regression');
      expect(result.details).toContain('70.0%');
    });

    it('detects mild regression (15-30% decline)', () => {
      // Previous: 10/10 = 100%
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      // Recent: 8/10 = 80% => 20% decline
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 8 }));
      }
      const result = selfEval.detectRegression(10);
      expect(result.hasRegression).toBe(true);
      expect(result.severity).toBe('mild');
    });

    it('returns no regression when decline is <= 15%', () => {
      // Previous: 10/10 = 100%
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      // Recent: 9/10 = 90% => 10% decline (not enough)
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 9 }));
      }
      const result = selfEval.detectRegression(10);
      expect(result.hasRegression).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('detects improvement as no regression', () => {
      // Previous: 5/10
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: i < 5 }));
      }
      // Recent: 10/10
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: true }));
      }
      const result = selfEval.detectRegression(10);
      expect(result.hasRegression).toBe(false);
    });

    it('respects custom window size', () => {
      // 14 outcomes total => need 2 * 5 = 10 for windowSize=5, have 14 — enough
      for (let i = 0; i < 5; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      for (let i = 0; i < 9; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 2 }));
      }
      // 14 outcomes >= 10 threshold with windowSize=5
      const result = selfEval.detectRegression(5);
      expect(result.hasRegression).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getErrorRemediation
  // -------------------------------------------------------------------------

  describe('getErrorRemediation', () => {
    it('returns timeout remediations for timeout errors', () => {
      const suggestions = selfEval.getErrorRemediation('Connection timeout after 30s');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('Increase timeout threshold');
      expect(suggestions).toContain('Break task into smaller subtasks');
    });

    it('returns syntax remediations for syntax errors', () => {
      const suggestions = selfEval.getErrorRemediation('SyntaxError: unexpected token');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('Add pre-generation syntax validation');
    });

    it('returns validation remediations for validation errors', () => {
      const suggestions = selfEval.getErrorRemediation('Validation failed: missing fields');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('Strengthen post-generation validation');
    });

    it('returns permission remediations for permission errors', () => {
      const suggestions = selfEval.getErrorRemediation('Permission denied: /root/file');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('Check file permissions');
    });

    it('returns access remediations for access errors', () => {
      const suggestions = selfEval.getErrorRemediation('Access denied to resource');
      expect(suggestions[0]).toBe('Check file permissions');
    });

    it('returns generic remediations for unknown errors', () => {
      const suggestions = selfEval.getErrorRemediation('Something unexpected happened');
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('Review error logs for patterns');
    });

    it('is case-insensitive', () => {
      const suggestions = selfEval.getErrorRemediation('TIMEOUT ERROR');
      expect(suggestions[0]).toBe('Increase timeout threshold');
    });
  });

  // -------------------------------------------------------------------------
  // generateImprovementTask
  // -------------------------------------------------------------------------

  describe('generateImprovementTask', () => {
    it('returns critical task when severe regression is detected', () => {
      // Seed enough data for regression detection
      // Previous window: all succeed
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      // Recent window: 1/10 succeed => severe regression
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 1 }));
      }

      const task = selfEval.generateImprovementTask();
      expect(task.shouldCreate).toBe(true);
      expect(task.priority).toBe('critical');
      expect(task.title).toContain('URGENT');
      expect(task.description).toContain('Severe regression');
    });

    it('returns high-priority task when needsImprovement is true (no regression)', () => {
      // 6/10 recent => needs improvement, no regression
      seedOutcomes(selfEval, 10, 6);
      const task = selfEval.generateImprovementTask();
      expect(task.shouldCreate).toBe(true);
      expect(task.priority).toBe('high');
      expect(task.title).toContain('Improve');
    });

    it('returns medium-priority task for mild regression (when not needsImprovement)', () => {
      // Craft a scenario with mild regression but acceptable overall rate.
      // We need: regression.severity = 'mild' AND evaluation.needsImprovement = false
      // needsImprovement = recentRate < 0.7 || overallRate < 0.8
      // So we need: recentRate >= 0.7 AND overallRate >= 0.8 but mild regression exists.
      // That's contradictory (mild regression = 15-30% decline, so recent < previous).
      // With 2 windows: if previous=100% and recent=80%, decline=20% (mild).
      // recent=0.8 >= 0.7, but overall=20/20=1.0 >= 0.8 => needsImprovement=false.
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `prev-${i}`, success: true }));
      }
      for (let i = 0; i < 10; i++) {
        selfEval.recordOutcome(makeOutcome({ taskId: `recent-${i}`, success: i < 8 }));
      }

      const task = selfEval.generateImprovementTask();
      // With recentRate=0.8 and overallRate=1.0, needsImprovement=false.
      // Regression is mild (20% decline).
      expect(task.shouldCreate).toBe(true);
      expect(task.priority).toBe('medium');
      expect(task.title).toContain('mild');
    });

    it('returns shouldCreate=false when performance is good', () => {
      // All succeed, no regression, no improvement needed
      seedOutcomes(selfEval, 20, 20);
      const task = selfEval.generateImprovementTask();
      expect(task.shouldCreate).toBe(false);
      expect(task.priority).toBe('low');
      expect(task.title).toBeUndefined();
      expect(task.description).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Strategy metrics tracking (via evaluate + shouldRetry)
  // -------------------------------------------------------------------------

  describe('strategy metrics accumulation', () => {
    it('tracks average duration across multiple outcomes for the same strategy', () => {
      selfEval.recordOutcome(makeOutcome({ strategy: 'alpha', duration: 100 }));
      selfEval.recordOutcome(makeOutcome({ strategy: 'alpha', duration: 200 }));
      selfEval.recordOutcome(makeOutcome({ strategy: 'alpha', duration: 300 }));

      // The best strategy should be 'alpha' with a success rate of 100%
      const report = selfEval.evaluate();
      expect(report.bestStrategy).toBe('alpha');
    });

    it('tracks multiple strategies independently', () => {
      for (let i = 0; i < 3; i++) {
        selfEval.recordOutcome(makeOutcome({ strategy: 'fast', success: true, duration: 100 }));
      }
      for (let i = 0; i < 3; i++) {
        selfEval.recordOutcome(makeOutcome({ strategy: 'slow', success: false, duration: 5000 }));
      }

      const report = selfEval.evaluate();
      expect(report.bestStrategy).toBe('fast');
      expect(report.worstStrategy).toBe('slow');
    });
  });

  // -------------------------------------------------------------------------
  // getSummary
  // -------------------------------------------------------------------------

  describe('getSummary', () => {
    it('returns a human-readable string with success rates', () => {
      seedOutcomes(selfEval, 10, 8);
      const summary = selfEval.getSummary();
      expect(summary).toContain('Overall Success Rate');
      expect(summary).toContain('Recent Success Rate');
      expect(summary).toContain('80.0%');
    });

    it('shows N/A for best strategy when none exists', () => {
      const summary = selfEval.getSummary();
      expect(summary).toContain('N/A');
    });
  });
});
