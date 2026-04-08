import { LiminalError } from './base.js';

/**
 * Error for LLM generation failures.
 * Includes context about the model and request duration for debugging.
 */
export class LLMGenerationError extends LiminalError {
  public readonly model?: string;
  public readonly duration?: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    options?: ErrorOptions & { model?: string; duration?: number }
  ) {
    super(
      message,
      'ERR_LLM_GENERATION',
      {
        ...(options?.model && { model: options.model }),
        ...(options?.duration && { duration: options.duration }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      }
    );
    this.model = options?.model;
    this.duration = options?.duration;
    this.cause = options?.cause instanceof Error ? options.cause : undefined;
  }
}
