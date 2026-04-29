/**
 * Tests for RunTestsTool
 *
 * Covers both success and failure paths by mocking child_process.execFile.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { RunTestsTool } from '../../../src/harness/tools/RunTestsTool.js';

describe('RunTestsTool', () => {
  let tool: RunTestsTool;

  beforeEach(() => {
    tool = new RunTestsTool();
  });

  it('has correct name and description', () => {
    expect(tool.name).toBe('runTests');
    expect(tool.description).toBe('Run tests to verify changes');
  });

  it('returns success when tests pass', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    vi.mocked(execFile).mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(null, { stdout: '✓ test 1 passed\n✓ test 2 passed\n3 tests passed', stderr: '' });
    });

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.data?.exitCode).toBe(0);
    expect(result.data?.passed).toBe(5); // 3 ✓ + 2 "passed"
    expect(result.data?.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns failure when tests fail', async () => {
    const { execFile } = await import('node:child_process');
    const execError = Object.assign(new Error('Command failed'), {
      code: 1,
      stdout: '✓ test 1 passed\n✗ test 2 FAILED\n1 failed',
      stderr: 'AssertionError: expected 2',
    });
    vi.mocked(execFile).mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(execError);
    });

    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.data?.exitCode).toBe(1);
    expect(result.data?.passed).toBe(2); // 1 ✓ + 1 "passed"
    expect(result.data?.failed).toBe(3); // 1 ✗ + "FAILED" (matches FAIL) + 1 "failed"
    expect(result.error).toContain('exit code 1');
  });

  it('passes pattern arg when provided', async () => {
    const { execFile } = await import('node:child_process');
    const capturedArgs: string[][] = [];
    vi.mocked(execFile).mockImplementation((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
      capturedArgs.push(args);
      cb(null, { stdout: '1 passed', stderr: '' });
    });

    await tool.execute({ pattern: 'test/unit/foo.test.ts' });

    expect(capturedArgs[0]).toEqual(['test', 'test/unit/foo.test.ts']);
  });

  it('uses custom timeout when provided', async () => {
    const { execFile } = await import('node:child_process');
    const capturedOpts: unknown[] = [];
    vi.mocked(execFile).mockImplementation((_cmd: string, _args: string[], opts: unknown, cb: Function) => {
      capturedOpts.push(opts);
      cb(null, { stdout: '1 passed', stderr: '' });
    });

    await tool.execute({ timeoutMs: 30000 });

    expect((capturedOpts[0] as { timeout: number }).timeout).toBe(30000);
  });

  it('defaults timeout to 60000ms', async () => {
    const { execFile } = await import('node:child_process');
    const capturedOpts: unknown[] = [];
    vi.mocked(execFile).mockImplementation((_cmd: string, _args: string[], opts: unknown, cb: Function) => {
      capturedOpts.push(opts);
      cb(null, { stdout: '1 passed', stderr: '' });
    });

    await tool.execute({});

    expect((capturedOpts[0] as { timeout: number }).timeout).toBe(60000);
  });

  it('handles error with no stdout', async () => {
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
      cb(new Error('spawn npm ENOENT'));
    });

    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.data?.passed).toBe(0);
    expect(result.data?.failed).toBe(1); // fallback to 1 when no matches
    expect(result.error).toContain('Tests failed');
  });
});
