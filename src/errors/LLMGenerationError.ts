import { LiminalError } from './base.js';

/**
 * Error for LLM generation failures.
 * Includes context about the model, provider, upstream endpoint/status, and
 * request duration for debugging.
 */
export class LLMGenerationError extends LiminalError {
  public readonly model?: string;
  public readonly provider?: string;
  public readonly endpoint?: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly responseBody?: string;
  public readonly duration?: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    options?: ErrorOptions & {
      model?: string;
      provider?: string;
      endpoint?: string;
      statusCode?: number;
      retryable?: boolean;
      responseBody?: string;
      duration?: number;
    }
  ) {
    super(
      message,
      'ERR_LLM_GENERATION',
      {
        ...(options?.model && { model: options.model }),
        ...(options?.provider && { provider: options.provider }),
        ...(options?.endpoint && { endpoint: options.endpoint }),
        ...(options?.statusCode !== undefined && { statusCode: options.statusCode }),
        ...(options?.retryable !== undefined && { retryable: options.retryable }),
        ...(options?.responseBody && { responseBody: options.responseBody }),
        ...(options?.duration && { duration: options.duration }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      },
      {
        cause: options?.cause instanceof Error ? options.cause : undefined,
        retryable: options?.retryable,
      }
    );
    this.model = options?.model;
    this.provider = options?.provider;
    this.endpoint = options?.endpoint;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    this.responseBody = options?.responseBody;
    this.duration = options?.duration;
    this.cause = options?.cause instanceof Error ? options.cause : undefined;
  }
}
