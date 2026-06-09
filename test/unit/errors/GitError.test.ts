import { describe, it, expect } from 'vitest';
import { GitError, GitRepoError, GitCommitError, GitPushError, GitStashError } from '../../../src/errors/GitError.js';

describe('GitError', () => {
  it('creates error with message', () => {
    const err = new GitError('something failed');
    expect(err.message).toBe('something failed');
    expect(err.code).toBe('ERR_GIT');
    expect(err).toBeInstanceOf(GitError);
  });

  it('accepts cause and retryable options', () => {
    const cause = new Error('root cause');
    const err = new GitError('push failed', { cause, retryable: true });
    expect(err.cause).toBe(cause);
    expect(err.retryable).toBe(true);
  });

  it('accepts context', () => {
    const err = new GitError('context test', { context: { branch: 'main', attempt: 3 } });
    expect(err.context).toEqual({ branch: 'main', attempt: 3 });
  });

  it('defaults retryable to false when not specified', () => {
    const err = new GitError('no opts');
    expect(err.retryable).toBe(false);
  });
});

describe('GitRepoError', () => {
  it('creates non-retryable error', () => {
    const err = new GitRepoError('repo not found');
    expect(err).toBeInstanceOf(GitError);
    expect(err.retryable).toBe(false);
    expect(err.message).toBe('repo not found');
  });

  it('accepts cause and context', () => {
    const cause = new Error('ENOENT');
    const err = new GitRepoError('missing', { cause, context: { path: '/repo' } });
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ path: '/repo' });
    expect(err.retryable).toBe(false);
  });
});

describe('GitCommitError', () => {
  it('creates non-retryable error', () => {
    const err = new GitCommitError('commit failed');
    expect(err).toBeInstanceOf(GitError);
    expect(err.retryable).toBe(false);
  });
});

describe('GitPushError', () => {
  it('creates retryable error', () => {
    const err = new GitPushError('push rejected');
    expect(err).toBeInstanceOf(GitError);
    expect(err.retryable).toBe(true);
  });

  it('accepts cause', () => {
    const cause = new Error('network timeout');
    const err = new GitPushError('push timeout', { cause });
    expect(err.cause).toBe(cause);
    expect(err.retryable).toBe(true);
  });
});

describe('GitStashError', () => {
  it('creates retryable error', () => {
    const err = new GitStashError('stash failed');
    expect(err).toBeInstanceOf(GitError);
    expect(err.retryable).toBe(true);
  });
});
