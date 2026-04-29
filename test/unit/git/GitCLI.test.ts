/**
 * Tests for GitCLI — handleGitCommand and all sub-handlers.
 *
 * Mocks GitService at the boundary and captures Logger/process.exit calls.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const { mockInit, mockIsRepo, mockStatus, mockLog, mockDiff, mockListBranches, mockBranch, mockAddAllAndCommit } = vi.hoisted(() => ({
  mockInit: vi.fn().mockResolvedValue(undefined),
  mockIsRepo: vi.fn().mockResolvedValue(true),
  mockStatus: vi.fn(),
  mockLog: vi.fn().mockResolvedValue([]),
  mockDiff: vi.fn(),
  mockListBranches: vi.fn().mockResolvedValue([]),
  mockBranch: vi.fn(),
  mockAddAllAndCommit: vi.fn(),
}));

vi.mock('../../../src/git/GitService.js', () => ({
  GitService: vi.fn().mockImplementation(function () {
    return {
      init: (...args: unknown[]) => mockInit(...args),
      isRepo: (...args: unknown[]) => mockIsRepo(...args),
      status: (...args: unknown[]) => mockStatus(...args),
      log: (...args: unknown[]) => mockLog(...args),
      diff: (...args: unknown[]) => mockDiff(...args),
      listBranches: (...args: unknown[]) => mockListBranches(...args),
      branch: (...args: unknown[]) => mockBranch(...args),
      addAllAndCommit: (...args: unknown[]) => mockAddAllAndCommit(...args),
    };
  }),
}));

const { mockInfo, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockError: vi.fn(),
}));
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: (...args: unknown[]) => mockInfo(...args),
    error: (...args: unknown[]) => mockError(...args),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockExit = vi.fn().mockImplementation(() => { throw new Error('process.exit'); });
const originalExit = process.exit;

import { handleGitCommand } from '../../../src/git/GitCLI.js';

describe('GitCLI — handleGitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRepo.mockResolvedValue(true);
    mockInit.mockResolvedValue(undefined);
    mockLog.mockResolvedValue([]);
    process.exit = mockExit as any;
  });

  afterAll(() => {
    process.exit = originalExit;
  });

  it('shows help when no subcommand', async () => {
    await handleGitCommand(undefined, []);
    expect(mockInfo).toHaveBeenCalled();
    const helpCall = mockInfo.mock.calls.find((c: unknown[]) => typeof c[1] === 'string' && c[1].includes('Git integration'));
    expect(helpCall).toBeTruthy();
  });

  it('shows help for --help flag', async () => {
    await handleGitCommand('--help', []);
    expect(mockInfo).toHaveBeenCalled();
  });

  it('shows help for help subcommand', async () => {
    await handleGitCommand('help', []);
    expect(mockInfo).toHaveBeenCalled();
  });

  it('exits when not a repo and not init', async () => {
    mockIsRepo.mockResolvedValue(false);
    await expect(handleGitCommand('status', [])).rejects.toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('GitCLI', expect.stringContaining('Not a git repository'));
  });

  it('handles init subcommand', async () => {
    // init skips isRepo check
    await handleGitCommand('init', []);
    expect(mockInit).toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'Initialized git repository');
  });

  it('handles status with clean tree', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { current: 'main', isClean: () => true, staged: [], modified: [], not_added: [], deleted: [] },
    });

    await handleGitCommand('status', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'On branch main');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'Working tree clean');
  });

  it('handles status with staged files', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { current: 'main', isClean: () => false, staged: ['a.ts'], modified: [], not_added: [], deleted: [] },
    });

    await handleGitCommand('status', []);
    const stagedCall = mockInfo.mock.calls.find((c: unknown[]) => c[1] === '\nStaged:');
    expect(stagedCall).toBeTruthy();
  });

  it('handles status with modified files', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { current: 'main', isClean: () => false, staged: [], modified: ['b.ts'], not_added: [], deleted: [] },
    });

    await handleGitCommand('status', []);
    const modCall = mockInfo.mock.calls.find((c: unknown[]) => c[1] === '\nModified:');
    expect(modCall).toBeTruthy();
  });

  it('handles status with untracked files', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { current: 'main', isClean: () => false, staged: [], modified: [], not_added: ['c.ts'], deleted: [] },
    });

    await handleGitCommand('status', []);
    const untrackedCall = mockInfo.mock.calls.find((c: unknown[]) => c[1] === '\nUntracked:');
    expect(untrackedCall).toBeTruthy();
  });

  it('handles status with deleted files', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: { current: 'main', isClean: () => false, staged: [], modified: [], not_added: [], deleted: ['d.ts'] },
    });

    await handleGitCommand('status', []);
    const delCall = mockInfo.mock.calls.find((c: unknown[]) => c[1] === '\nDeleted:');
    expect(delCall).toBeTruthy();
  });

  it('handles status error from GitService', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      error: { message: 'repo corrupted' },
    });

    await handleGitCommand('status', []);
    expect(mockError).toHaveBeenCalledWith('GitCLI', 'Failed to get git status:', 'repo corrupted');
  });

  it('handles status returning null value', async () => {
    mockStatus.mockResolvedValue({
      isOk: () => true,
      isErr: () => false,
      value: null,
    });

    await handleGitCommand('status', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'Unable to get status - repository may have merge conflicts');
  });

  it('handles log with default count', async () => {
    mockLog.mockResolvedValue([
      { hash: 'abc1234567890', date: '2026-04-28T12:00:00', message: 'test commit' },
    ]);

    await handleGitCommand('log', []);
    expect(mockLog).toHaveBeenCalledWith({ maxCount: 10 });
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', expect.stringContaining('abc1234'));
  });

  it('handles log with custom count', async () => {
    mockLog.mockResolvedValue([]);
    await handleGitCommand('log', ['5']);
    expect(mockLog).toHaveBeenCalledWith({ maxCount: 5 });
  });

  it('handles log with no commits', async () => {
    mockLog.mockResolvedValue([]);
    await handleGitCommand('log', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'No commits yet');
  });

  it('handles diff with files changed', async () => {
    mockDiff.mockResolvedValue({
      from: 'HEAD~1',
      to: 'HEAD',
      filesChanged: 2,
      insertions: 10,
      deletions: 5,
      files: [
        { path: 'a.ts', binary: false, insertions: 8, deletions: 3 },
        { path: 'b.png', binary: true, insertions: 0, deletions: 0 },
      ],
    });

    await handleGitCommand('diff', ['HEAD~1', 'HEAD']);
    expect(mockDiff).toHaveBeenCalledWith('HEAD~1', 'HEAD');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', expect.stringContaining('2 files'));
  });

  it('handles diff with no changes', async () => {
    mockDiff.mockResolvedValue({
      from: 'HEAD',
      to: 'HEAD',
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      files: [],
    });

    await handleGitCommand('diff', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'No differences');
  });

  it('handles branch listing', async () => {
    mockListBranches.mockResolvedValue([
      { name: 'main', current: true },
      { name: 'feature', current: false },
    ]);

    await handleGitCommand('branch', []);
    expect(mockListBranches).toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', '* main');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', '  feature');
  });

  it('handles branch creation', async () => {
    mockBranch.mockResolvedValue({ name: 'new-branch' });

    await handleGitCommand('branch', ['new-branch']);
    expect(mockBranch).toHaveBeenCalledWith('new-branch');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', expect.stringContaining('new-branch'));
  });

  it('handles commit with message', async () => {
    mockAddAllAndCommit.mockResolvedValue({ hash: 'deadbeef1234567890', message: 'save work' });

    await handleGitCommand('commit', ['save work']);
    expect(mockAddAllAndCommit).toHaveBeenCalledWith('save work');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', expect.stringContaining('deadbee'));
  });

  it('exits on commit without message', async () => {
    await expect(handleGitCommand('commit', [])).rejects.toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('GitCLI', expect.stringContaining('Commit message required'));
  });

  it('handles timeline', async () => {
    mockLog.mockResolvedValue([
      { hash: 'abc1234567890', date: '2026-04-28T12:00:00', message: 'init' },
    ]);

    await handleGitCommand('timeline', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'Git Timeline:');
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', expect.stringContaining('abc1234'));
  });

  it('handles timeline with no history', async () => {
    mockLog.mockResolvedValue([]);
    await handleGitCommand('timeline', []);
    expect(mockInfo).toHaveBeenCalledWith('GitCLI', 'No history yet');
  });

  it('exits on unknown subcommand', async () => {
    await expect(handleGitCommand('unknown', [])).rejects.toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('GitCLI', 'Unknown git subcommand: unknown');
  });
});
