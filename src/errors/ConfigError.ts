import { LiminalError } from './base';

/**
 * Error for configuration-related issues.
 * Used when configuration files are invalid, missing, or contain errors.
 */
export class ConfigError extends LiminalError {
  constructor(
    message: string,
    context?: Record<string, unknown> & { code?: string }
  ) {
    const code = context?.code ?? 'ERR_CONFIG';
    const { code: _, ...restContext } = context ?? {};
    super(message, code, Object.keys(restContext).length > 0 ? restContext : undefined);
  }
}
