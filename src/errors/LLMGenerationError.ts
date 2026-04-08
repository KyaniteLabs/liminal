import { LiminalError } from './base.js';

/**
 * Error for LLM generation failures.
 * Used when the LLM fails to generate valid code.
 */
export class LLMGenerationError extends LiminalError {
  public model?: string;
  public duration?: number;

  constructor(
    message: string,
    options?: { cause?: Error; model?: string; duration?: number }
  ) {
    const context: Record<string, unknown> = {};
    if (options?.model) {
      context.model = options.model;
    }
    if (options?.duration !== undefined) {
      context.duration = options.duration;
    }

    super(
      message,
      'ERR_LLM_GENERATION',
      Object.keys(context).length > 0 ? context : undefined,
      { cause: options?.cause }
    );

    this.model = options?.model;
    this.duration = options?.duration;
  }
}
