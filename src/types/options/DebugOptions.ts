/**
 * DebugOptions - Configuration for debugging, logging, and diagnostics
 *
 * Extracted from LoopOptions to reduce interface size and improve
 * modularity. These options control observability and troubleshooting
 * capabilities during generation loops.
 */

/**
 * Log level for controlling output verbosity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Debug and diagnostics configuration options
 */
export interface DebugOptions {
  /** Log level - controls verbosity of output */
  logLevel?: LogLevel;
  /** Enable telemetry collection for performance monitoring */
  telemetry?: boolean;
  /** Save intermediate outputs for debugging */
  saveIntermediate?: boolean;
  /** Output directory for debug files */
  debugOutputDir?: string;
  /** Enable verbose mode - shorthand for logLevel: 'debug' */
  verbose?: boolean;
}

/**
 * Default debug options
 */
export const DEFAULT_DEBUG_OPTIONS: Required<DebugOptions> = {
  logLevel: 'warn',
  telemetry: false,
  saveIntermediate: false,
  debugOutputDir: '.debug',
  verbose: false,
};

/**
 * Normalize debug options with defaults
 */
export function normalizeDebugOptions(
  options?: DebugOptions | null
): Required<DebugOptions> {
  // If verbose is true, override logLevel to debug
  const logLevel = options?.verbose ? 'debug' : (options?.logLevel ?? DEFAULT_DEBUG_OPTIONS.logLevel);
  
  return {
    logLevel,
    telemetry: options?.telemetry ?? DEFAULT_DEBUG_OPTIONS.telemetry,
    saveIntermediate: options?.saveIntermediate ?? DEFAULT_DEBUG_OPTIONS.saveIntermediate,
    debugOutputDir: options?.debugOutputDir ?? DEFAULT_DEBUG_OPTIONS.debugOutputDir,
    verbose: options?.verbose ?? DEFAULT_DEBUG_OPTIONS.verbose,
  };
}

/**
 * Check if a given log level should be logged based on current level
 */
export function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel): boolean {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  return levels[messageLevel] >= levels[currentLevel];
}
