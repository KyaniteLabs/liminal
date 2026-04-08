import { LiminalError } from './base.js';

/**
 * Error for server operation failures.
 * Used when preview server fails to start, stop, or handle requests.
 */
export class ServerError extends LiminalError {
  public readonly port?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    options?: ErrorOptions & { port?: number; endpoint?: string }
  ) {
    super(
      message,
      'ERR_SERVER',
      {
        ...(options?.port && { port: options.port }),
        ...(options?.endpoint && { endpoint: options.endpoint }),
        ...(options?.cause instanceof Error && { causeMessage: options.cause.message }),
      },
      { cause: options?.cause instanceof Error ? options.cause : undefined }
    );
    this.port = options?.port;
    this.endpoint = options?.endpoint;
  }
}
