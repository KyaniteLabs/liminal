import { LiminalError } from './base.js';

export class CompostError extends LiminalError {
  constructor(
    message: string,
    opts?: { cause?: Error; retryable?: boolean; context?: Record<string, unknown> },
  ) {
    super(message, 'ERR_COMPOST', opts?.context, { cause: opts?.cause, retryable: opts?.retryable });
  }
}

export class CompostDigestError extends CompostError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: true });
  }
}

export class CompostSoupError extends CompostError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: true });
  }
}

export class CompostStoreError extends CompostError {
  constructor(message: string, opts?: { cause?: Error; context?: Record<string, unknown> }) {
    super(message, { ...opts, retryable: true });
  }
}
