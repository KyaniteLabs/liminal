import { describe, it, expect } from 'vitest';
import {
  SinterError,
  GitError,
  GitRepoError,
  GitPushError,
  CompostError,
  CompostDigestError,
  PersistenceError,
  FileDiscoveryError,
} from '../../../src/errors/index.js';

// ── SinterError base class ──────────────────────────────────────────

describe('SinterError', () => {
  it('sets code, context, retryable, and cause from constructor', () => {
    const cause = new Error('original failure');
    const error = new SinterError('something broke', 'ERR_TEST', { key: 'value' }, { cause, retryable: true });

    expect(error.message).toBe('something broke');
    expect(error.code).toBe('ERR_TEST');
    expect(error.context).toEqual({ key: 'value' });
    expect(error.retryable).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it('defaults retryable to false', () => {
    const error = new SinterError('fail', 'ERR_X');
    expect(error.retryable).toBe(false);
  });

  it('is instanceof Error', () => {
    const error = new SinterError('fail', 'ERR_X');
    expect(error).toBeInstanceOf(Error);
  });

  it('sets name to constructor name', () => {
    const error = new SinterError('fail', 'ERR_X');
    expect(error.name).toBe('SinterError');
  });

  it('works without optional params', () => {
    const error = new SinterError('bare', 'ERR_BARE');
    expect(error.message).toBe('bare');
    expect(error.code).toBe('ERR_BARE');
    expect(error.context).toBeUndefined();
    expect(error.retryable).toBe(false);
  });
});

// ── GitError family ──────────────────────────────────────────────────

describe('GitError', () => {
  it('has code ERR_GIT', () => {
    const error = new GitError('git failed');
    expect(error.code).toBe('ERR_GIT');
  });

  it('defaults retryable to false', () => {
    const error = new GitError('git failed');
    expect(error.retryable).toBe(false);
  });

  it('accepts retryable override', () => {
    const error = new GitError('git failed', { retryable: true });
    expect(error.retryable).toBe(true);
  });

  it('is instanceof SinterError and Error', () => {
    const error = new GitError('git failed');
    expect(error).toBeInstanceOf(SinterError);
    expect(error).toBeInstanceOf(Error);
  });

  it('chains cause', () => {
    const cause = new Error('underlying');
    const error = new GitError('git failed', { cause });
    expect(error.cause).toBe(cause);
  });

  it('accepts context', () => {
    const error = new GitError('git failed', { context: { repo: '/tmp/repo' } });
    expect(error.context).toEqual({ repo: '/tmp/repo' });
  });
});

describe('GitRepoError', () => {
  it('is retryable false', () => {
    const error = new GitRepoError('not a repo');
    expect(error.retryable).toBe(false);
  });

  it('is instanceof GitError and SinterError', () => {
    const error = new GitRepoError('not a repo');
    expect(error).toBeInstanceOf(GitError);
    expect(error).toBeInstanceOf(SinterError);
  });

  it('has code ERR_GIT', () => {
    const error = new GitRepoError('not a repo');
    expect(error.code).toBe('ERR_GIT');
  });
});

describe('GitPushError', () => {
  it('is retryable true', () => {
    const error = new GitPushError('push rejected');
    expect(error.retryable).toBe(true);
  });

  it('is instanceof GitError and SinterError', () => {
    const error = new GitPushError('push rejected');
    expect(error).toBeInstanceOf(GitError);
    expect(error).toBeInstanceOf(SinterError);
  });
});

// ── CompostError family ──────────────────────────────────────────────

describe('CompostError', () => {
  it('has code ERR_COMPOST', () => {
    const error = new CompostError('compost failed');
    expect(error.code).toBe('ERR_COMPOST');
  });

  it('is instanceof SinterError and Error', () => {
    const error = new CompostError('compost failed');
    expect(error).toBeInstanceOf(SinterError);
    expect(error).toBeInstanceOf(Error);
  });

  it('chains cause', () => {
    const cause = new Error('disk full');
    const error = new CompostError('compost failed', { cause });
    expect(error.cause).toBe(cause);
  });
});

describe('CompostDigestError', () => {
  it('is retryable true', () => {
    const error = new CompostDigestError('digest crashed');
    expect(error.retryable).toBe(true);
  });

  it('is instanceof CompostError and SinterError', () => {
    const error = new CompostDigestError('digest crashed');
    expect(error).toBeInstanceOf(CompostError);
    expect(error).toBeInstanceOf(SinterError);
  });
});

// ── PersistenceError ─────────────────────────────────────────────────

describe('PersistenceError', () => {
  it('has code ERR_PERSISTENCE', () => {
    const error = new PersistenceError('write failed');
    expect(error.code).toBe('ERR_PERSISTENCE');
  });

  it('is instanceof SinterError', () => {
    const error = new PersistenceError('write failed');
    expect(error).toBeInstanceOf(SinterError);
  });

  it('respects retryable option', () => {
    const retryable = new PersistenceError('retry', { retryable: true });
    const notRetryable = new PersistenceError('nope');
    expect(retryable.retryable).toBe(true);
    expect(notRetryable.retryable).toBe(false);
  });
});

// ── FileDiscoveryError ───────────────────────────────────────────────

describe('FileDiscoveryError', () => {
  it('has code ERR_FILE_DISCOVERY', () => {
    const error = new FileDiscoveryError('no files found');
    expect(error.code).toBe('ERR_FILE_DISCOVERY');
  });

  it('is instanceof SinterError', () => {
    const error = new FileDiscoveryError('no files found');
    expect(error).toBeInstanceOf(SinterError);
  });

  it('respects retryable option', () => {
    const error = new FileDiscoveryError('scan failed', { retryable: true });
    expect(error.retryable).toBe(true);
  });
});
