/**
 * Get environment variable with LIMINAL_ prefix
 * @param key - Variable name without LIMINAL_ prefix
 * @returns Value or undefined
 */
export function env(key: string): string | undefined {
  return process.env[`LIMINAL_${key}`];
}
