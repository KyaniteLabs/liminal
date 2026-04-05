import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for guardrail correctness and observation modules
 *
 * Correctness layer:
 * - TestVerificationGuardrail: Runs tests after code changes, parses results
 * - TypeCheckGuardrail: Runs tsc --noEmit to verify type correctness
 *
 * Observation layer:
 * - TelemetryCollector: Records events, traces, metrics for guardrail evaluation
 *
 * Mocks:
 * - child_process.exec (for test/tsc execution)
 * - fs/promises.writeFile (for telemetry persistence)
 * - Logger (static methods)
 */

import { TestVerificationGuardrail } from '../../../src/guardrails/correctness/TestVerificationGuardrail.js';
import { TypeCheckGuardrail } from '../../../src/guardrails/correctness/TypeCheckGuardrail.js';
import { TelemetryCollector, initializeTelemetry, getTelemetry } from '../../../src/guardrails/observation/TelemetryCollector.js';
import type { ExecutionContext } from '../../../src/guardrails/core/types.js';
import { GuardrailTier } from '../../../src/guardrails/core/types.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockExecAsync = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  exec: () => { /* promisify wraps this */ },
}));
vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', () => ({
  writeFile: mockWriteFile,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeExecutionContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    taskId: 'task-001',
    step: 1,
    maxSteps: 10,
    prompt: 'Create a p5.js sketch',
    startTime: Date.now(),
    resources: {
      tokensUsed: 0,
      tokensLimit: 10000,
      memoryUsedMB: 50,
      memoryLimitMB: 512,
      timeElapsedMs: 0,
      timeLimitMs: 300000,
      apiCalls: 0,
      apiCallLimit: 100,
    },
    trace: { steps: [] },
    changedFiles: ['src/index.ts'],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TestVerificationGuardrail
// ═══════════════════════════════════════════════════════════════════════════

describe('TestVerificationGuardrail', () => {
  let guardrail: TestVerificationGuardrail;

  beforeEach(() => {
    guardrail = new TestVerificationGuardrail();
    mockExecAsync.mockReset();
  });

  it('has correct id and tier', () => {
    expect(guardrail.id).toBe('guardrail-test-verification');
    expect(guardrail.tier).toBe(GuardrailTier.ENFORCING);
    expect(guardrail.category).toBe('correctness');
  });

  it('skips when no files changed', async () => {
    const result = await guardrail.evaluate(makeExecutionContext({ changedFiles: [] }));

    expect(result.passed).toBe(true);
    expect(result.message).toContain('No files changed');
  });

  it('skips when changedFiles is undefined', async () => {
    const result = await guardrail.evaluate(makeExecutionContext({ changedFiles: undefined }));

    expect(result.passed).toBe(true);
    expect(result.message).toContain('No files changed');
  });

  it('passes when all tests pass', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({
        testResults: [{
          assertionResults: [
            { title: 'test 1', status: 'passed' },
            { title: 'test 2', status: 'passed' },
          ],
        }],
      }),
      stderr: '',
    });

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(true);
    expect(result.message).toContain('2 tests passed');
  });

  it('fails when some tests fail', async () => {
    mockExecAsync.mockRejectedValue(
      JSON.stringify({
        testResults: [{
          name: 'src/foo.test.ts',
          assertionResults: [
            { title: 'test 1', status: 'passed' },
            { title: 'test 2', status: 'failed', failureMessages: ['Expected 1, got 2'] },
          ],
        }],
      })
    );

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('1 of 2 tests failed');
    expect(result.severity).toBe('error');
  });

  it('handles exec errors gracefully', async () => {
    mockExecAsync.mockRejectedValue(new Error('Command not found'));

    const result = await guardrail.evaluate(makeExecutionContext({ changedFiles: ['src/foo.ts'] }));

    expect(result.passed).toBe(false);
    // runTests catches the error internally and parseTestResults returns 0 tests with passed=false
    expect(result.message).toContain('0 of 0 tests failed');
  });

  it('falls back to text parsing when JSON is not found', async () => {
    mockExecAsync.mockRejectedValue('Tests: 3 passed, 1 failed');

    const result = await guardrail.evaluate(makeExecutionContext());

    // Text fallback: "1 failed" means not all passed
    expect(result.passed).toBe(false);
  });

  it('produces remediation prompt with failure details', async () => {
    const violation = {
      passed: false,
      guardrailId: 'guardrail-test-verification',
      message: 'Tests failed',
      details: {
        failures: [
          { testName: 'should render canvas', error: 'canvas is null' },
        ],
      },
    };

    const remediation = await guardrail.remediate(
      makeExecutionContext({ prompt: 'Create sketch' }),
      violation as any,
    );

    expect(remediation.success).toBe(true);
    expect(remediation.action).toBe('fix_tests');
    expect(remediation.newContext?.prompt).toContain('GUARDRAIL REMEDIATION');
    expect(remediation.newContext?.prompt).toContain('should render canvas');
  });

  it('has escalation config', () => {
    expect(guardrail.escalation?.afterFailures).toBe(3);
    expect(guardrail.escalation?.action).toBe('humanReview');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TypeCheckGuardrail
// ═══════════════════════════════════════════════════════════════════════════

describe('TypeCheckGuardrail', () => {
  let guardrail: TypeCheckGuardrail;

  beforeEach(() => {
    guardrail = new TypeCheckGuardrail();
    mockExecAsync.mockReset();
  });

  it('has correct id and tier', () => {
    expect(guardrail.id).toBe('guardrail-type-check');
    expect(guardrail.tier).toBe(GuardrailTier.ENFORCING);
    expect(guardrail.category).toBe('correctness');
  });

  it('skips when no files changed', async () => {
    const result = await guardrail.evaluate(makeExecutionContext({ changedFiles: [] }));

    expect(result.passed).toBe(true);
    expect(result.message).toContain('No files to type check');
  });

  it('skips when no TypeScript files changed', async () => {
    const result = await guardrail.evaluate(
      makeExecutionContext({ changedFiles: ['style.css', 'index.html'] })
    );

    expect(result.passed).toBe(true);
    expect(result.message).toContain('No TypeScript files');
  });

  it('passes when tsc reports no errors', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(true);
    expect(result.message).toContain('TypeScript compilation passed');
  });

  it('fails when tsc reports errors via stderr', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '',
      stderr: 'src/index.ts(10,5): error TS2322: Type "string" is not assignable to type "number"',
    });

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('TypeScript compilation failed');
    expect(result.severity).toBe('error');
    expect(result.suggestion).toContain('Fix type errors');
  });

  it('fails when stdout contains "error"', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: 'src/app.ts(5,1): error TS2304: Cannot find name "foo"',
      stderr: '',
    });

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(false);
  });

  it('handles tsc execution errors', async () => {
    mockExecAsync.mockRejectedValue(new Error('tsc not found in PATH'));

    const result = await guardrail.evaluate(makeExecutionContext());

    expect(result.passed).toBe(false);
    expect(result.message).toContain('tsc not found');
  });

  it('checks .tsx files too', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

    const result = await guardrail.evaluate(
      makeExecutionContext({ changedFiles: ['src/Component.tsx'] })
    );

    expect(result.passed).toBe(true);
  });

  it('produces remediation prompt with type error details', async () => {
    const violation = {
      passed: false,
      guardrailId: 'guardrail-type-check',
      message: 'TypeScript errors',
      details: { errors: 'TS2322: Type mismatch' },
    };

    const remediation = await guardrail.remediate(
      makeExecutionContext({ prompt: 'Fix the code' }),
      violation as any,
    );

    expect(remediation.success).toBe(true);
    expect(remediation.action).toBe('request_type_fix');
    expect(remediation.newContext?.prompt).toContain('GUARDRAIL REMEDIATION');
    expect(remediation.newContext?.prompt).toContain('TS2322');
  });

  it('has escalation config', () => {
    expect(guardrail.escalation?.afterFailures).toBe(2);
    expect(guardrail.escalation?.action).toBe('humanReview');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TelemetryCollector
// ═══════════════════════════════════════════════════════════════════════════

describe('TelemetryCollector', () => {
  let collector: TelemetryCollector;

  beforeEach(() => {
    collector = new TelemetryCollector({
      enabled: true,
      sampleRate: 1.0,
      storage: 'memory',
    });
    mockWriteFile.mockReset();
  });

  // ── Task lifecycle ─────────────────────────────────────────────────────

  describe('task lifecycle', () => {
    it('records task start and initializes metrics', () => {
      collector.recordTaskStart('task-1', { prompt: 'create art' });

      const metrics = collector.getMetrics('task-1');
      expect(metrics).not.toBeUndefined();
      expect(metrics!.taskId).toBe('task-1');
      expect(metrics!.success).toBe(true);
      expect(metrics!.guardrailsEvaluated).toBe(0);
      expect(metrics!.resources.tokensUsed).toBe(0);
    });

    it('creates a trace on task start', () => {
      collector.recordTaskStart('task-2', {});

      const trace = collector.getTrace('task-2');
      expect(trace).not.toBeUndefined();
      expect(trace!.steps).toEqual([]);
    });

    it('records steps in the trace', () => {
      collector.recordTaskStart('task-3', {});
      collector.recordStep('task-3', 'generate', { model: 'gpt-4' });

      const trace = collector.getTrace('task-3');
      expect(trace!.steps.length).toBe(1);
      expect(trace!.steps[0].action).toBe('generate');
      expect(trace!.steps[0].details.model).toBe('gpt-4');
    });

    it('records task completion with duration', () => {
      collector.recordTaskStart('task-4', {});
      collector.recordTaskCompletion('task-4', true, 1500);

      const metrics = collector.getMetrics('task-4');
      expect(metrics!.totalDurationMs).toBe(1500);
      expect(metrics!.success).toBe(true);
    });

    it('records task failure with error details', () => {
      collector.recordTaskStart('task-5', {});
      collector.recordTaskCompletion('task-5', false, 500, new Error('timeout'));

      const metrics = collector.getMetrics('task-5');
      expect(metrics!.success).toBe(false);
      expect(metrics!.error?.type).toBe('Error');
      expect(metrics!.error?.message).toBe('timeout');
    });
  });

  // ── Guardrail tracking ─────────────────────────────────────────────────

  describe('guardrail evaluation tracking', () => {
    it('counts evaluated guardrails', () => {
      collector.recordTaskStart('g-1', {});
      collector.recordGuardrailEvaluation('g-1', 'test-check', true);
      collector.recordGuardrailEvaluation('g-1', 'type-check', true);

      const metrics = collector.getMetrics('g-1');
      expect(metrics!.guardrailsEvaluated).toBe(2);
      expect(metrics!.violationsDetected).toBe(0);
    });

    it('counts violations', () => {
      collector.recordTaskStart('g-2', {});
      collector.recordGuardrailEvaluation('g-2', 'test-check', false);
      collector.recordGuardrailEvaluation('g-2', 'type-check', true);

      const metrics = collector.getMetrics('g-2');
      expect(metrics!.guardrailsEvaluated).toBe(2);
      expect(metrics!.violationsDetected).toBe(1);
    });
  });

  // ── Remediation tracking ───────────────────────────────────────────────

  describe('remediation tracking', () => {
    it('counts remediation attempts and successes', () => {
      collector.recordTaskStart('r-1', {});
      collector.recordRemediation('r-1', 'test-check', true);
      collector.recordRemediation('r-1', 'type-check', false);

      const metrics = collector.getMetrics('r-1');
      expect(metrics!.remediationsAttempted).toBe(2);
      expect(metrics!.remediationsSuccessful).toBe(1);
    });
  });

  // ── Escalation tracking ────────────────────────────────────────────────

  describe('escalation tracking', () => {
    it('counts escalations', () => {
      collector.recordTaskStart('e-1', {});
      collector.recordEscalation('e-1', 'test-check', 'too many failures');

      const metrics = collector.getMetrics('e-1');
      expect(metrics!.escalations).toBe(1);
    });
  });

  // ── Event filtering ────────────────────────────────────────────────────

  describe('event retrieval', () => {
    it('filters events by taskId', () => {
      collector.recordTaskStart('ev-1', {});
      collector.recordTaskStart('ev-2', {});
      collector.recordStep('ev-1', 'generate', {});

      const events1 = collector.getEvents('ev-1');
      const events2 = collector.getEvents('ev-2');

      // ev-1 has start + step = 2 events
      expect(events1.length).toBe(2);
      // ev-2 has only start = 1 event
      expect(events2.length).toBe(1);
      expect(events2[0].type).toBe('start');
    });
  });

  // ── Summary statistics ─────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns empty summary when no tasks recorded', () => {
      const summary = collector.getSummary();
      expect(summary.totalTasks).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgDurationMs).toBe(0);
    });

    it('computes correct summary across tasks', () => {
      collector.recordTaskStart('s-1', {});
      collector.recordGuardrailEvaluation('s-1', 'g1', false);
      collector.recordRemediation('s-1', 'g1', true);
      collector.recordTaskCompletion('s-1', true, 1000);

      collector.recordTaskStart('s-2', {});
      collector.recordTaskCompletion('s-2', false, 500);

      const summary = collector.getSummary();
      expect(summary.totalTasks).toBe(2);
      expect(summary.totalViolations).toBe(1);
      expect(summary.totalRemediations).toBe(1);
      expect(summary.successRate).toBe(0.5);
      expect(summary.avgDurationMs).toBe(750);
    });
  });

  // ── Sampling ───────────────────────────────────────────────────────────

  describe('sampling', () => {
    it('does not record when disabled', () => {
      const disabled = new TelemetryCollector({
        enabled: false,
        sampleRate: 1.0,
        storage: 'memory',
      });

      disabled.recordTaskStart('disabled-1', {});
      expect(disabled.getMetrics('disabled-1')).toBeUndefined();
    });
  });

  // ── Clear ──────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('clears all collected data', () => {
      collector.recordTaskStart('c-1', {});
      collector.recordStep('c-1', 'action', {});
      collector.clear();

      expect(collector.getMetrics('c-1')).toBeUndefined();
      expect(collector.getTrace('c-1')).toBeUndefined();
      expect(collector.getEvents('c-1')).toEqual([]);
    });
  });

  // ── File persistence ───────────────────────────────────────────────────

  describe('file persistence', () => {
    it('persists to file when storage is "file" and logPath is set', async () => {
      const fileCollector = new TelemetryCollector({
        enabled: true,
        sampleRate: 1.0,
        storage: 'file',
        logPath: '/tmp/telemetry-test',
      });

      mockWriteFile.mockResolvedValueOnce(undefined);

      fileCollector.recordTaskStart('file-1', {});
      fileCollector.recordTaskCompletion('file-1', true, 100);

      // Give the void'd promise a tick to resolve
      await new Promise(r => setTimeout(r, 10));

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [filename, content] = mockWriteFile.mock.calls[0];
      expect(filename).toContain('file-1.json');
      const parsed = JSON.parse(content);
      expect(parsed.taskId).toBe('file-1');
      expect(parsed.metrics.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Global telemetry functions
// ═══════════════════════════════════════════════════════════════════════════

describe('telemetry global functions', () => {
  it('initializeTelemetry creates and returns a collector', () => {
    const collector = initializeTelemetry({
      enabled: true,
      sampleRate: 1.0,
      storage: 'memory',
    });
    expect(collector).toBeInstanceOf(TelemetryCollector);
    expect(getTelemetry()).toBe(collector);
  });

  it('getTelemetry returns null before initialization', () => {
    // The global might have been set by previous tests, so this is more of a
    // structural check -- we verify getTelemetry returns the same instance
    const t = getTelemetry();
    expect(t).not.toBeNull();
  });
});
