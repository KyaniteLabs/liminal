import { LiminalError } from './base.js';

/**
 * Error for export operation failures.
 * Used when HTML, JS, ZIP, or video export fails.
 */
export class ExportError extends LiminalError {
  public readonly path?: string;
  public readonly format?: string;

  constructor(
    message: string,
    options?: ErrorOptions & { path?: string; format?: string }
  ) {
    super(
      message,
      'ERR_EXPORT',
      {
        ...(options?.path && { path: options.path }),
        ...(options?.format && { format: options.format }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      },
      { cause: options?.cause instanceof Error ? options.cause : undefined }
    );
    this.path = options?.path;
    this.format = options?.format;
  }
}

/**
 * Error for security-related failures during export.
 * Used for path traversal detection and validation failures.
 */
export class SecurityError extends LiminalError {
  public readonly path?: string;
  public readonly reason?: string;

  constructor(
    message: string,
    options?: ErrorOptions & { path?: string; reason?: string }
  ) {
    super(
      message,
      'ERR_SECURITY',
      {
        ...(options?.path && { path: options.path }),
        ...(options?.reason && { reason: options.reason }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      },
      { cause: options?.cause instanceof Error ? options.cause : undefined }
    );
    this.path = options?.path;
    this.reason = options?.reason;
  }
}
