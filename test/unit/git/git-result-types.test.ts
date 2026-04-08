import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Result } from 'neverthrow';

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockSimpleGit, mockStatus, mockCheckIsRepo, mockCheckoutBranch, mockStash, mockAdd, mockCommit, mockLog } = vi.hoisted(() => {
  const status = vi.fn();
  const checkIsRepo = vi.fn();
  const checkoutBranch = vi.fn();
  const stash = vi.fn();
  const add = vi.fn();
  const commit = vi.fn();
  const log = vi.fn();
  const simpleGit = vi.fn(() => ({
    status,
    checkIsRepo,
    checkoutBranch,
    stash,
    add,
    commit,
    log,
    branch: vi.fn(),
    checkout: vi.fn(),
    diff: vi.fn(),
    push: vi.fn(),
    stashList: vi.fn(),
  }));
  return {
    mockSimpleGit: simpleGit,
    mockStatus: status,
    mockCheckIsRepo: checkIsRepo,
    mockCheckoutBranch: checkoutBranch,
    mockStash: stash,
    mockAdd: add,
    mockCommit: commit,
    mockLog: log,
  };
});

vi.mock('simple-git', () => ({
  default: mockSimpleGit,
}));

// ── Imports (after mock setup) ────────────────────────────────────────

import { GitService } from '../../../src/git/GitService.js';
import { GitIntegration } from '../../../src/git/GitIntegration.js';
import { CompostBridge } from '../../../src/git/CompostBridge.js';
import { GitError } from '../../../src/errors/GitError.js';
import { CompostError } from '../../../src/errors/CompostError.js';
import type { EventStore, CompostEvent } from '../../../src/compost/EventStore.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeFakeStatus(overrides: Record<string, unknown> = {}) {
  return {
    current: 'main',
    isClean: () => true,
    ...overrides,
  };
}

// ── GitService.status() ───────────────────────────────────────────────

describe('GitService.status()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok with status object that has isClean()', async () => {
    const fakeStatus = makeFakeStatus({ current: 'feature', isClean: () => false });
    mockStatus.mockResolvedValue(fakeStatus);

    const service = new GitService('/tmp/test-repo');
    const result = await service.status();

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.current).toBe('feature');
      expect(result.value.isClean()).toBe(false);
    }
  });

  it('returns err(GitError) when simple-git throws', async () => {
    mockStatus.mockRejectedValue(new Error('not a git repo'));

    const service = new GitService('/tmp/nonexistent');
    const result = await service.status();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GitError);
      expect(result.error.message).toBe('status failed');
      expect(result.error.retryable).toBe(true);
    }
  });
});

// ── GitService.currentBranch() ────────────────────────────────────────

describe('GitService.currentBranch()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns branch name from status ok', async () => {
    mockStatus.mockResolvedValue(makeFakeStatus({ current: 'develop' }));

    const service = new GitService('/tmp/test-repo');
    const branch = await service.currentBranch();

    expect(branch).toBe('develop');
  });

  it('returns "main" when status errors', async () => {
    mockStatus.mockRejectedValue(new Error('broken'));

    const service = new GitService('/tmp/test-repo');
    const branch = await service.currentBranch();

    expect(branch).toBe('main');
  });
});

// ── GitIntegration.startRun() ─────────────────────────────────────────

describe('GitIntegration.startRun()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok(branchName) on success', async () => {
    mockCheckIsRepo.mockResolvedValue(true);
    mockStatus.mockResolvedValue(makeFakeStatus());
    mockCheckoutBranch.mockResolvedValue(undefined);
    mockLog.mockResolvedValue({ all: [{ hash: 'abc123', date: '', message: '', author_name: '' }], total: 1 });

    const git = new GitIntegration({ enabled: true, branchPerRun: true });
    const result = await git.startRun('test-project');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toContain('liminal/test-project-');
      expect(result.value.length).toBeGreaterThan(10);
    }
  });

  it('returns ok("") when disabled', async () => {
    const git = new GitIntegration({ enabled: false, branchPerRun: true });
    const result = await git.startRun('test-project');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('');
    }
  });

  it('returns err when not a git repo', async () => {
    mockCheckIsRepo.mockResolvedValue(false);

    const git = new GitIntegration({ enabled: true, branchPerRun: true });
    const result = await git.startRun('test-project');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GitError);
      expect(result.error.message).toBe('Not a git repo');
      expect(result.error.retryable).toBe(false);
    }
  });
});

// ── GitIntegration.commitIteration() ──────────────────────────────────

describe('GitIntegration.commitIteration()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok(commit) on success', async () => {
    mockCheckIsRepo.mockResolvedValue(true);
    mockAdd.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue({ commit: 'deadbeef', author: 'liminal' });
    mockStatus.mockResolvedValue(makeFakeStatus());

    const git = new GitIntegration({ enabled: true, autoCommit: true });
    const result = await git.commitIteration({
      prompt: 'create a shader',
      score: 0.85,
      iteration: 3,
      code: 'void main() {}',
      filePath: '/tmp/output.glsl',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.hash).toBe('deadbeef');
      expect(result.value.message).toContain('shader');
      expect(result.value.message).toContain('0.85');
    }
  });

  it('returns err when git integration disabled', async () => {
    const git = new GitIntegration({ enabled: false, autoCommit: true });
    const result = await git.commitIteration({
      prompt: 'test',
      score: 0.5,
      iteration: 1,
      code: 'x',
      filePath: '/tmp/out.txt',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GitError);
      expect(result.error.retryable).toBe(false);
    }
  });

  it('returns err when not a git repo', async () => {
    mockCheckIsRepo.mockResolvedValue(false);

    const git = new GitIntegration({ enabled: true, autoCommit: true });
    const result = await git.commitIteration({
      prompt: 'test',
      score: 0.5,
      iteration: 1,
      code: 'x',
      filePath: '/tmp/out.txt',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(GitError);
      expect(result.error.retryable).toBe(false);
    }
  });
});

// ── CompostBridge.onCommit() ──────────────────────────────────────────

describe('CompostBridge.onCommit()', () => {
  it('returns ok(event) when EventStore succeeds', async () => {
    const fakeEvent: CompostEvent = {
      id: 1,
      type: 'git_commit',
      payload: { hash: 'abc123', message: 'test commit' },
      timestamp: new Date().toISOString(),
      branch: 'main',
      payloadHash: 'sha256hash',
    };
    const mockEventStore = {
      append: vi.fn().mockReturnValue(fakeEvent),
      timeline: vi.fn(),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = await bridge.onCommit({
      hash: 'abc123',
      date: new Date().toISOString(),
      message: 'test commit',
      author: 'liminal',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe(1);
      expect(result.value.type).toBe('git_commit');
      expect(result.value.payload.hash).toBe('abc123');
    }
  });

  it('returns err(CompostError) when EventStore throws', async () => {
    const mockEventStore = {
      append: vi.fn().mockImplementation(() => { throw new Error('db locked'); }),
      timeline: vi.fn(),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = await bridge.onCommit({
      hash: 'abc123',
      date: new Date().toISOString(),
      message: 'test',
      author: 'liminal',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CompostError);
      expect(result.error.retryable).toBe(true);
    }
  });
});

// ── CompostBridge.onBranch() ──────────────────────────────────────────

describe('CompostBridge.onBranch()', () => {
  it('returns ok(event) when EventStore succeeds', async () => {
    const fakeEvent: CompostEvent = {
      id: 2,
      type: 'git_branch',
      payload: { name: 'feature-x', current: true },
      timestamp: new Date().toISOString(),
      branch: 'main',
      payloadHash: 'sha256hash',
    };
    const mockEventStore = {
      append: vi.fn().mockReturnValue(fakeEvent),
      timeline: vi.fn(),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = await bridge.onBranch({
      name: 'feature-x',
      current: true,
      commit: 'deadbeef',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe(2);
      expect(result.value.type).toBe('git_branch');
      expect(result.value.payload.name).toBe('feature-x');
    }
  });

  it('returns err(CompostError) when EventStore throws', async () => {
    const mockEventStore = {
      append: vi.fn().mockImplementation(() => { throw new Error('corrupted'); }),
      timeline: vi.fn(),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = await bridge.onBranch({
      name: 'feature-x',
      current: true,
      commit: 'deadbeef',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CompostError);
      expect(result.error.retryable).toBe(true);
    }
  });
});

// ── CompostBridge.getUnifiedTimeline() ────────────────────────────────

describe('CompostBridge.getUnifiedTimeline()', () => {
  it('returns ok(entries) with correct source mapping', () => {
    const mockEventStore = {
      append: vi.fn(),
      timeline: vi.fn().mockReturnValue([
        {
          event: { type: 'git_commit', timestamp: '2026-01-01T00:00:00Z', payload: { hash: 'a1' } },
          description: 'commit',
          deltaMs: null,
        },
        {
          event: { type: 'heap_add', timestamp: '2026-01-01T00:01:00Z', payload: { files: 5 } },
          description: 'heap add',
          deltaMs: 60000,
        },
      ]),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = bridge.getUnifiedTimeline('test-project');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].source).toBe('git');
      expect(result.value[0].type).toBe('git_commit');
      expect(result.value[1].source).toBe('compost');
      expect(result.value[1].type).toBe('heap_add');
    }
  });

  it('returns err when EventStore throws', () => {
    const mockEventStore = {
      append: vi.fn(),
      timeline: vi.fn().mockImplementation(() => { throw new Error('disk error'); }),
    } as unknown as EventStore;

    const bridge = new CompostBridge(mockEventStore);
    const result = bridge.getUnifiedTimeline('test-project');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CompostError);
    }
  });
});
