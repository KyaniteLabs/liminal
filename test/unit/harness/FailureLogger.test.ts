import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FailureRecord } from '../../../src/harness/FailureLogger.js';

// --- Mocks ---

const { mockWriteFileSync, mockExistsSync, mockReadFileSync, mockReaddirSync, mockHomedir, mockEnsureDir, mockLoggerInfo } =
  vi.hoisted(() => ({
    mockWriteFileSync: vi.fn(),
    mockExistsSync: vi.fn().mockReturnValue(true),
    mockReadFileSync: vi.fn(),
    mockReaddirSync: vi.fn().mockReturnValue([]),
    mockHomedir: vi.fn().mockReturnValue('/home/testuser'),
    mockEnsureDir: vi.fn(),
    mockLoggerInfo: vi.fn(),
  }));

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
}));

vi.mock('os', () => ({
  homedir: mockHomedir,
}));

vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: mockEnsureDir,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: mockLoggerInfo, debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { FailureLogger } from '../../../src/harness/FailureLogger.js';

function makeFailure(overrides: Partial<FailureRecord> = {}): Omit<FailureRecord, 'timestamp' | 'sessionId' | 'id'> {
  return {
    model: 'test-model',
    domain: 'test-domain',
    prompt: 'Write a function',
    error: 'Something went wrong',
    errorType: 'runtime',
    duration: 500,
    ...overrides,
  };
}

describe('FailureLogger', () => {
  let logger: FailureLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    logger = new FailureLogger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('creates log directory via ensureDir', () => {
      expect(mockEnsureDir).toHaveBeenCalledWith('/home/testuser/.liminal/failures');
    });

    it('generates a unique sessionId', () => {
      const logger2 = new FailureLogger();
      expect(logger.getSessionId()).not.toBe(logger2.getSessionId());
    });

    it('sessionId matches expected format', () => {
      const sid = logger.getSessionId();
      expect(sid).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  // --- log() ---

  describe('log', () => {
    it('writes a JSON file with correct fields', () => {
      logger.log(makeFailure());

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath, content] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain('/home/testuser/.liminal/failures/');
      expect(filepath).toMatch(/\.json$/);

      const parsed: FailureRecord = JSON.parse(content as string);
      expect(parsed.model).toBe('test-model');
      expect(parsed.domain).toBe('test-domain');
      expect(parsed.prompt).toBe('Write a function');
      expect(parsed.error).toBe('Something went wrong');
      expect(parsed.errorType).toBe('runtime');
      expect(parsed.duration).toBe(500);
    });

    it('generates a unique id for each record', () => {
      logger.log(makeFailure());
      logger.log(makeFailure());

      const call1 = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      const call2 = JSON.parse(mockWriteFileSync.mock.calls[1][1] as string);
      expect(call1.id).not.toBe(call2.id);
    });

    it('adds timestamp and sessionId', () => {
      logger.log(makeFailure());

      const parsed = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.sessionId).toBe(logger.getSessionId());
    });

    it('preserves optional fields when provided', () => {
      logger.log(makeFailure({
        code: 'const x = 1;',
        validationErrors: ['Missing return type', 'Unused variable'],
        thinking: 'I need to think about this',
        reasoning: 'The code is incomplete',
        iteration: 3,
        codeLength: 14,
      }));

      const parsed = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(parsed.code).toBe('const x = 1;');
      expect(parsed.validationErrors).toEqual(['Missing return type', 'Unused variable']);
      expect(parsed.thinking).toBe('I need to think about this');
      expect(parsed.reasoning).toBe('The code is incomplete');
      expect(parsed.iteration).toBe(3);
      expect(parsed.codeLength).toBe(14);
    });

    it('omits optional fields when not provided', () => {
      logger.log(makeFailure());

      const parsed = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(parsed.code).toBeUndefined();
      expect(parsed.validationErrors).toBeUndefined();
      expect(parsed.thinking).toBeUndefined();
    });

    it('logs via Logger.info after writing', () => {
      logger.log(makeFailure());

      expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
      expect(mockLoggerInfo.mock.calls[0][0]).toBe('Meta-Harness');
      expect(mockLoggerInfo.mock.calls[0][1]).toContain('Failure logged:');
    });

    it('handles all errorType values', () => {
      const errorTypes: Array<FailureRecord['errorType']> = ['timeout', 'validation', 'generation', 'runtime', 'other'];

      for (const errorType of errorTypes) {
        logger.log(makeFailure({ errorType }));
      }

      expect(mockWriteFileSync).toHaveBeenCalledTimes(5);
      for (let i = 0; i < 5; i++) {
        const parsed = JSON.parse(mockWriteFileSync.mock.calls[i][1] as string);
        expect(parsed.errorType).toBe(errorTypes[i]);
      }
    });
  });

  // --- getRecentFailures() ---

  describe('getRecentFailures', () => {
    it('returns empty array when log directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(logger.getRecentFailures()).toEqual([]);
    });

    it('returns parsed failure records from files', () => {
      const record1: FailureRecord = {
        id: 'r1',
        timestamp: '2026-04-05T00:00:00.000Z',
        sessionId: 'session-1',
        model: 'gpt-4',
        domain: 'music',
        prompt: 'Write a melody',
        error: 'Timeout',
        errorType: 'timeout',
        duration: 30000,
      };
      const record2: FailureRecord = {
        id: 'r2',
        timestamp: '2026-04-05T01:00:00.000Z',
        sessionId: 'session-2',
        model: 'claude',
        domain: 'visual',
        prompt: 'Draw a circle',
        error: 'Validation failed',
        errorType: 'validation',
        duration: 100,
      };

      mockReaddirSync.mockReturnValue(['r2.json', 'r1.json']); // reverse chronological from sort().reverse()
      mockReadFileSync.mockImplementation((filepath: string) => {
        if (filepath.includes('r1.json')) return JSON.stringify(record1);
        if (filepath.includes('r2.json')) return JSON.stringify(record2);
        throw new Error('not found');
      });

      const failures = logger.getRecentFailures(10);

      expect(failures).toHaveLength(2);
      expect(failures[0].id).toBe('r2');
      expect(failures[1].id).toBe('r1');
    });

    it('respects the count limit', () => {
      const files = Array.from({ length: 10 }, (_, i) => `f${i}.json`);
      mockReaddirSync.mockReturnValue(files);
      mockReadFileSync.mockImplementation((filepath: string) => {
        const name = filepath.split('/').pop()!.replace('.json', '');
        return JSON.stringify({ id: name, timestamp: '', sessionId: '', model: '', domain: '', prompt: '', error: '', errorType: 'other', duration: 0 });
      });

      const failures = logger.getRecentFailures(3);

      expect(failures).toHaveLength(3);
    });

    it('defaults to 100 records when no count given', () => {
      const files = Array.from({ length: 150 }, (_, i) => `f${i}.json`);
      mockReaddirSync.mockReturnValue(files);
      mockReadFileSync.mockImplementation((filepath: string) => {
        const name = filepath.split('/').pop()!.replace('.json', '');
        return JSON.stringify({ id: name, timestamp: '', sessionId: '', model: '', domain: '', prompt: '', error: '', errorType: 'other', duration: 0 });
      });

      const failures = logger.getRecentFailures();

      expect(failures).toHaveLength(100);
    });
  });
});
