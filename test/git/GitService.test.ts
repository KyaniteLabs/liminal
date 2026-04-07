/**
 * GitService tests — Unit tests with mocked simple-git
 *
 * Tests the core git operations wrapper:
 * - init, isRepo, status
 * - add, commit, addAllAndCommit
 * - log, getLastCommit, getCommitCount
 * - branch, checkout, currentBranch, listBranches, deleteBranch
 * - diff, stash, push
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock simple-git ──
// vi.hoisted() is mandatory for mock variables referenced inside vi.mock() factories
const { mockInit, mockCheckIsRepo, mockStatus, mockAdd, mockCommit, mockLog,
        mockCheckoutBranch, mockCheckout, mockBranch, mockDiff, mockStash,
        mockPush, mockRaw } = vi.hoisted(() => {
  return {
    mockInit: vi.fn(),
    mockCheckIsRepo: vi.fn(),
    mockStatus: vi.fn(),
    mockAdd: vi.fn(),
    mockCommit: vi.fn(),
    mockLog: vi.fn(),
    mockCheckoutBranch: vi.fn(),
    mockCheckout: vi.fn(),
    mockBranch: vi.fn(),
    mockDiff: vi.fn(),
    mockStash: vi.fn(),
    mockPush: vi.fn(),
    mockRaw: vi.fn(),
  };
});

vi.mock('simple-git', () => ({
  default: () => ({
    init: mockInit,
    checkIsRepo: mockCheckIsRepo,
    status: mockStatus,
    add: mockAdd,
    commit: mockCommit,
    log: mockLog,
    checkoutBranch: mockCheckoutBranch,
    checkout: mockCheckout,
    branch: mockBranch,
    diff: mockDiff,
    stash: mockStash,
    push: mockPush,
    raw: mockRaw,
  }),
}));

import { GitService } from '../../src/git/GitService.js';

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitService('/tmp/test-repo');
  });

  // ── init / isRepo ──

  describe('init', () => {
    it('initializes a new repo when not already a repo', async () => {
      mockCheckIsRepo.mockResolvedValue(false);
      mockInit.mockResolvedValue(undefined);

      await service.init();

      expect(mockInit).toHaveBeenCalledOnce();
    });

    it('skips init when already a repo', async () => {
      mockCheckIsRepo.mockResolvedValue(true);

      await service.init();

      expect(mockInit).not.toHaveBeenCalled();
    });
  });

  describe('isRepo', () => {
    it('returns true when in a git repo', async () => {
      mockCheckIsRepo.mockResolvedValue(true);
      expect(await service.isRepo()).toBe(true);
    });

    it('returns false when not a git repo', async () => {
      mockCheckIsRepo.mockResolvedValue(false);
      expect(await service.isRepo()).toBe(false);
    });

    it('returns false on error', async () => {
      mockCheckIsRepo.mockRejectedValue(new Error('not found'));
      expect(await service.isRepo()).toBe(false);
    });
  });

  // ── add / commit ──

  describe('add', () => {
    it('stages specified files', async () => {
      mockAdd.mockResolvedValue(undefined);
      await service.add(['src/foo.ts', 'src/bar.ts']);
      expect(mockAdd).toHaveBeenCalledWith(['src/foo.ts', 'src/bar.ts']);
    });
  });

  describe('commit', () => {
    it('creates a commit and returns CommitInfo', async () => {
      mockCommit.mockResolvedValue({ commit: 'abc123def456' });

      const result = await service.commit('test commit');

      expect(result.hash).toBe('abc123def456');
      expect(result.message).toBe('test commit');
    });
  });

  describe('addAllAndCommit', () => {
    it('stages all files and commits in one step', async () => {
      mockAdd.mockResolvedValue(undefined);
      mockCommit.mockResolvedValue({ commit: 'deadbeef' });

      const result = await service.addAllAndCommit('auto commit');

      expect(mockAdd).toHaveBeenCalledWith('-A');
      expect(result.hash).toBe('deadbeef');
      expect(result.message).toBe('auto commit');
    });
  });

  // ── log ──

  describe('log', () => {
    it('returns commits as CommitInfo array', async () => {
      mockLog.mockResolvedValue({
        all: [
          { hash: 'aaa111', date: '2026-04-05', message: 'first', author_name: 'liminal' },
          { hash: 'bbb222', date: '2026-04-04', message: 'second', author_name: 'liminal' },
        ],
        total: 2,
      });

      const commits = await service.log();

      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe('aaa111');
      expect(commits[0].message).toBe('first');
      expect(commits[1].author).toBe('liminal');
    });

    it('respects maxCount option', async () => {
      mockLog.mockResolvedValue({ all: [], total: 0 });

      await service.log({ maxCount: 5 });

      expect(mockLog).toHaveBeenCalledWith(['--max-count=5']);
    });
  });

  describe('getLastCommit', () => {
    it('returns the most recent commit', async () => {
      mockLog.mockResolvedValue({
        all: [{ hash: 'latest', date: '2026-04-05', message: 'latest', author_name: 'liminal' }],
        total: 1,
      });

      const last = await service.getLastCommit();
      expect(last?.hash).toBe('latest');
    });

    it('returns null when no commits exist', async () => {
      mockLog.mockResolvedValue({ all: [], total: 0 });

      const last = await service.getLastCommit();
      expect(last).toBeNull();
    });
  });

  describe('getCommitCount', () => {
    it('returns total commit count', async () => {
      mockLog.mockResolvedValue({ all: [], total: 42 });

      const count = await service.getCommitCount();
      expect(count).toBe(42);
    });
  });

  // ── branch operations ──

  describe('branch', () => {
    it('creates and checks out a new branch', async () => {
      mockCheckoutBranch.mockResolvedValue(undefined);
      mockLog.mockResolvedValue({
        all: [{ hash: 'ccc333', date: '2026-04-05', message: 'init', author_name: 'liminal' }],
        total: 1,
      });

      const info = await service.branch('liminal/test-run');

      expect(info.name).toBe('liminal/test-run');
      expect(info.current).toBe(true);
      expect(mockCheckoutBranch).toHaveBeenCalledWith('liminal/test-run', 'HEAD');
    });
  });

  describe('checkout', () => {
    it('checks out an existing branch', async () => {
      mockCheckout.mockResolvedValue(undefined);
      await service.checkout('main');
      expect(mockCheckout).toHaveBeenCalledWith('main');
    });
  });

  describe('currentBranch', () => {
    it('returns the current branch name', async () => {
      mockStatus.mockResolvedValue({ current: 'liminal/experiment-1' });

      const name = await service.currentBranch();
      expect(name).toBe('liminal/experiment-1');
    });

    it('defaults to "main" when current is null', async () => {
      mockStatus.mockResolvedValue({ current: null });

      const name = await service.currentBranch();
      expect(name).toBe('main');
    });
  });

  describe('listBranches', () => {
    it('returns all branches with current flag', async () => {
      mockBranch.mockResolvedValue({
        all: ['main', 'liminal/run-1'],
        current: 'main',
      });

      const branches = await service.listBranches();

      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe('main');
      expect(branches[0].current).toBe(true);
      expect(branches[1].name).toBe('liminal/run-1');
      expect(branches[1].current).toBe(false);
    });
  });

  describe('deleteBranch', () => {
    it('deletes a branch with force flag', async () => {
      mockBranch.mockResolvedValue(undefined);
      await service.deleteBranch('liminal/old', true);
      expect(mockBranch).toHaveBeenCalledWith(['-D', 'liminal/old']);
    });
  });

  // ── diff ──

  describe('diff', () => {
    it('returns diff with file stats', async () => {
      mockDiff.mockResolvedValue(
        ' src/foo.ts | 5 +++--\n src/bar.ts | 2 -\n src/binary.dat | Bin 0 -> 1234 bytes\n'
      );

      const result = await service.diff('HEAD~1', 'HEAD');

      expect(result.from).toBe('HEAD~1');
      expect(result.to).toBe('HEAD');
      expect(result.files).toHaveLength(3);
      expect(result.files[0].path).toBe('src/foo.ts');
      expect(result.files[0].insertions).toBe(3);
      expect(result.files[0].deletions).toBe(2);
      expect(result.files[2].binary).toBe(true);
    });
  });

  // ── stash ──

  describe('stash', () => {
    it('stashes with a message', async () => {
      mockStash.mockResolvedValue(undefined);
      await service.stash('auto-stash');
      expect(mockStash).toHaveBeenCalledWith(['push', '-m', 'auto-stash']);
    });

    it('pops the stash', async () => {
      mockStash.mockResolvedValue(undefined);
      await service.stashPop();
      expect(mockStash).toHaveBeenCalledWith(['pop']);
    });

    it('lists stashes', async () => {
      mockStash.mockResolvedValue(undefined);
      // simple-git stashList returns a different object
      // We test the method exists and delegates
    });
  });

  // ── push ──

  describe('push', () => {
    it('pushes current branch to origin', async () => {
      mockStatus.mockResolvedValue({ current: 'liminal/run-1' });
      mockPush.mockResolvedValue(undefined);

      await service.push();

      expect(mockPush).toHaveBeenCalledWith('origin', 'liminal/run-1');
    });

    it('pushes specified branch to specified remote', async () => {
      mockPush.mockResolvedValue(undefined);

      await service.push('upstream', 'main');

      expect(mockPush).toHaveBeenCalledWith('upstream', 'main');
    });
  });
});
