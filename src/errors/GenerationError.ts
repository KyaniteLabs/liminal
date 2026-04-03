import { LiminalError } from './base.js';

/**
 * Error for code/content generation failures.
 * Used when LLM generation or template rendering fails.
 */
export class GenerationError extends LiminalError {
  public domain?: string;
  public cause?: Error;

  constructor(
    message: string,
    domain?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    const fullContext = {
      ...context,
      ...(domain && { domain }),
      ...(cause && { cause: cause.message }),
    };

    super(
      message,
      'ERR_GENERATION',
      Object.keys(fullContext).length > 0 ? fullContext : undefined
    );

    this.domain = domain;
    this.cause = cause;
  }
}
