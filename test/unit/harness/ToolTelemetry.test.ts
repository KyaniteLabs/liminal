import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

// vi.hoisted() for ALL mock variables used in vi.mock() factories
// NOTE: Cannot reference imports inside vi.hoisted — use hardcoded fallback
const { mockHomedir } = vi.hoisted(() => ({
  // Use /tmp as a safe default so the module-level singleton does not crash
  mockHomedir: vi.fn().mockReturnValue('/tmp'),
}));

const { mockLoggerDebug } = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: mockHomedir,
  };
});

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: mockLoggerDebug,
  },
}));

import { ToolTelemetry } from '../../../src/harness/tools/ToolTelemetry.js';
import type { ToolCallRecord, ToolTelemetryAnalysis } from '../../../src/harness/tools/ToolTelemetry.js';

/** Helper to build a ToolResult with sensible defaults */
function makeResult(overrides: { success: boolean; error?: string; data?: unknown } = { success: true }) {
  return overrides;
}

/** Create a temp directory for each test and return its path */
function makeTempDir(): string {
  const dir = join(tmpdir(), `tool-telemetry-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('ToolTelemetry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mockHomedir.mockReturnValue(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates the telemetry directory if it does not exist', () => {
      const newDir = join(tempDir, 'nested', 'tool-telemetry');
      mockHomedir.mockReturnValue(tempDir);
      // Force a directory that does not yet exist
      const tel = new (class extends ToolTelemetry {
        constructor() {
          // @ts-expect-error accessing private
          super();
          // @ts-expect-error overwrite logDir
          (this as any).logDir = newDir;
          // @ts-expect-error calling private
          this.ensureDir();
        }
      })();
      expect(existsSync(newDir)).toBe(true);
    });

    it('uses provided sessionId when given', () => {
      const tel = new ToolTelemetry('my-session-123');
      expect(tel.getSessionId()).toBe('my-session-123');
    });

    it('generates a sessionId when none provided', () => {
      const tel = new ToolTelemetry();
      const sid = tel.getSessionId();
      // Should contain a timestamp and random suffix
      expect(sid).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  // ---------------------------------------------------------------------------
  // log()
  // ---------------------------------------------------------------------------
  describe('log', () => {
    it('returns a ToolCallRecord with all fields populated', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 'readFile',
        params: { path: '/foo.txt' },
        result: makeResult({ success: true }),
        duration: 150,
        reasoning: 'Need to read the file',
        reasoningTraceId: 'trace-abc',
        taskId: 'task-1',
        iteration: 2,
        retryCount: 1,
      });

      expect(record.tool).toBe('readFile');
      expect(record.sessionId).toBe('sess-1');
      expect(record.taskId).toBe('task-1');
      expect(record.success).toBe(true);
      expect(record.duration).toBe(150);
      expect(record.reasoning).toBe('Need to read the file');
      expect(record.reasoningTraceId).toBe('trace-abc');
      expect(record.iteration).toBe(2);
      expect(record.retryCount).toBe(1);
      expect(record.callOrder).toBe(1);
      expect(record.previousTool).toBeUndefined();
      expect(record.errorCategory).toBeUndefined();
    });

    it('sets callOrder incrementally across calls', () => {
      const tel = new ToolTelemetry('sess-1');
      const r1 = tel.log({ tool: 'a', params: {}, result: makeResult({ success: true }), duration: 10 });
      const r2 = tel.log({ tool: 'b', params: {}, result: makeResult({ success: true }), duration: 20 });
      const r3 = tel.log({ tool: 'c', params: {}, result: makeResult({ success: true }), duration: 30 });

      expect(r1.callOrder).toBe(1);
      expect(r2.callOrder).toBe(2);
      expect(r3.callOrder).toBe(3);
    });

    it('sets previousTool to the last tool called', () => {
      const tel = new ToolTelemetry('sess-1');
      tel.log({ tool: 'alpha', params: {}, result: makeResult({ success: true }), duration: 10 });
      const r2 = tel.log({ tool: 'beta', params: {}, result: makeResult({ success: true }), duration: 20 });

      expect(r2.previousTool).toBe('alpha');
    });

    it('does not set previousTool on the first call', () => {
      const tel = new ToolTelemetry('sess-1');
      const r = tel.log({ tool: 'first', params: {}, result: makeResult({ success: true }), duration: 10 });
      expect(r.previousTool).toBeUndefined();
    });

    it('sets errorCategory when result has an error', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 'writeFile',
        params: {},
        result: makeResult({ success: false, error: 'ENOENT: no such file or directory' }),
        duration: 50,
      });
      expect(record.errorCategory).toBe('file_not_found');
    });

    it('sets errorCategory to unknown for unrecognized errors', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 'foo',
        params: {},
        result: makeResult({ success: false, error: 'something completely unrecognizable' }),
        duration: 50,
      });
      expect(record.errorCategory).toBe('unknown');
    });

    it('defaults retryCount to 0 when not provided', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 'read',
        params: {},
        result: makeResult({ success: true }),
        duration: 10,
      });
      expect(record.retryCount).toBe(0);
    });

    it('writes a JSON file to the log directory', () => {
      const tel = new ToolTelemetry('sess-1');
      tel.log({ tool: 'read', params: { x: 1 }, result: makeResult({ success: true }), duration: 5 });

      const files = readdirSync(join(tempDir, '.liminal', 'tool-telemetry')).filter(f => f.endsWith('.json'));
      expect(files.length).toBe(1);

      const parsed = JSON.parse(readFileSync(join(tempDir, '.liminal', 'tool-telemetry', files[0]), 'utf-8'));
      expect(parsed.tool).toBe('read');
    });
  });

  // ---------------------------------------------------------------------------
  // sanitizeParams (tested indirectly through log)
  // ---------------------------------------------------------------------------
  describe('sanitizeParams (via log)', () => {
    it('passes through non-object params unchanged', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({ tool: 't', params: 'string-param', result: makeResult({ success: true }), duration: 1 });
      expect(record.params).toBe('string-param');
    });

    it('passes through null params unchanged', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({ tool: 't', params: null, result: makeResult({ success: true }), duration: 1 });
      expect(record.params).toBeNull();
    });

    it('passes through number params unchanged', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({ tool: 't', params: 42, result: makeResult({ success: true }), duration: 1 });
      expect(record.params).toBe(42);
    });

    it('passes through short string values unchanged', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 't',
        params: { key: 'short value' },
        result: makeResult({ success: true }),
        duration: 1,
      });
      expect((record.params as Record<string, unknown>).key).toBe('short value');
    });

    it('truncates string values longer than 500 characters', () => {
      const tel = new ToolTelemetry('sess-1');
      const longStr = 'x'.repeat(600);
      const record = tel.log({
        tool: 't',
        params: { content: longStr },
        result: makeResult({ success: true }),
        duration: 1,
      });
      const sanitized = (record.params as Record<string, unknown>).content as string;
      expect(sanitized).toBe('x'.repeat(500) + '... [truncated]');
      expect(sanitized.length).toBe(515);
    });

    it('passes through non-string values in object params unchanged', () => {
      const tel = new ToolTelemetry('sess-1');
      const record = tel.log({
        tool: 't',
        params: { count: 7, flag: true, nested: { a: 1 } },
        result: makeResult({ success: true }),
        duration: 1,
      });
      const p = record.params as Record<string, unknown>;
      expect(p.count).toBe(7);
      expect(p.flag).toBe(true);
      expect(p.nested).toEqual({ a: 1 });
    });
  });

  // ---------------------------------------------------------------------------
  // categorizeError (tested indirectly through log)
  // ---------------------------------------------------------------------------
  describe('categorizeError (via log)', () => {
    const errorCases: Array<{ error: string; expected: string }> = [
      { error: 'ENOENT: no such file', expected: 'file_not_found' },
      { error: 'not found in registry', expected: 'file_not_found' },
      { error: 'No such file or directory', expected: 'file_not_found' },
      { error: 'EACCES: permission denied', expected: 'permission_error' },
      { error: 'Access denied for resource', expected: 'permission_error' },
      { error: 'unexpected token }', expected: 'syntax_error' },
      { error: 'parse error at line 5', expected: 'syntax_error' },
      { error: 'SyntaxError: invalid', expected: 'syntax_error' },
      { error: 'ETIMEDOUT: connection timed out', expected: 'timeout' },
      { error: 'Request timed out after 30s', expected: 'timeout' },
      { error: 'rate limit exceeded', expected: 'rate_limited' },
      { error: 'Too many requests', expected: 'rate_limited' },
      { error: 'validation failed: invalid input', expected: 'validation_error' },
      { error: 'malformed request body', expected: 'validation_error' },
      { error: 'tsc failed: build compilation error', expected: 'build_error' },
      { error: 'build failed at step 3', expected: 'build_error' },
      { error: 'test assertion failed: expected 5', expected: 'test_failure' },
      { error: 'Expect(1).toBe(2)', expected: 'test_failure' },
    ];

    for (const { error, expected } of errorCases) {
      it(`categorizes "${error.substring(0, 40)}..." as ${expected}`, () => {
        const tel = new ToolTelemetry('sess-1');
        const record = tel.log({
          tool: 't',
          params: {},
          result: makeResult({ success: false, error }),
          duration: 1,
        });
        expect(record.errorCategory).toBe(expected);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // getSessionCalls()
  // ---------------------------------------------------------------------------
  describe('getSessionCalls', () => {
    it('returns empty array when no log files exist', () => {
      const tel = new ToolTelemetry('no-session');
      // Point to a dir that does not exist
      const dir = join(tempDir, 'nonexistent-dir');
      (tel as any).logDir = dir;
      const calls = tel.getSessionCalls();
      expect(calls).toEqual([]);
    });

    it('returns calls filtered to current sessionId sorted by callOrder', () => {
      const telA = new ToolTelemetry('session-a');
      const telB = new ToolTelemetry('session-b');

      telA.log({ tool: 'a1', params: {}, result: makeResult({ success: true }), duration: 10 });
      telB.log({ tool: 'b1', params: {}, result: makeResult({ success: true }), duration: 20 });
      telA.log({ tool: 'a2', params: {}, result: makeResult({ success: true }), duration: 30 });

      // Both share the same logDir since homedir is mocked to tempDir
      const callsA = telA.getSessionCalls();
      expect(callsA).toHaveLength(2);
      expect(callsA[0].tool).toBe('a1');
      expect(callsA[1].tool).toBe('a2');

      const callsB = telB.getSessionCalls();
      expect(callsB).toHaveLength(1);
      expect(callsB[0].tool).toBe('b1');
    });

    it('skips malformed JSON files and calls Logger.debug', () => {
      const tel = new ToolTelemetry('session-malformed');
      const logDir = (tel as any).logDir as string;
      // Write a corrupted JSON file
      writeFileSync(join(logDir, 'bad.json'), 'not valid json');

      const calls = tel.getSessionCalls();
      expect(calls).toEqual([]);
      expect(mockLoggerDebug).toHaveBeenCalled();
    });

    it('skips files whose sessionId does not match', () => {
      const tel1 = new ToolTelemetry('session-x');
      const tel2 = new ToolTelemetry('session-y');
      tel1.log({ tool: 'x', params: {}, result: makeResult({ success: true }), duration: 1 });
      tel2.log({ tool: 'y', params: {}, result: makeResult({ success: true }), duration: 1 });

      const calls = tel2.getSessionCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].tool).toBe('y');
    });
  });

  // ---------------------------------------------------------------------------
  // analyze()
  // ---------------------------------------------------------------------------
  describe('analyze', () => {
    it('returns empty analysis when no calls recorded', () => {
      const tel = new ToolTelemetry('empty-session');
      // Clear any files
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) {
          rmSync(join(logDir, f));
        }
      }

      const analysis = tel.analyze();
      expect(analysis.totalCalls).toBe(0);
      expect(analysis.uniqueTools).toBe(0);
      expect(analysis.overallSuccessRate).toBe(0);
      expect(analysis.avgDuration).toBe(0);
      expect(analysis.toolStats).toEqual([]);
      expect(analysis.commonSequences).toEqual([]);
      expect(analysis.insights).toEqual(['No tool calls recorded']);
    });

    it('computes correct tool stats', () => {
      const tel = new ToolTelemetry('stats-session');
      // Clear any leftover files from constructor
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'readFile', params: {}, result: makeResult({ success: true }), duration: 100 });
      tel.log({ tool: 'readFile', params: {}, result: makeResult({ success: false, error: 'ENOENT' }), duration: 200, retryCount: 2 });
      tel.log({ tool: 'writeFile', params: {}, result: makeResult({ success: true }), duration: 300 });

      const analysis = tel.analyze();
      expect(analysis.totalCalls).toBe(3);
      expect(analysis.uniqueTools).toBe(2);
      // 2 success out of 3 = 0.666...
      expect(Math.round(analysis.overallSuccessRate * 100)).toBe(67);
      // (100+200+300)/3 = 200
      expect(analysis.avgDuration).toBe(200);

      const readStats = analysis.toolStats.find(s => s.tool === 'readFile')!;
      expect(readStats.totalCalls).toBe(2);
      expect(readStats.successCount).toBe(1);
      expect(readStats.failureCount).toBe(1);
      expect(readStats.avgDuration).toBe(150);
      expect(readStats.retryRate).toBe(1); // 2 retries / 2 calls

      const writeStats = analysis.toolStats.find(s => s.tool === 'writeFile')!;
      expect(writeStats.totalCalls).toBe(1);
      expect(writeStats.successCount).toBe(1);
      expect(writeStats.failureCount).toBe(0);
    });

    it('computes common errors per tool', () => {
      const tel = new ToolTelemetry('error-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'build', params: {}, result: makeResult({ success: false, error: 'tsc failed: type error' }), duration: 1000 });
      tel.log({ tool: 'build', params: {}, result: makeResult({ success: false, error: 'build compilation error' }), duration: 2000 });
      tel.log({ tool: 'build', params: {}, result: makeResult({ success: false, error: 'syntax error near line 10' }), duration: 500 });

      const analysis = tel.analyze();
      const buildStats = analysis.toolStats[0];
      expect(buildStats.commonErrors.length).toBeGreaterThanOrEqual(1);
      // build_error should be the most common
      expect(buildStats.commonErrors[0].error).toBe('build_error');
      expect(buildStats.commonErrors[0].count).toBe(2);
    });

    it('sorts tool stats by totalCalls descending', () => {
      const tel = new ToolTelemetry('sort-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'rare', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'common', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'common', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'common', params: {}, result: makeResult({ success: true }), duration: 10 });

      const analysis = tel.analyze();
      expect(analysis.toolStats[0].tool).toBe('common');
      expect(analysis.toolStats[0].totalCalls).toBe(3);
      expect(analysis.toolStats[1].tool).toBe('rare');
      expect(analysis.toolStats[1].totalCalls).toBe(1);
    });

    it('detects 2-tool and 3-tool sequences', () => {
      const tel = new ToolTelemetry('seq-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'read', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'edit', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'build', params: {}, result: makeResult({ success: true }), duration: 10 });

      const analysis = tel.analyze();
      // Should find 2-tool sequences: read->edit, edit->build
      // And 3-tool sequence: read->edit->build
      const seqNames = analysis.commonSequences.map(s => s.sequence.join(' -> '));
      expect(seqNames).toContain('read -> edit -> build');
      expect(seqNames).toContain('read -> edit');
      expect(seqNames).toContain('edit -> build');
    });

    it('counts repeated sequences', () => {
      const tel = new ToolTelemetry('repeat-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      // Repeat read->edit 3 times
      for (let i = 0; i < 3; i++) {
        tel.log({ tool: 'read', params: {}, result: makeResult({ success: true }), duration: 10 });
        tel.log({ tool: 'edit', params: {}, result: makeResult({ success: true }), duration: 10 });
      }

      const analysis = tel.analyze();
      const readEditSeq = analysis.commonSequences.find(s => s.sequence.join(' -> ') === 'read -> edit');
      expect(readEditSeq).toBeTruthy();
      expect(readEditSeq!.count).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // generateInsights (tested indirectly through analyze)
  // ---------------------------------------------------------------------------
  describe('generateInsights (via analyze)', () => {
    it('reports high failure rate tools', () => {
      const tel = new ToolTelemetry('fail-insight');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      // 4 failures out of 5 = 80% failure rate (> 30%)
      tel.log({ tool: 'flaky', params: {}, result: makeResult({ success: true }), duration: 10 });
      for (let i = 0; i < 4; i++) {
        tel.log({ tool: 'flaky', params: {}, result: makeResult({ success: false, error: `error ${i}` }), duration: 10 });
      }

      const analysis = tel.analyze();
      const insight = analysis.insights.find(i => i.includes('flaky') && i.includes('high failure rate'));
      expect(insight).toBeTruthy();
      expect(insight).toContain('80%');
    });

    it('reports slow tools', () => {
      const tel = new ToolTelemetry('slow-insight');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      // avgDuration > 10000 ms
      tel.log({ tool: 'slowTool', params: {}, result: makeResult({ success: true }), duration: 15000 });

      const analysis = tel.analyze();
      const insight = analysis.insights.find(i => i.includes('slowTool') && i.includes('slow'));
      expect(insight).toBeTruthy();
      expect(insight).toContain('15.0s');
    });

    it('reports high retry rate tools', () => {
      const tel = new ToolTelemetry('retry-insight');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      // retryRate > 0.2: 2 retries / 1 call = 2.0
      tel.log({ tool: 'retryTool', params: {}, result: makeResult({ success: true }), duration: 10, retryCount: 3 });

      const analysis = tel.analyze();
      const insight = analysis.insights.find(i => i.includes('retryTool') && i.includes('retry rate'));
      expect(insight).toBeTruthy();
    });

    it('reports most common sequence', () => {
      const tel = new ToolTelemetry('seq-insight');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'a', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'b', params: {}, result: makeResult({ success: true }), duration: 10 });

      const analysis = tel.analyze();
      const insight = analysis.insights.find(i => i.includes('Most common sequence'));
      expect(insight).toBeTruthy();
      expect(insight).toContain('a');
      expect(insight).toContain('b');
    });

    it('reports common errors per tool', () => {
      const tel = new ToolTelemetry('err-insight');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 't', params: {}, result: makeResult({ success: false, error: 'ENOENT: no such file' }), duration: 10 });

      const analysis = tel.analyze();
      const insight = analysis.insights.find(i => i.includes('commonly fails with'));
      expect(insight).toBeTruthy();
      expect(insight).toContain('file_not_found');
    });

    it('does not report insights for healthy tools', () => {
      const tel = new ToolTelemetry('healthy-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      // Healthy: success, fast, no retries
      tel.log({ tool: 'good', params: {}, result: makeResult({ success: true }), duration: 50 });

      const analysis = tel.analyze();
      // Should NOT contain failure, slow, or retry insights for 'good'
      const badInsights = analysis.insights.filter(i =>
        (i.includes('high failure rate') || i.includes('is slow') || i.includes('retry rate')) && i.includes('good'),
      );
      expect(badInsights).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getCallsWithReasoning()
  // ---------------------------------------------------------------------------
  describe('getCallsWithReasoning', () => {
    it('returns only calls with reasoning or reasoningTraceId', () => {
      const tel = new ToolTelemetry('reason-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'a', params: {}, result: makeResult({ success: true }), duration: 10, reasoning: 'because' });
      tel.log({ tool: 'b', params: {}, result: makeResult({ success: true }), duration: 10, reasoningTraceId: 'trace-1' });
      tel.log({ tool: 'c', params: {}, result: makeResult({ success: true }), duration: 10 });

      const calls = tel.getCallsWithReasoning();
      expect(calls).toHaveLength(2);
      expect(calls.map(c => c.tool).sort()).toEqual(['a', 'b']);
    });

    it('returns empty array when no calls have reasoning', () => {
      const tel = new ToolTelemetry('no-reason-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'x', params: {}, result: makeResult({ success: true }), duration: 10 });
      expect(tel.getCallsWithReasoning()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // correlateWithReasoning()
  // ---------------------------------------------------------------------------
  describe('correlateWithReasoning', () => {
    it('returns calls whose reasoning contains any of the given patterns', () => {
      const tel = new ToolTelemetry('corr-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'a', params: {}, result: makeResult({ success: true }), duration: 10, reasoning: 'Need to check the file system' });
      tel.log({ tool: 'b', params: {}, result: makeResult({ success: true }), duration: 10, reasoning: 'Running build to verify changes' });
      tel.log({ tool: 'c', params: {}, result: makeResult({ success: true }), duration: 10, reasoning: 'Deploying to staging' });

      const matches = tel.correlateWithReasoning(['file', 'build']);
      expect(matches).toHaveLength(2);
      expect(matches.map(c => c.tool).sort()).toEqual(['a', 'b']);
    });

    it('returns empty array when no calls match patterns', () => {
      const tel = new ToolTelemetry('no-corr-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'x', params: {}, result: makeResult({ success: true }), duration: 10, reasoning: 'no match here' });
      expect(tel.correlateWithReasoning(['missing', 'absent'])).toEqual([]);
    });

    it('skips calls with no reasoning field', () => {
      const tel = new ToolTelemetry('skip-no-reason');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'no-reason', params: {}, result: makeResult({ success: true }), duration: 10 });
      const matches = tel.correlateWithReasoning(['anything']);
      expect(matches).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getSessionId()
  // ---------------------------------------------------------------------------
  describe('getSessionId', () => {
    it('returns the session ID passed to constructor', () => {
      const tel = new ToolTelemetry('my-custom-id');
      expect(tel.getSessionId()).toBe('my-custom-id');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases and error paths
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles a single call correctly (no sequences of length 3)', () => {
      const tel = new ToolTelemetry('single-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'only', params: {}, result: makeResult({ success: true }), duration: 42 });

      const analysis = tel.analyze();
      expect(analysis.totalCalls).toBe(1);
      expect(analysis.uniqueTools).toBe(1);
      expect(analysis.overallSuccessRate).toBe(1);
      expect(analysis.avgDuration).toBe(42);
      // No sequences of length 2 or 3 with only 1 call
      expect(analysis.commonSequences).toEqual([]);
    });

    it('handles two calls (2-tool sequence but no 3-tool sequence)', () => {
      const tel = new ToolTelemetry('two-session');
      const logDir = (tel as any).logDir as string;
      if (existsSync(logDir)) {
        for (const f of readdirSync(logDir)) rmSync(join(logDir, f));
      }

      tel.log({ tool: 'first', params: {}, result: makeResult({ success: true }), duration: 10 });
      tel.log({ tool: 'second', params: {}, result: makeResult({ success: false, error: 'timeout: ETIMEDOUT' }), duration: 20 });

      const analysis = tel.analyze();
      expect(analysis.totalCalls).toBe(2);
      expect(analysis.overallSuccessRate).toBe(0.5);

      // Should have a 2-tool sequence but no 3-tool sequence
      const seqs = analysis.commonSequences;
      const seq2 = seqs.find(s => s.sequence.length === 2);
      const seq3 = seqs.find(s => s.sequence.length === 3);
      expect(seq2).toBeTruthy();
      expect(seq2!.sequence).toEqual(['first', 'second']);
      expect(seq3).toBeUndefined();
    });

    it('handles writing to an already-existing directory', () => {
      // The constructor calls ensureDir; calling it again should not throw
      const tel1 = new ToolTelemetry('dir-exists-1');
      const tel2 = new ToolTelemetry('dir-exists-2');
      tel2.log({ tool: 't', params: {}, result: makeResult({ success: true }), duration: 1 });
      // Should not throw
      const calls = tel2.getSessionCalls();
      expect(calls).toHaveLength(1);
    });

    it('produces a valid id and timestamp on each record', () => {
      const tel = new ToolTelemetry('id-session');
      const record = tel.log({ tool: 't', params: {}, result: makeResult({ success: true }), duration: 1 });

      // id format: <timestamp>-<random>
      expect(record.id).toMatch(/^\d+-[a-z0-9]+$/);
      // timestamp is ISO format
      expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
