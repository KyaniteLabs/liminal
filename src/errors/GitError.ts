import { SinterError } from './base.js';

export class GitError extends SinterError {
  constructor(
    message: string,
    opts?: { cause?: Error; retryable?: boolean; context?: Record<string, unknown> },
  ) {
    super(message, 'ERR_GIT', opts?.context, { cause: opts?.cause, retryable: opts?.retryable });
  }
}

export class GitRepoError extends GitError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: false });
  }
}

export class GitCommitError extends GitError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: false });
  }
}

export class GitPushError extends GitError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: true });
  }
}

export class GitStashError extends GitError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: true });
  }
}
