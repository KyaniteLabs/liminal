import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

import { SearchTool } from '../../../src/harness/tools/SearchTool.js';

describe('SearchTool', () => {
  let tool: SearchTool;

  beforeEach(() => {
    tool = new SearchTool();
    mockExecFile.mockReset();
  });

  it('exposes correct name and description', () => {
    expect(tool.name).toBe('search');
    expect(tool.description).toBe('Search for patterns in codebase using ripgrep');
  });

  describe('missing pattern', () => {
    it('returns error when pattern is empty string', async () => {
      const result = await tool.execute({ pattern: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });

    it('returns error when pattern is undefined', async () => {
      const result = await tool.execute({ pattern: undefined as unknown as string });

      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });

    it('returns error when pattern is null', async () => {
      const result = await tool.execute({ pattern: null as unknown as string });

      expect(result.success).toBe(false);
      expect(result.error).toBe('pattern is required');
    });
  });

  describe('path validation', () => {
    it('rejects paths outside project directory', async () => {
      const result = await tool.execute({ pattern: 'test', path: '/etc/passwd' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });

    it('accepts paths within src/ directory', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toEqual([]);
      expect(result.data!.totalMatches).toBe(0);
      expect(result.data!.truncated).toBe(false);
    });

    it('rejects absolute paths outside allowed prefixes', async () => {
      const result = await tool.execute({ pattern: 'test', path: '/tmp/evil' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });
  });

  describe('no-match exit handling', () => {
    it('treats ripgrep code=1 as an empty successful search', async () => {
      const error = Object.assign(new Error('no matches'), { code: 1, stdout: '', stderr: '' });
      mockExecFile.mockRejectedValue(error);

      const result = await tool.execute({ pattern: 'does-not-exist', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toEqual([]);
      expect(result.data!.totalMatches).toBe(0);
      expect(result.data!.truncated).toBe(false);
    });
  });

  describe('ripgrep results parsing', () => {
    it('parses ripgrep output into structured matches', async () => {
      const ripgrepOutput = [
        'src/main.ts:10:const greeting = "hello";',
        'src/utils.ts:25:export const hello = "world";',
      ].join('\n');

      mockExecFile.mockResolvedValue({ stdout: ripgrepOutput, stderr: '' });

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.totalMatches).toBe(2);
      expect(result.data!.truncated).toBe(false);
      expect(result.data!.matches).toHaveLength(2);

      expect(result.data!.matches[0]).toEqual({
        file: 'src/main.ts',
        line: 10,
        content: 'const greeting = "hello";',
      });
      expect(result.data!.matches[1]).toEqual({
        file: 'src/utils.ts',
        line: 25,
        content: 'export const hello = "world";',
      });
    });

    it('limits results to maxResults and sets truncated flag', async () => {
      const lines = Array.from({ length: 15 }, (_, i) => `src/file.ts:${i + 1}:match text ${i}`);
      mockExecFile.mockResolvedValue({ stdout: lines.join('\n'), stderr: '' });

      const result = await tool.execute({ pattern: 'match', path: 'src', maxResults: 5 });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(5);
      expect(result.data!.totalMatches).toBe(15);
      expect(result.data!.truncated).toBe(true);
    });

    it('uses default maxResults of 20 when not specified', async () => {
      const lines = Array.from({ length: 30 }, (_, i) => `src/file.ts:${i + 1}:line ${i}`);
      mockExecFile.mockResolvedValue({ stdout: lines.join('\n'), stderr: '' });

      const result = await tool.execute({ pattern: 'line', path: 'src' });

      expect(result.data!.matches).toHaveLength(20);
      expect(result.data!.truncated).toBe(true);
    });

    it('handles no matches (rg exit code 1)', async () => {
      const rgError = new Error('no matches') as Error & { exitCode: number };
      rgError.exitCode = 1;
      mockExecFile.mockRejectedValue(rgError);

      const result = await tool.execute({ pattern: 'nonexistent', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toEqual([]);
      expect(result.data!.totalMatches).toBe(0);
      expect(result.data!.truncated).toBe(false);
    });

    it('handles malformed ripgrep output lines gracefully', async () => {
      const mixedOutput = [
        'src/main.ts:10:good line',
        'not a valid line',
        '',
        'src/other.ts:5:another good line',
      ].join('\n');

      mockExecFile.mockResolvedValue({ stdout: mixedOutput, stderr: '' });

      const result = await tool.execute({ pattern: 'good', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(2);
      expect(result.data!.matches[0].file).toBe('src/main.ts');
      expect(result.data!.matches[1].file).toBe('src/other.ts');
    });

    it('returns error when ripgrep writes to stderr', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: 'ripgrep error: invalid regex' });

      const result = await tool.execute({ pattern: '[invalid', path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ripgrep error: invalid regex');
    });
  });

  describe('glob parameter', () => {
    it('passes glob argument to ripgrep when specified', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({ pattern: 'hello', path: 'src', glob: '*.ts' });

      expect(mockExecFile).toHaveBeenCalled();
      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).toContain('--glob');
      const globIndex = args.indexOf('--glob');
      expect(args[globIndex + 1]).toBe('*.ts');
    });

    it('omits glob argument when not specified', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });

      await tool.execute({ pattern: 'hello', path: 'src' });

      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).not.toContain('--glob');
    });
  });

  describe('ripgrep not available (fallback to grep)', () => {
    it('falls back to grep when rg is not installed', async () => {
      const rgError = new Error('command not found: rg');
      mockExecFile.mockRejectedValueOnce(rgError);

      // Mock grep success
      const grepOutput = 'src/main.ts:10:const greeting = "hello";';
      mockExecFile.mockResolvedValueOnce({ stdout: grepOutput, stderr: '' });

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(1);
      expect(result.data!.matches[0]).toEqual({
        file: 'src/main.ts',
        line: 10,
        content: 'const greeting = "hello";',
      });
    });

    it('returns error when both rg and grep fail', async () => {
      const rgError = new Error('command not found: rg');
      const grepError = new Error('command not found: grep');
      mockExecFile.mockRejectedValueOnce(rgError);
      mockExecFile.mockRejectedValueOnce(grepError);

      const result = await tool.execute({ pattern: 'hello', path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed: command not found: grep');
    });

    it('handles grep results with truncation', async () => {
      const rgError = new Error('no rg');
      mockExecFile.mockRejectedValueOnce(rgError);

      const lines = Array.from({ length: 30 }, (_, i) => `src/file.ts:${i + 1}:line ${i}`);
      mockExecFile.mockResolvedValueOnce({ stdout: lines.join('\n') });

      const result = await tool.execute({ pattern: 'line', path: 'src', maxResults: 5 });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(5);
      expect(result.data!.truncated).toBe(true);
    });
  });

  describe('grep fallback malformed lines', () => {
    it('handles malformed lines in grep fallback output', async () => {
      const rgError = new Error('no rg');
      mockExecFile.mockRejectedValueOnce(rgError);

      const grepOutput = [
        'src/main.ts:10:good line',
        'not a valid line',
        'src/other.ts:5:another good line',
      ].join('\n');
      mockExecFile.mockResolvedValueOnce({ stdout: grepOutput });

      const result = await tool.execute({ pattern: 'good', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(2);
      expect(result.data!.matches[0].file).toBe('src/main.ts');
      expect(result.data!.matches[1].file).toBe('src/other.ts');
    });

    it('grep fallback sets truncated when results exceed maxResults', async () => {
      const rgError = new Error('no rg');
      mockExecFile.mockRejectedValueOnce(rgError);

      const lines = Array.from({ length: 25 }, (_, i) => `src/f.ts:${i + 1}:line ${i}`);
      mockExecFile.mockResolvedValueOnce({ stdout: lines.join('\n') });

      const result = await tool.execute({ pattern: 'line', path: 'src', maxResults: 10 });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(10);
      expect(result.data!.truncated).toBe(true);
      expect(result.data!.totalMatches).toBe(25);
    });
  });

  describe('rg non-exit-code-1 error propagates to grep fallback', () => {
    it('falls back to grep when rg throws non-exit-code-1 error', async () => {
      const rgError = new Error('permission denied') as Error & { exitCode: number };
      rgError.exitCode = 2;
      mockExecFile.mockRejectedValueOnce(rgError);

      mockExecFile.mockResolvedValueOnce({ stdout: 'src/a.ts:1:found' });

      const result = await tool.execute({ pattern: 'found', path: 'src' });

      expect(result.success).toBe(true);
      expect(result.data!.matches).toHaveLength(1);
    });
  });

  describe('singleton export', () => {
    it('searchTool is an instance of SearchTool', async () => {
      const { searchTool } = await import('../../../src/harness/tools/SearchTool.js');
      expect(searchTool).toBeInstanceOf(SearchTool);
      expect(searchTool.name).toBe('search');
    });
  });
});
