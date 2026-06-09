import { describe, it, expect, vi } from 'vitest';
import type { CommandRunner } from '../../../src/harness/tools/types.js';
import { RunLintTool } from '../../../src/harness/tools/RunLintTool.js';

describe('RunLintTool', () => {
  it('has correct name and description', () => {
    const tool = new RunLintTool();
    expect(tool.name).toBe('runLint');
    expect(tool.description).toContain('lint');
  });

  describe('execute', () => {
    it('runs npm run lint when no files specified', async () => {
      const mockRunner: CommandRunner = vi.fn().mockResolvedValue({
        stdout: '0 problems',
        stderr: '',
      });
      const tool = new RunLintTool(mockRunner);

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.command).toBe('npm run lint');
      expect(result.data?.stdout).toBe('0 problems');
      expect(mockRunner).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.any(Object));
    });

    it('runs eslint on specific files when files provided', async () => {
      const mockRunner: CommandRunner = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      const tool = new RunLintTool(mockRunner);

      const result = await tool.execute({ files: ['src/foo.ts', 'src/bar.ts'] });

      expect(result.success).toBe(true);
      expect(result.data?.command).toBe('npx eslint src/foo.ts src/bar.ts');
      expect(mockRunner).toHaveBeenCalledWith('npx', ['eslint', 'src/foo.ts', 'src/bar.ts'], expect.any(Object));
    });

    it('returns error when lint fails', async () => {
      const mockRunner: CommandRunner = vi.fn().mockRejectedValue(new Error('2 errors found'));
      const tool = new RunLintTool(mockRunner);

      const result = await tool.execute({ files: ['bad.ts'] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('2 errors found');
      expect(result.data?.stderr).toContain('2 errors found');
    });

    it('passes timeout from params', async () => {
      const mockRunner: CommandRunner = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      const tool = new RunLintTool(mockRunner);

      await tool.execute({ timeoutMs: 5000 });

      expect(mockRunner).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.objectContaining({ timeout: 5000 }));
    });

    it('uses default timeout of 60000', async () => {
      const mockRunner: CommandRunner = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
      });
      const tool = new RunLintTool(mockRunner);

      await tool.execute({});

      expect(mockRunner).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.objectContaining({ timeout: 60000 }));
    });

    it('handles empty files array as npm run lint', async () => {
      const mockRunner: CommandRunner = vi.fn().mockResolvedValue({
        stdout: 'clean',
        stderr: '',
      });
      const tool = new RunLintTool(mockRunner);

      const result = await tool.execute({ files: [] });

      expect(result.data?.command).toBe('npm run lint');
      expect(mockRunner).toHaveBeenCalledWith('npm', ['run', 'lint'], expect.any(Object));
    });
  });
});
