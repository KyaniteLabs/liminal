/**
 * Branded environment-variable access.
 *
 * The canonical prefix is SINTER_; the legacy LIMINAL_ prefix is still honored
 * for back-compat. `mirrorBrandEnv()` copies values across the two prefixes so
 * code reading either one (including the direct `process.env.LIMINAL_` reads)
 * works whichever the user set. It runs on module load and is also invoked from
 * the CLI entry after dotenv.
 */

const PREFIXES = ['SINTER_', 'LIMINAL_'] as const;

/**
 * Mirror every branded variable to its counterpart prefix when the counterpart
 * is unset. Idempotent; safe to call multiple times.
 */
export function mirrorBrandEnv(): void {
  for (const key of Object.keys(process.env)) {
    let base: string | undefined;
    if (key.startsWith('SINTER_')) base = key.slice('SINTER_'.length);
    else if (key.startsWith('LIMINAL_')) base = key.slice('LIMINAL_'.length);
    if (!base) continue;
    const value = process.env[key];
    if (value === undefined) continue;
    for (const p of PREFIXES) {
      const counterpart = `${p}${base}`;
      if (process.env[counterpart] === undefined) process.env[counterpart] = value;
    }
  }
}

// Mirror once at import time so the common config paths see both prefixes.
mirrorBrandEnv();

/**
 * Get an environment variable by its un-prefixed key. Prefers the canonical
 * SINTER_ prefix and falls back to the legacy LIMINAL_ prefix.
 * @param key - Variable name without the brand prefix (e.g. 'LLM_BASE_URL')
 * @returns Value or undefined
 */
export function env(key: string): string | undefined {
  return process.env[`SINTER_${key}`] ?? process.env[`LIMINAL_${key}`];
}
