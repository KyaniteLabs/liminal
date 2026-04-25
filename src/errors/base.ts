/**
 * Base error class for all Liminal errors.
 * Provides structured error information with codes, context, cause chaining, and retryability.
 */
export class LiminalError extends Error {
  public readonly retryable: boolean;

  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
    opts?: { cause?: Error; retryable?: boolean },
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = this.constructor.name;
    this.retryable = opts?.retryable ?? false;
  }
}
