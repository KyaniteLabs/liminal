import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: 'not-used-directly',
}));

vi.mock('node:util', () => ({
  promisify: vi.fn().mockReturnValue(mockExecFileAsync),
}));

import { SearchTool } from '../../../src/harness/tools/SearchTool.js';

describe('SearchTool', () => {
  let tool: SearchTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new SearchTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Basic properties ---

  describe('properties', () => {
    it('has name "search"', () => {
      expect(tool.name).toBe('search');
    });

    it('has a non-empty description', () => {
      expect(tool.description.length).toBeGreaterThan(0);
    });
  });

  // --- Missing pattern ---

  describe('missing pattern', () => {
    it('returns failure when pattern is empty string', async () => {
      const result = await tool.execute({ pattern: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });

    it('returns failure when pattern is missing', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });

    it('returns failure when pattern is null', async () => {
      const result = await tool.execute({ pattern: null });
      // null is falsy so it hits the !pattern check
      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });
  });

  // --- Path validation ---

  describe('path validation', () => {
    it('returns failure for path outside allowed directories', async () => {
      const result = await tool.execute({ pattern: 'hello', path: '/etc/passwd' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });

    it('returns failure for path traversing above project', async () => {
      const result = await tool.execute({ pattern: 'hello', path: '../../etc' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });
  });

  // --- Successful search with ripgrep ---

  describe('successful ripgrep search', () => {
    it('parses rg output correctly', async () => {
      const rgOutput = 'src/utils/Logger.ts:10:export const LOG_LEVEL = "debug";\nsrc/core/index.ts:25:const level = LOG_LEVEL;\n';
      mockExecFileAsync.mockResolvedValue({ stdout: rgOutput, stderr: '' });

      const result = await tool.execute({ pattern: 'LOG_LEVEL', path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return; // type guard
      expect(result.data!.matches).toHaveLength(2);
      expect(result.data!.matches[0]).toEqual({
        file: 'src/utils/Logger.ts',
        line: 10,
        content: 'export const LOG_LEVEL = "debug";',
      });
      expect(result.data!.matches[1]).toEqual({
        file: 'src/core/index.ts',
        line: 25,
        content: 'const level = LOG_LEVEL;',
      });
      expect(result.data!.totalMatches).toBe(2);
      expect(result.data!.truncated).toBe(false);
    });

    it('handles no matches (rg exit code 1)', async () => {
      const rgError = Object.assign(new Error('rg exited with code 1'), { exitCode: 1 });
      mockExecFileAsync.mockRejectedValue(rgError);

      const result = await tool.execute({ pattern: 'NONEXISTENT_PATTERN_XYZ', path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toEqual([]);
      expect(result.data!.totalMatches).toBe(0);
    });

    it('truncates results when more than maxResults', async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `src/file.ts:${i + 1}:match line ${i + 1}`);
      mockExecFileAsync.mockResolvedValue({ stdout: lines.join('\n'), stderr: '' });

      const result = await tool.execute({ pattern: 'match', path: 'src', maxResults: 5 });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toHaveLength(5);
      expect(result.data!.totalMatches).toBe(10);
      expect(result.data!.truncated).toBe(true);
    });

    it('passes glob flag when provided', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({ pattern: 'hello', path: 'src', glob: '*.ts' });

      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs[1]).toContain('--glob');
      expect(callArgs[1]).toContain('*.ts');
    });

    it('uses default maxResults of 20', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({ pattern: 'hello', path: 'src' });

      const callArgs = mockExecFileAsync.mock.calls[0];
      // maxResults+5 buffer = 25
      expect(callArgs[1]).toContain('--max-count');
      const maxCountIdx = callArgs[1].indexOf('--max-count');
      expect(callArgs[1][maxCountIdx + 1]).toBe('25');
    });

    it('skips lines that do not match file:line:content format', async () => {
      const mixedOutput = 'src/file.ts:10:real match\nbinary file matches\nsrc/other.ts:20:another match\n';
      mockExecFileAsync.mockResolvedValue({ stdout: mixedOutput, stderr: '' });

      const result = await tool.execute({ pattern: 'match', path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toHaveLength(2);
      // The "binary file matches" line is filtered out
    });

    it('returns error when stderr is non-empty', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: 'ripgrep error: invalid pattern' });

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ripgrep error: invalid pattern');
    });
  });

  // --- Fallback to grep ---

  describe('fallback to grep', () => {
    it('falls back to grep when ripgrep throws (not exit code 1)', async () => {
      // First call (rg) throws, second call (grep) succeeds
      const rgError = new Error('rg: command not found');
      mockExecFileAsync
        .mockRejectedValueOnce(rgError)
        .mockResolvedValueOnce({ stdout: 'src/file.ts:5:found it\n' });

      const result = await tool.execute({ pattern: 'found', path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toHaveLength(1);
      expect(result.data!.matches[0].content).toBe('found it');
    });

    it('returns failure when both rg and grep fail', async () => {
      mockExecFileAsync
        .mockRejectedValueOnce(new Error('rg: not found'))
        .mockRejectedValueOnce(new Error('grep: not found'));

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
      expect(result.error).toContain('Install ripgrep');
    });
  });

  // --- Custom maxResults ---

  describe('custom maxResults', () => {
    it('respects custom maxResults parameter', async () => {
      const lines = Array.from({ length: 8 }, (_, i) => `src/file.ts:${i + 1}:line ${i + 1}`);
      mockExecFileAsync.mockResolvedValue({ stdout: lines.join('\n'), stderr: '' });

      const result = await tool.execute({ pattern: 'line', path: 'src', maxResults: 3 });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toHaveLength(3);
      expect(result.data!.truncated).toBe(true);
    });
  });

  // --- Empty output ---

  describe('empty output', () => {
    it('handles empty stdout gracefully', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({ pattern: 'nothing', path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.matches).toEqual([]);
      expect(result.data!.totalMatches).toBe(0);
      expect(result.data!.truncated).toBe(false);
    });
  });
});
