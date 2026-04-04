/**
 * Logger — Simple structured logging with configurable log level.
 *
 * Levels: debug < info < warn < error
 * Set LIMINAL_LOG_LEVEL env var to control verbosity (default: warn).
 * All messages are prefixed with [context] for easy grepping.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (): LogLevel => {
  const env = process.env.LIMINAL_LOG_LEVEL?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) return env as LogLevel;
  return 'warn';
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel()];
}

function formatMessage(context: string, message: string): string {
  return `[${context}] ${message}`;
}

export const Logger = {
  debug(context: string, message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) console.debug(formatMessage(context, message), ...args); // eslint-disable-line no-console
  },

  info(context: string, message: string, ...args: unknown[]): void {
    if (shouldLog('info')) console.log(formatMessage(context, message), ...args); // eslint-disable-line no-console
  },

  warn(context: string, message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(formatMessage(context, message), ...args); // eslint-disable-line no-console
  },

  error(context: string, message: string, ...args: unknown[]): void {
    if (shouldLog('error')) console.error(formatMessage(context, message), ...args);
  },
};
