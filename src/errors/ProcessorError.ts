import { LiminalError } from './base.js';

/**
 * Error for batch processor failures.
 * Used when processor function is not set or processing fails.
 */
export class ProcessorError extends LiminalError {
  public readonly jobId?: string;

  constructor(
    message: string,
    options?: ErrorOptions & { jobId?: string }
  ) {
    super(
      message,
      'ERR_PROCESSOR',
      {
        ...(options?.jobId && { jobId: options.jobId }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      },
      { cause: options?.cause instanceof Error ? options.cause : undefined }
    );
    this.jobId = options?.jobId;
  }
}
