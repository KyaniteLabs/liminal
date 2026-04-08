import { LiminalError } from './base.js';

export class FileDiscoveryError extends LiminalError {
  constructor(
    message: string,
    opts?: { cause?: Error; retryable?: boolean; context?: Record<string, unknown> },
  ) {
    super(message, 'ERR_FILE_DISCOVERY', opts?.context, { cause: opts?.cause, retryable: opts?.retryable });
  }
}
