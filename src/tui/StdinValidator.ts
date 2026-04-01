/**
 * StdinValidator - Detects if stdin is suitable for interactive TUI
 * 
 * Problem: Ink (React TUI library) requires stdin to be a TTY for raw mode.
 * When stdin is piped, redirected, or /dev/null, Ink throws an error.
 * 
 * This module provides early detection to fail fast with a helpful message.
 */

export interface StdinValidationResult {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

/**
 * Check if stdin is a TTY (terminal)
 */
export function isStdinTTY(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Check if stdin is /dev/null (common in detached processes)
 */
export async function isStdinDevNull(): Promise<boolean> {
  try {
    // Use dynamic import to avoid issues in test environments
    const { realpath } = await import('fs/promises');
    const stdinPath = await realpath(`/dev/fd/${process.stdin.fd}`);
    return stdinPath === '/dev/null';
  } catch {
    // If we can't determine, assume it's not /dev/null
    return false;
  }
}

/**
 * Validate stdin is suitable for interactive TUI
 * Throws error if not valid
 */
export async function validateStdin(): Promise<void> {
  // Check 1: Is it a TTY?
  if (!isStdinTTY()) {
    const isDevNull = await isStdinDevNull();
    
    if (isDevNull) {
      throw new Error(
        'TUI Error: stdin is /dev/null. ' +
        'The terminal session was detached or stdin was redirected.\n' +
        'Suggestion: Run from an interactive terminal without piping/redirecting stdin.'
      );
    }
    
    throw new Error(
      'TUI Error: stdin is not a TTY (interactive terminal required).\n' +
      'Common causes:\n' +
      '  - Running in CI/CD pipeline\n' +
      '  - Piping input: echo "cmd" | liminal tui\n' +
      '  - Redirecting stdin: liminal tui < /dev/null\n' +
      '  - Detached process (nohup, disown)\n' +
      'Suggestion: Run directly in an interactive terminal: liminal tui'
    );
  }
}

/**
 * Synchronous version for simple checks
 */
export function validateStdinSync(): StdinValidationResult {
  if (!isStdinTTY()) {
    return {
      valid: false,
      reason: 'stdin is not a TTY',
      suggestion: 'Run from an interactive terminal without piping/redirecting',
    };
  }
  
  return { valid: true };
}
