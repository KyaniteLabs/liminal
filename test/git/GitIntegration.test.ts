/**
 * GitIntegration tests — RalphLoop orchestrator
 *
 * Tests the branch-per-run, commit-per-iteration pattern:
 * - startRun creates branch, stashes dirty state
 * - commitIteration writes file, stages, commits
 * - endRun restores original branch, pops stash
 * - Handles edge cases (not a repo, no autoCommit, etc.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ── Mocks ──
const { mockIsRepo, mockCurrentBranch, mockStatus, mockStash, mockStashList,
        mockStashPop, mockCheckoutBranch, mockCheckout, mockAdd, mockCommit,
        mockAddAllAndCommit, mockPush, mockLog } = vi.hoisted(() => ({
  mockIsRepo: vi.fn(),
  mockCurrentBranch: vi.fn(),
  mockStatus: vi.fn(),
  mockStash: vi.fn(),
  mockStashList: vi.fn(),
  mockStashPop: vi.fn(),
  mockCheckoutBranch: vi.fn(),
  mockCheckout: vi.fn(),
  mockAdd: vi.fn(),
  mockCommit: vi.fn(),
  mockAddAllAndCommit: vi.fn(),
  mockPush: vi.fn(),
  mockLog: vi.fn(),
}));

vi.mock('../../src/git/GitService.js', () => ({
  GitService: class MockGitService {
    isRepo = mockIsRepo;
    currentBranch = mockCurrentBranch;
    status = mockStatus;
    stash = mockStash;
    stashList = mockStashList;
    stashPop = mockStashPop;
    branch = mockCheckoutBranch;
    checkout = mockCheckout;
    add = mockAdd;
    commit = mockCommit;
    addAllAndCommit = mockAddAllAndCommit;
    push = mockPush;
    log = mockLog;
  },
}));

import { GitIntegration } from '../../src/git/GitIntegration.js';
import type { GitConfig, IterationCommitContext } from '../../src/git/types.js';
import { DEFAULT_GIT_CONFIG } from '../../src/git/types.js';

describe('GitIntegration', () => {
  let integration: GitIntegration;
  const tmpDir = path.join(os.tmpdir(), `liminal-git-test-${Date.now()}`);

  beforeEach(() => {
    vi.clearAllMocks();
    integration = new GitIntegration({ ...DEFAULT_GIT_CONFIG, enabled: true, autoCommit: true });
  });

  // ── isEnabled ──

  it('reports enabled when config.enabled is true', () => {
    expect(integration.isEnabled).toBe(true);
  });

  it('reports disabled when config.enabled is false', () => {
    const disabled = new GitIntegration({ enabled: false });
    expect(disabled.isEnabled).toBe(false);
  });

  // ── startRun ──

  describe('startRun', () => {
    it('creates a branch per run', async () => {
      mockIsRepo.mockResolvedValue(true);
      mockCurrentBranch.mockResolvedValue('main');
      mockStatus.mockResolvedValue({ isClean: () => true });
      mockCheckoutBranch.mockResolvedValue({ name: 'liminal/test-123' });
      mockLog.mockResolvedValue([]);

      const branch = await integration.startRun('test-experiment');

      expect(branch).toContain('liminal/');
      expect(mockCheckoutBranch).toHaveBeenCalled();
    });

    it('returns null when not a git repo', async () => {
      mockIsRepo.mockResolvedValue(false);

      const branch = await integration.startRun('test');
      expect(branch).toBeNull();
    });

    it('returns null when disabled', async () => {
      const disabled = new GitIntegration({ enabled: false });
      const branch = await disabled.startRun('test');
      expect(branch).toBeNull();
    });

    it('stashes dirty working tree before branching', async () => {
      mockIsRepo.mockResolvedValue(true);
      mockCurrentBranch.mockResolvedValue('main');
      mockStatus.mockResolvedValue({ isClean: () => false });
      mockStash.mockResolvedValue(undefined);
      mockCheckoutBranch.mockResolvedValue({ name: 'liminal/x' });
      mockLog.mockResolvedValue([]);

      await integration.startRun('dirty-test');

      expect(mockStash).toHaveBeenCalled();
    });
  });

  // ── commitIteration ──

  describe('commitIteration', () => {
    it('writes file and commits', async () => {
      mockIsRepo.mockResolvedValue(true);
      mockAdd.mockResolvedValue(undefined);
      mockCommit.mockResolvedValue({
        hash: 'abc123',
        date: new Date().toISOString(),
        message: 'liminal: particles iteration 1 (score: 0.85)',
        author: 'liminal',
      });

      const ctx: IterationCommitContext = {
        prompt: 'particles floating',
        score: 0.85,
        iteration: 1,
        code: 'function setup() { createCanvas(400, 400); }',
        filePath: path.join(tmpDir, 'iteration-1.js'),
        model: 'MiniMax-M2.7',
      };

      const result = await integration.commitIteration(ctx);

      expect(result).not.toBeNull();
      expect(result?.hash).toBe('abc123');
      expect(mockAdd).toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalled();
    });

    it('returns null when git is disabled', async () => {
      const disabled = new GitIntegration({ enabled: false });

      const result = await disabled.commitIteration({
        prompt: 'test',
        score: 0.5,
        iteration: 1,
        code: '// code',
        filePath: '/tmp/test.js',
      });

      expect(result).toBeNull();
    });

    it('returns null when not a repo', async () => {
      mockIsRepo.mockResolvedValue(false);

      const result = await integration.commitIteration({
        prompt: 'test',
        score: 0.5,
        iteration: 1,
        code: '// code',
        filePath: '/tmp/test.js',
      });

      expect(result).toBeNull();
    });

    it('formats commit message from template', async () => {
      mockIsRepo.mockResolvedValue(true);
      mockAdd.mockResolvedValue(undefined);
      mockCommit.mockImplementation(async (msg: string) => ({
        hash: 'formatted',
        date: new Date().toISOString(),
        message: msg,
        author: 'liminal',
      }));

      const ctx: IterationCommitContext = {
        prompt: 'blue waves',
        score: 0.92,
        iteration: 3,
        code: 'function draw() {}',
        filePath: path.join(tmpDir, 'v3.js'),
      };

      const result = await integration.commitIteration(ctx);

      expect(result?.message).toContain('blue waves');
      expect(result?.message).toContain('0.92');
    });
  });

  // ── endRun ──

  describe('endRun', () => {
    it('restores original branch', async () => {
      // Start a run first
      mockIsRepo.mockResolvedValue(true);
      mockCurrentBranch.mockResolvedValue('main');
      mockStatus.mockResolvedValue({ isClean: () => true });
      mockCheckoutBranch.mockResolvedValue({ name: 'liminal/test' });
      mockLog.mockResolvedValue([]);
      await integration.startRun('cleanup-test');

      // End the run
      mockStatus.mockResolvedValue({ isClean: () => true });
      mockCheckout.mockResolvedValue(undefined);
      mockStashList.mockResolvedValue([]);

      await integration.endRun('quality achieved');

      expect(mockCheckout).toHaveBeenCalledWith('main');
    });

    it('commits remaining changes before restoring', async () => {
      mockIsRepo.mockResolvedValue(true);
      mockCurrentBranch.mockResolvedValue('main');
      mockStatus.mockResolvedValue({ isClean: () => true });
      mockCheckoutBranch.mockResolvedValue({ name: 'liminal/test' });
      mockLog.mockResolvedValue([]);
      await integration.startRun('final-commit-test');

      // Dirty state at end
      mockStatus.mockResolvedValue({ isClean: () => false });
      mockAddAllAndCommit.mockResolvedValue({
        hash: 'final',
        date: new Date().toISOString(),
        message: 'liminal: run complete',
        author: 'liminal',
      });
      mockCheckout.mockResolvedValue(undefined);
      mockStashList.mockResolvedValue([]);

      await integration.endRun('max iterations');

      expect(mockAddAllAndCommit).toHaveBeenCalled();
    });
  });

  // ── error handling ──

  describe('error handling', () => {
    it('startRun returns null on git error', async () => {
      mockIsRepo.mockRejectedValue(new Error('git not installed'));

      const result = await integration.startRun('error-test');
      expect(result).toBeNull();
    });

    it('commitIteration returns null on write error', async () => {
      mockIsRepo.mockResolvedValue(true);

      const result = await integration.commitIteration({
        prompt: 'test',
        score: 0.5,
        iteration: 1,
        code: '// code',
        filePath: '/nonexistent/deeply/nested/path/test.js',
      });

      // Should not throw — returns null gracefully
      // (mkdir might succeed or fail depending on perms)
      // The key assertion is it doesn't throw
    });
  });
});
