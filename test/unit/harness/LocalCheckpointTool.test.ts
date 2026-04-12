import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

import { LocalCheckpointTool } from '../../../src/harness/tools/LocalCheckpointTool.js';

describe('LocalCheckpointTool', () => {
  let tool: LocalCheckpointTool;

  beforeEach(() => {
    tool = new LocalCheckpointTool();
    mockExecFile.mockReset();
  });

  it('rejects protected main branch', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: 'main\n' });

    const result = await tool.execute({ message: 'checkpoint' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('protected branch main');
  });

  it('rejects detached HEAD', async () => {
    mockExecFile.mockResolvedValueOnce({ stdout: '\n' });

    const result = await tool.execute({ message: 'checkpoint' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('detached HEAD');
  });

  it('rejects when there are no changes', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'local/liminal-runtime\n' }) // branch
      .mockResolvedValueOnce({ stdout: '' }); // git status --short

    const result = await tool.execute({ message: 'checkpoint' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no changes to checkpoint');
  });

  it('creates a local checkpoint commit with metadata', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'local/liminal-runtime\n' }) // branch
      .mockResolvedValueOnce({ stdout: ' M src/file.ts\n?? notes.md\n' }) // status
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // npm run build
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add -A
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
      .mockResolvedValueOnce({ stdout: 'abcdef1234567890\n' }); // rev-parse

    const result = await tool.execute({
      message: 'save verified progress',
      taskId: 'tui-self-123',
      verifyBuild: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      commitHash: 'abcdef1234567890',
      shortHash: 'abcdef12',
      branch: 'local/liminal-runtime',
      filesChanged: 2,
      buildVerified: true,
    });
    expect(mockExecFile).toHaveBeenCalledWith('git', ['add', '-A'], expect.any(Object));
    expect(mockExecFile).toHaveBeenCalledWith('git', ['commit', '-m', expect.stringContaining('[tui-self-123] save verified progress')], expect.any(Object));
  });

  it('can skip build verification when verifyBuild is false', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'local/liminal-runtime\n' }) // branch
      .mockResolvedValueOnce({ stdout: ' M src/file.ts\n' }) // status
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git add -A
      .mockResolvedValueOnce({ stdout: '', stderr: '' }) // git commit
      .mockResolvedValueOnce({ stdout: 'abcdef1234567890\n' }); // rev-parse

    const result = await tool.execute({
      message: 'save without build',
      verifyBuild: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.buildVerified).toBe(false);
    expect(mockExecFile).not.toHaveBeenCalledWith('npm', ['run', 'build'], expect.any(Object));
  });
});
