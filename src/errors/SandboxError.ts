import { LiminalError } from './base.js';

/**
 * Error for sandbox execution failures.
 * Used when headless browser runs fail or time out.
 */
export class SandboxError extends LiminalError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    opts?: { cause?: Error; retryable?: boolean }
  ) {
    super(
      message,
      'ERR_SANDBOX_FAILURE',
      context,
      opts
    );
  }
}
