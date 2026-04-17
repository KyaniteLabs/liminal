import { describe, expect, it, vi } from 'vitest';

import { GitStatusTool } from '../../../src/harness/tools/GitStatusTool.js';

describe('GitStatusTool', () => {
  it('returns branch, commit SHA, clean state, and repository root', async () => {
    const runner = vi.fn(async (_command: string, args: string[]) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel') {
        return { stdout: '/repo\n', stderr: '' };
      }
      if (key === 'branch --show-current') {
        return { stdout: 'main\n', stderr: '' };
      }
      if (key === 'rev-parse HEAD') {
        return { stdout: '4e9a121646692a25e59aa3f36d3cc67573e13826\n', stderr: '' };
      }
      if (key === 'status --short') {
        return { stdout: '', stderr: '' };
      }
      throw new Error(`unexpected git args: ${key}`);
    });
    const tool = new GitStatusTool(runner);

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      branch: 'main',
      commitSha: '4e9a121646692a25e59aa3f36d3cc67573e13826',
      shortSha: '4e9a12164',
      hasHeadCommit: true,
      short: '',
      clean: true,
      root: '/repo',
    });
    expect(runner).toHaveBeenCalledTimes(4);
  });

  it('reports dirty short status', async () => {
    const runner = vi.fn(async (_command: string, args: string[]) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel') return { stdout: '/repo\n', stderr: '' };
      if (key === 'branch --show-current') return { stdout: 'main\n', stderr: '' };
      if (key === 'rev-parse HEAD') return { stdout: 'abcdef1234567890\n', stderr: '' };
      if (key === 'status --short') return { stdout: ' M src/foo.ts\n?? test/foo.test.ts\n', stderr: '' };
      throw new Error(`unexpected git args: ${key}`);
    });
    const tool = new GitStatusTool(runner);

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.data?.clean).toBe(false);
    expect(result.data?.short).toContain('M src/foo.ts');
    expect(result.data?.short).toContain('?? test/foo.test.ts');
  });

  it('still reports branch and status for repositories with unborn HEAD', async () => {
    const runner = vi.fn(async (_command: string, args: string[]) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel') return { stdout: '/repo\n', stderr: '' };
      if (key === 'branch --show-current') return { stdout: 'main\n', stderr: '' };
      if (key === 'rev-parse HEAD') throw new Error("fatal: ambiguous argument 'HEAD'");
      if (key === 'status --short') return { stdout: '?? README.md\n', stderr: '' };
      throw new Error(`unexpected git args: ${key}`);
    });
    const tool = new GitStatusTool(runner);

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      branch: 'main',
      commitSha: '',
      shortSha: '',
      hasHeadCommit: false,
      clean: false,
      short: '?? README.md',
      root: '/repo',
    });
  });

  it('surfaces unexpected HEAD lookup failures', async () => {
    const runner = vi.fn(async (_command: string, args: string[]) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel') return { stdout: '/repo\n', stderr: '' };
      if (key === 'branch --show-current') return { stdout: 'main\n', stderr: '' };
      if (key === 'rev-parse HEAD') throw new Error('git execution timed out');
      if (key === 'status --short') return { stdout: '', stderr: '' };
      throw new Error(`unexpected git args: ${key}`);
    });
    const tool = new GitStatusTool(runner);

    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toContain('git execution timed out');
  });
});
