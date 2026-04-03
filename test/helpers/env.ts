/**
 * Test environment isolation helpers
 * Prevents test pollution by automatically restoring env vars
 */

/**
 * Run function with temporary environment variables
 * Automatically restores original env after completion
 */
export async function withEnv<T>(
  envVars: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const original: Record<string, string | undefined> = {};
  
  // Backup original values
  for (const key of Object.keys(envVars)) {
    original[key] = process.env[key];
  }
  
  // Set new values
  for (const [key, value] of Object.entries(envVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  
  try {
    return await fn();
  } finally {
    // Restore original values
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Backup current environment
 */
export function backupEnv(): Record<string, string | undefined> {
  return { ...process.env };
}

/**
 * Restore environment from backup
 */
export function restoreEnv(backup: Record<string, string | undefined>): void {
  // Clear current env
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  // Restore from backup
  Object.assign(process.env, backup);
}
