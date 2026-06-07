import { SinterError } from './base.js';

export class PersistenceError extends SinterError {
  constructor(
    message: string,
    opts?: { cause?: Error; retryable?: boolean; context?: Record<string, unknown> },
  ) {
    super(message, 'ERR_PERSISTENCE', opts?.context, { cause: opts?.cause, retryable: opts?.retryable });
  }
}
