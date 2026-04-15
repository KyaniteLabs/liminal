/**
 * TestFailureDetector unit tests.
 * Covers test output parsing, source file mapping, error handling, and config defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────
const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { TestFailureDetector } from '../../../src/fix/TestFailureDetector.js';

describe('TestFailureDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constructor / defaults ─────────────────────────────────────────
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const detector = new TestFailureDetector();
      expect(detector).toBeInstanceOf(TestFailureDetector);
    });

    it('accepts custom config', () => {
      const detector = new TestFailureDetector({
        testCommand: 'npm test',
        timeout: 60_000,
        includeRawOutput: true,
      });
      expect(detector).toBeInstanceOf(TestFailureDetector);
    });
  });

  // ── All tests pass ─────────────────────────────────────────────────
  describe('detect when all tests pass', () => {
    it('returns empty failures when tests pass', () => {
      mockExecSync.mockReturnValue('All tests passed');
      const detector = new TestFailureDetector({ testCommand: 'pnpm test' });
      const result = detector.detect();

      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.failingFileCount).toBe(0);
      expect(result.totalFailedTests).toBe(0);
    });

    it('includes raw output when includeRawOutput is true', () => {
      mockExecSync.mockReturnValue('All tests passed');
      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        includeRawOutput: true,
      });
      const result = detector.detect();

      expect(result.rawOutput).toBe('All tests passed');
    });

    it('omits raw output when includeRawOutput is false', () => {
      mockExecSync.mockReturnValue('All tests passed');
      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        includeRawOutput: false,
      });
      const result = detector.detect();

      expect(result.rawOutput).toBeUndefined();
    });
  });

  // ── Vitest format parsing ──────────────────────────────────────────
  describe('detect parses Vitest output', () => {
    it('parses Vitest file summary lines', () => {
      const output = [
        '❯ test/unit/foo.test.ts (10 tests | 3 failed)',
        '✕ should do something 45ms',
        '✕ should do another thing 12ms',
        'AssertionError: expected true',
        '❯ test/unit/bar.test.ts (5 tests | 1 failed)',
        '✕ should work correctly 23ms',
      ].join('\n');

      // Simulate execSync throwing (tests failed)
      const error = new Error('Command failed');
      (error as any).stdout = output;
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(2);
      expect(result.failures[0].testFile).toBe('test/unit/foo.test.ts');
      expect(result.failures[0].totalCount).toBe(10);
      expect(result.failures[0].failedCount).toBe(3);
      expect(result.failures[1].testFile).toBe('test/unit/bar.test.ts');
      expect(result.failures[1].failedCount).toBe(1);
    });

    it('captures individual test failure messages', () => {
      const output = [
        '❯ test/unit/feature.test.ts (3 tests | 1 failed)',
        '✕ should return correct value 15ms',
        'AssertionError: expected 42 received 7',
      ].join('\n');

      const error = new Error('Command failed');
      (error as any).stdout = output;
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.failures[0].failureMessages).toContain('should return correct value');
      expect(result.failures[0].failureMessages).toContain('AssertionError: expected 42 received 7');
    });
  });

  // ── FAIL-style parsing ─────────────────────────────────────────────
  describe('detect parses FAIL-style output', () => {
    it('parses FAIL lines (Jest format)', () => {
      const output = [
        'FAIL test/unit/baz.test.ts',
        '✕ should work 10ms',
        'Error: something went wrong',
      ].join('\n');

      const error = new Error('Command failed');
      (error as any).stdout = output;
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'npm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].testFile).toBe('test/unit/baz.test.ts');
    });
  });

  // ── Fallback parsing ───────────────────────────────────────────────
  describe('fallback parsing', () => {
    it('uses fallback parser when no standard patterns match', () => {
      const output = 'Some error in test/unit/something.test.ts and test/unit/other.test.ts';

      const error = new Error('Command failed');
      (error as any).stdout = output;
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.success).toBe(true);
      expect(result.failures.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────
  describe('error handling', () => {
    it('returns failure when execSync throws with no output', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Spawn ENOENT');
      });

      const detector = new TestFailureDetector({ testCommand: 'bad-command' });
      const result = detector.detect();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test execution failed');
      expect(result.error).toContain('Spawn ENOENT');
      expect(result.failures).toHaveLength(0);
    });

    it('handles stderr output when stdout is empty', () => {
      const error = new Error('Command failed');
      (error as any).stdout = '';
      (error as any).stderr = '❯ test/unit/err.test.ts (2 tests | 1 failed)\n✕ bad test 5ms';
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.success).toBe(true);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].testFile).toBe('test/unit/err.test.ts');
    });
  });

  // ── detectPattern ──────────────────────────────────────────────────
  describe('detectPattern', () => {
    it('appends pattern to test command', () => {
      mockExecSync.mockReturnValue('All tests passed');
      const detector = new TestFailureDetector({ testCommand: 'pnpm test' });
      const result = detector.detectPattern('test/unit/foo.test.ts');

      expect(mockExecSync).toHaveBeenCalledWith(
        'pnpm test test/unit/foo.test.ts',
        expect.any(Object),
      );
      expect(result.success).toBe(true);
    });

    it('restores original command after running', () => {
      mockExecSync.mockReturnValue('All tests passed');
      const detector = new TestFailureDetector({ testCommand: 'pnpm test' });
      detector.detectPattern('test/unit/foo.test.ts');
      detector.detect();

      // Second call should use original command
      expect(mockExecSync).toHaveBeenLastCalledWith('pnpm test', expect.any(Object));
    });
  });

  // ── getSourceFiles ─────────────────────────────────────────────────
  describe('getSourceFiles', () => {
    it('returns source files from failures with sourceFile set', () => {
      const detector = new TestFailureDetector();
      const detectionResult = {
        success: true,
        failures: [
          { testFile: 'test/unit/foo.test.ts', failedCount: 1, totalCount: 5, failureMessages: [], sourceFile: 'src/foo.ts' },
          { testFile: 'test/unit/bar.test.ts', failedCount: 2, totalCount: 3, failureMessages: [], sourceFile: 'src/bar.ts' },
        ],
        failingFileCount: 2,
        totalFailedTests: 3,
      };

      const sources = detector.getSourceFiles(detectionResult);
      expect(sources).toEqual(['src/foo.ts', 'src/bar.ts']);
    });

    it('uses sourceMapper when sourceFile is not set', () => {
      const detector = new TestFailureDetector({
        sourceMapper: (testFile: string) => testFile.replace('test/unit/', 'src/').replace('.test.ts', '.ts'),
      });
      const detectionResult = {
        success: true,
        failures: [
          { testFile: 'test/unit/foo.test.ts', failedCount: 1, totalCount: 5, failureMessages: [] },
        ],
        failingFileCount: 1,
        totalFailedTests: 1,
      };

      const sources = detector.getSourceFiles(detectionResult);
      expect(sources).toEqual(['src/foo.ts']);
    });

    it('deduplicates source files', () => {
      const detector = new TestFailureDetector();
      const detectionResult = {
        success: true,
        failures: [
          { testFile: 'test/unit/foo.test.ts', failedCount: 1, totalCount: 5, failureMessages: [], sourceFile: 'src/foo.ts' },
          { testFile: 'test/unit/foo2.test.ts', failedCount: 1, totalCount: 3, failureMessages: [], sourceFile: 'src/foo.ts' },
        ],
        failingFileCount: 2,
        totalFailedTests: 2,
      };

      const sources = detector.getSourceFiles(detectionResult);
      expect(sources).toEqual(['src/foo.ts']);
    });

    it('returns empty array when no failures have source mappings', () => {
      const detector = new TestFailureDetector({
        sourceMapper: () => undefined,
      });
      const detectionResult = {
        success: true,
        failures: [
          { testFile: 'test/unit/unknown.test.ts', failedCount: 1, totalCount: 5, failureMessages: [] },
        ],
        failingFileCount: 1,
        totalFailedTests: 1,
      };

      const sources = detector.getSourceFiles(detectionResult);
      expect(sources).toEqual([]);
    });
  });

  // ── totalFailedTests aggregation ───────────────────────────────────
  describe('totalFailedTests aggregation', () => {
    it('sums failedCount across all failures', () => {
      const output = [
        '❯ test/unit/a.test.ts (10 tests | 3 failed)',
        '❯ test/unit/b.test.ts (5 tests | 2 failed)',
      ].join('\n');

      const error = new Error('Command failed');
      (error as any).stdout = output;
      mockExecSync.mockImplementation(() => { throw error; });

      const detector = new TestFailureDetector({
        testCommand: 'pnpm test',
        sourceMapper: () => undefined,
      });
      const result = detector.detect();

      expect(result.totalFailedTests).toBe(5);
      expect(result.failingFileCount).toBe(2);
    });
  });
});
