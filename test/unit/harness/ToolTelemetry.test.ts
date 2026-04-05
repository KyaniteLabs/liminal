import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolCallRecord, ToolUsageStats, ToolTelemetryAnalysis } from '../../../src/harness/tools/ToolTelemetry.js';

// --- Mocks ---

const { mockWriteFileSync, mockExistsSync, mockMkdirSync, mockReadFileSync, mockReaddirSync, mockHomedir } =
  vi.hoisted(() => ({
    mockWriteFileSync: vi.fn(),
    mockExistsSync: vi.fn().mockReturnValue(true),
    mockMkdirSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockReaddirSync: vi.fn().mockReturnValue([]),
    mockHomedir: vi.fn().mockReturnValue('/home/testuser'),
  }));

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
}));

vi.mock('os', () => ({
  homedir: mockHomedir,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ToolTelemetry } from '../../../src/harness/tools/ToolTelemetry.js';

// Helper to create a ToolCallRecord for getSessionCalls
function makeRecord(overrides: Partial<ToolCallRecord> & { tool: string; callOrder: number }): ToolCallRecord {
  return {
    id: `test-${overrides.callOrder}`,
    timestamp: '2026-04-05T00:00:00.000Z',
    sessionId: 'test-session',
    tool: overrides.tool,
    params: {},
    result: { success: overrides.success ?? true },
    duration: overrides.duration ?? 100,
    success: overrides.success ?? true,
    retryCount: overrides.retryCount ?? 0,
    callOrder: overrides.callOrder,
    ...overrides,
  } as ToolCallRecord;
}

// Helper to write a record JSON to mock readFileSync
function seedRecords(records: ToolCallRecord[], sessionId: string = 'test-session') {
  const files = records.map(r => `${r.id}.json`);
  mockReaddirSync.mockReturnValue(files);
  mockReadFileSync.mockImplementation((filepath: string) => {
    const filename = filepath.split('/').pop();
    const record = records.find(r => `${r.id}.json` === filename);
    if (!record) throw new Error('file not found');
    return JSON.stringify(record);
  });
}

describe('ToolTelemetry', () => {
  let telemetry: ToolTelemetry;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    telemetry = new ToolTelemetry('test-session');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('uses provided sessionId', () => {
      const t = new ToolTelemetry('my-custom-session');
      expect(t.getSessionId()).toBe('my-custom-session');
    });

    it('generates a sessionId when none provided', () => {
      const t = new ToolTelemetry();
      const sid = t.getSessionId();
      expect(sid).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('creates log directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const t = new ToolTelemetry('fresh-session');
      expect(mockMkdirSync).toHaveBeenCalledWith('/home/testuser/.liminal/tool-telemetry', { recursive: true });
    });
  });

  // --- log() ---

  describe('log', () => {
    it('returns a ToolCallRecord with correct fields', () => {
      const record = telemetry.log({
        tool: 'search',
        params: { pattern: 'hello' },
        result: { success: true, data: { matches: [] } },
        duration: 150,
      });

      expect(record.tool).toBe('search');
      expect(record.success).toBe(true);
      expect(record.duration).toBe(150);
      expect(record.callOrder).toBe(1);
      expect(record.sessionId).toBe('test-session');
      expect(record.previousTool).toBeUndefined();
    });

    it('increments callOrder for subsequent calls', () => {
      telemetry.log({ tool: 'search', params: {}, result: { success: true }, duration: 10 });
      telemetry.log({ tool: 'listDir', params: {}, result: { success: true }, duration: 20 });
      const third = telemetry.log({ tool: 'applyEdit', params: {}, result: { success: true }, duration: 30 });

      expect(third.callOrder).toBe(3);
      expect(third.previousTool).toBe('listDir');
    });

    it('tracks previousTool across calls', () => {
      telemetry.log({ tool: 'search', params: {}, result: { success: true }, duration: 10 });
      const second = telemetry.log({ tool: 'listDir', params: {}, result: { success: true }, duration: 20 });

      expect(second.previousTool).toBe('search');
    });

    it('writes JSON file to log directory', () => {
      telemetry.log({ tool: 'search', params: {}, result: { success: true }, duration: 50 });

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath, content] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain('/home/testuser/.liminal/tool-telemetry/');
      expect(filepath).toMatch(/\.json$/);
      const parsed = JSON.parse(content as string);
      expect(parsed.tool).toBe('search');
    });

    it('categorizes error from result', () => {
      const record = telemetry.log({
        tool: 'search',
        params: {},
        result: { success: false, error: 'ENOENT: no such file or directory' },
        duration: 5,
      });

      expect(record.errorCategory).toBe('file_not_found');
    });

    it('sets errorCategory to undefined when no error', () => {
      const record = telemetry.log({
        tool: 'search',
        params: {},
        result: { success: true },
        duration: 5,
      });

      expect(record.errorCategory).toBeUndefined();
    });

    it('passes through optional fields', () => {
      const record = telemetry.log({
        tool: 'search',
        params: {},
        result: { success: true },
        duration: 10,
        reasoning: 'Need to find the function',
        reasoningTraceId: 'trace-123',
        taskId: 'task-456',
        iteration: 3,
        retryCount: 2,
      });

      expect(record.reasoning).toBe('Need to find the function');
      expect(record.reasoningTraceId).toBe('trace-123');
      expect(record.taskId).toBe('task-456');
      expect(record.iteration).toBe(3);
      expect(record.retryCount).toBe(2);
    });
  });

  // --- sanitizeParams ---

  describe('param sanitization', () => {
    it('truncates long string values over 500 characters', () => {
      const longString = 'x'.repeat(600);
      const record = telemetry.log({
        tool: 'writeFile',
        params: { content: longString },
        result: { success: true },
        duration: 10,
      });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.params.content).toBe('x'.repeat(500) + '... [truncated]');
    });

    it('preserves short string values unchanged', () => {
      telemetry.log({
        tool: 'search',
        params: { pattern: 'short query' },
        result: { success: true },
        duration: 10,
      });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.params.pattern).toBe('short query');
    });

    it('passes through non-object params as-is', () => {
      telemetry.log({
        tool: 'search',
        params: 'just a string',
        result: { success: true },
        duration: 10,
      });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.params).toBe('just a string');
    });

    it('passes through null params as-is', () => {
      telemetry.log({
        tool: 'search',
        params: null,
        result: { success: true },
        duration: 10,
      });

      const written = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(written.params).toBeNull();
    });
  });

  // --- categorizeError (tested indirectly through log) ---

  describe('error categorization', () => {
    const cases: [string, string][] = [
      ['ENOENT: no such file', 'file_not_found'],
      ['Permission denied: EACCES', 'permission_error'],
      ['SyntaxError: unexpected token', 'syntax_error'],
      ['ETIMEDOUT: request timed out', 'timeout'],
      ['Rate limit exceeded: too many requests', 'rate_limited'],
      ['Invalid input: validation failed', 'validation_error'],
      ['Build failed: tsc compilation error', 'build_error'],
      ['Test failure: assertion error', 'test_failure'],
      ['Some random error nobody predicted', 'unknown'],
    ];

    it.each(cases)('categorizes "%s" as %s', (errorStr, expectedCategory) => {
      const record = telemetry.log({
        tool: 'test-tool',
        params: {},
        result: { success: false, error: errorStr },
        duration: 10,
      });

      expect(record.errorCategory).toBe(expectedCategory);
    });
  });

  // --- analyze() ---

  describe('analyze', () => {
    it('returns empty analysis when no calls recorded', () => {
      mockReaddirSync.mockReturnValue([]);
      const analysis = telemetry.analyze();

      expect(analysis.totalCalls).toBe(0);
      expect(analysis.uniqueTools).toBe(0);
      expect(analysis.overallSuccessRate).toBe(0);
      expect(analysis.avgDuration).toBe(0);
      expect(analysis.toolStats).toEqual([]);
      expect(analysis.commonSequences).toEqual([]);
      expect(analysis.insights).toEqual(['No tool calls recorded']);
    });

    it('computes correct totalCalls and uniqueTools', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 }),
        makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 100 }),
        makeRecord({ tool: 'listDir', callOrder: 3, success: false, duration: 200 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      expect(analysis.totalCalls).toBe(3);
      expect(analysis.uniqueTools).toBe(2);
    });

    it('computes overall success rate correctly', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 }),
        makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 50 }),
        makeRecord({ tool: 'listDir', callOrder: 3, success: false, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      // 2 out of 3 succeeded
      expect(analysis.overallSuccessRate).toBeCloseTo(2 / 3, 6);
    });

    it('computes avgDuration across all calls', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 100 }),
        makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 200 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      expect(analysis.avgDuration).toBe(150);
    });

    it('computes per-tool stats correctly', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 100 }),
        makeRecord({ tool: 'search', callOrder: 2, success: false, duration: 200, errorCategory: 'timeout', retryCount: 1 }),
        makeRecord({ tool: 'listDir', callOrder: 3, success: true, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();
      const searchStats = analysis.toolStats.find(s => s.tool === 'search')!;

      expect(searchStats.totalCalls).toBe(2);
      expect(searchStats.successCount).toBe(1);
      expect(searchStats.failureCount).toBe(1);
      expect(searchStats.avgDuration).toBe(150);
      expect(searchStats.retryRate).toBe(0.5);
      expect(searchStats.commonErrors).toEqual([{ error: 'timeout', count: 1 }]);
    });

    it('sorts toolStats by totalCalls descending', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 }),
        makeRecord({ tool: 'listDir', callOrder: 2, success: true, duration: 50 }),
        makeRecord({ tool: 'listDir', callOrder: 3, success: true, duration: 50 }),
        makeRecord({ tool: 'listDir', callOrder: 4, success: true, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      expect(analysis.toolStats[0].tool).toBe('listDir');
      expect(analysis.toolStats[0].totalCalls).toBe(3);
      expect(analysis.toolStats[1].tool).toBe('search');
      expect(analysis.toolStats[1].totalCalls).toBe(1);
    });

    it('detects 2-tool sequences', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 }),
        makeRecord({ tool: 'applyEdit', callOrder: 2, success: true, duration: 50 }),
        makeRecord({ tool: 'search', callOrder: 3, success: true, duration: 50 }),
        makeRecord({ tool: 'applyEdit', callOrder: 4, success: true, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      const topSeq = analysis.commonSequences[0];
      expect(topSeq.sequence).toEqual(['search', 'applyEdit']);
      expect(topSeq.count).toBe(2);
    });

    it('detects 3-tool sequences', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 }),
        makeRecord({ tool: 'listDir', callOrder: 2, success: true, duration: 50 }),
        makeRecord({ tool: 'applyEdit', callOrder: 3, success: true, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      const threeSeq = analysis.commonSequences.find(
        s => s.sequence.length === 3 && s.sequence[0] === 'search' && s.sequence[1] === 'listDir' && s.sequence[2] === 'applyEdit'
      );
      expect(threeSeq).toBeDefined();
      expect(threeSeq!.count).toBe(1);
    });

    it('generates insights for high failure rate tools', () => {
      // 2 failures out of 3 = 66% failure rate > 30% threshold
      const records = [
        makeRecord({ tool: 'applyEdit', callOrder: 1, success: false, duration: 50, errorCategory: 'validation_error' }),
        makeRecord({ tool: 'applyEdit', callOrder: 2, success: false, duration: 50, errorCategory: 'validation_error' }),
        makeRecord({ tool: 'applyEdit', callOrder: 3, success: true, duration: 50 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      const failureInsight = analysis.insights.find(i => i.includes('high failure rate'));
      expect(failureInsight).toBeDefined();
      expect(failureInsight).toContain('applyEdit');
    });

    it('generates insights for slow tools (avg > 10s)', () => {
      const records = [
        makeRecord({ tool: 'build', callOrder: 1, success: true, duration: 15000 }),
        makeRecord({ tool: 'build', callOrder: 2, success: true, duration: 12000 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      const slowInsight = analysis.insights.find(i => i.includes('slow'));
      expect(slowInsight).toBeDefined();
      expect(slowInsight).toContain('build');
    });

    it('generates insights for high retry rate tools', () => {
      const records = [
        makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50, retryCount: 1 }),
        makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 50, retryCount: 0 }),
      ];
      seedRecords(records);

      const analysis = telemetry.analyze();

      const retryInsight = analysis.insights.find(i => i.includes('retry rate'));
      expect(retryInsight).toBeDefined();
      expect(retryInsight).toContain('search');
    });
  });

  // --- getSessionCalls() ---

  describe('getSessionCalls', () => {
    it('returns empty array when log directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(telemetry.getSessionCalls()).toEqual([]);
    });

    it('returns records filtered by sessionId', () => {
      const inSession = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      const outSession = makeRecord({ tool: 'listDir', callOrder: 2, success: true, duration: 50 });
      outSession.id = 'test-other-session';
      outSession.sessionId = 'other-session';

      const files = [`${inSession.id}.json`, `${outSession.id}.json`];
      mockReaddirSync.mockReturnValue(files);
      mockReadFileSync.mockImplementation((filepath: string) => {
        const filename = filepath.split('/').pop();
        if (filename === `${inSession.id}.json`) return JSON.stringify(inSession);
        if (filename === `${outSession.id}.json`) return JSON.stringify(outSession);
        throw new Error('not found');
      });

      const calls = telemetry.getSessionCalls();

      expect(calls).toHaveLength(1);
      expect(calls[0].sessionId).toBe('test-session');
    });

    it('sorts records by callOrder', () => {
      const first = makeRecord({ tool: 'listDir', callOrder: 1, success: true, duration: 50 });
      const second = makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 50 });

      // readdir returns them in reverse order
      const files = [`${second.id}.json`, `${first.id}.json`];
      mockReaddirSync.mockReturnValue(files);
      mockReadFileSync.mockImplementation((filepath: string) => {
        const filename = filepath.split('/').pop();
        if (filename === `${first.id}.json`) return JSON.stringify(first);
        if (filename === `${second.id}.json`) return JSON.stringify(second);
        throw new Error('not found');
      });

      const calls = telemetry.getSessionCalls();

      expect(calls[0].callOrder).toBe(1);
      expect(calls[1].callOrder).toBe(2);
    });

    it('skips files that fail to parse', () => {
      const good = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      const files = [`${good.id}.json`, 'corrupt.json'];
      mockReaddirSync.mockReturnValue(files);
      mockReadFileSync.mockImplementation((filepath: string) => {
        const filename = filepath.split('/').pop();
        if (filename === `${good.id}.json`) return JSON.stringify(good);
        if (filename === 'corrupt.json') return 'not valid json{{{';
        throw new Error('not found');
      });

      const calls = telemetry.getSessionCalls();

      expect(calls).toHaveLength(1);
      expect(calls[0].tool).toBe('search');
    });
  });

  // --- getCallsWithReasoning() ---

  describe('getCallsWithReasoning', () => {
    it('returns only calls with reasoning or reasoningTraceId', () => {
      const withReasoning = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      withReasoning.reasoning = 'Need to find imports';

      const withTraceId = makeRecord({ tool: 'search', callOrder: 2, success: true, duration: 50 });
      withTraceId.reasoningTraceId = 'trace-789';

      const withoutReasoning = makeRecord({ tool: 'search', callOrder: 3, success: true, duration: 50 });

      seedRecords([withReasoning, withTraceId, withoutReasoning]);

      const calls = telemetry.getCallsWithReasoning();

      expect(calls).toHaveLength(2);
      expect(calls.map(c => c.callOrder)).toEqual([1, 2]);
    });
  });

  // --- correlateWithReasoning() ---

  describe('correlateWithReasoning', () => {
    it('returns calls whose reasoning matches any pattern', () => {
      const call1 = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      call1.reasoning = 'Need to find where imports are used';

      const call2 = makeRecord({ tool: 'listDir', callOrder: 2, success: true, duration: 50 });
      call2.reasoning = 'Explore directory structure';

      seedRecords([call1, call2]);

      const results = telemetry.correlateWithReasoning(['imports', 'directory']);

      expect(results).toHaveLength(2);
    });

    it('excludes calls whose reasoning matches no patterns', () => {
      const call1 = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      call1.reasoning = 'Need to find imports';

      const call2 = makeRecord({ tool: 'listDir', callOrder: 2, success: true, duration: 50 });
      call2.reasoning = 'Explore project layout';

      seedRecords([call1, call2]);

      const results = telemetry.correlateWithReasoning(['imports']);

      expect(results).toHaveLength(1);
      expect(results[0].tool).toBe('search');
    });

    it('returns empty array when calls have no reasoning', () => {
      const call = makeRecord({ tool: 'search', callOrder: 1, success: true, duration: 50 });
      seedRecords([call]);

      const results = telemetry.correlateWithReasoning(['anything']);

      expect(results).toEqual([]);
    });
  });
});
