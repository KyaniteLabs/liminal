import { SinterError } from './base.js';

export class FileDiscoveryError extends SinterError {
  constructor(
    message: string,
    opts?: { cause?: Error; retryable?: boolean; context?: Record<string, unknown> },
  ) {
    super(message, 'ERR_FILE_DISCOVERY', opts?.context, { cause: opts?.cause, retryable: opts?.retryable });
  }
}
