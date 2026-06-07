import { SinterError } from './base.js';

/**
 * Error for validation failures.
 * Used when code or content fails validation checks.
 */
export class ValidationError extends SinterError {
  public errors?: string[];

  constructor(
    message: string,
    errors?: string | string[],
    context?: Record<string, unknown>
  ) {
    const errorArray = errors
      ? Array.isArray(errors)
        ? errors
        : [errors]
      : undefined;

    const fullContext = {
      ...context,
      ...(errorArray && { errors: errorArray }),
    };

    super(
      message,
      'ERR_VALIDATION',
      Object.keys(fullContext).length > 0 ? fullContext : undefined
    );

    this.errors = errorArray;
  }
}
