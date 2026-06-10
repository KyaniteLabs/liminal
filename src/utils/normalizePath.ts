/**
 * Path normalization and containment check.
 * Resolves subPath against baseDir and throws if the result is outside baseDir.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Resolves subPath against baseDir and returns the absolute path.
 * Throws if the resolved path is outside baseDir (path traversal).
 * When baseDir exists, uses realpath so symlinks cannot escape the base.
 *
 * @param baseDir - Allowed base directory (absolute or relative)
 * @param subPath - Path segment(s) to resolve under baseDir
 * @returns Resolved absolute path under baseDir
 * @throws Error if result would be outside baseDir
 */
export function normalizePath(baseDir: string, subPath: string): string {
  const baseAbs = path.resolve(baseDir);
  let baseReal: string;
  try {
    baseReal = fs.realpathSync(baseAbs);
  } catch (realpathError) {
    baseReal = baseAbs;
  }

  // Resolve relative to baseDir
  const full = path.resolve(baseReal, subPath);
  const rel = path.relative(baseReal, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path traversal or escape not allowed');
  }
  return full;
}

/**
 * Resolves a user-facing output/gallery path. Relative paths must stay inside
 * baseDir (same containment as normalizePath). Absolute paths are allowed only
 * inside baseDir or the Sinter home (~/.sinter) — the CLI's default output hub
 * is `~/.sinter/output` (bin/sinter), which is outside cwd by design; any other
 * absolute path is still a traversal error.
 *
 * @param baseDir - Allowed base directory for relative paths (typically cwd)
 * @param userPath - Operator-supplied path (CLI flag or built-in default)
 * @returns Resolved absolute path inside an allowed base
 * @throws Error if the path escapes every allowed base
 */
export function resolveOutputPath(baseDir: string, userPath: string): string {
  if (!path.isAbsolute(userPath)) {
    return normalizePath(baseDir, userPath);
  }
  const target = path.resolve(userPath);
  const allowedBases = [path.resolve(baseDir), path.join(os.homedir(), '.sinter')];
  for (const base of allowedBases) {
    // Compare against both spellings of the base: as given and realpathed
    // (macOS tmpdir is /var/... but realpaths to /private/var/...).
    const candidates = new Set([base]);
    try {
      candidates.add(fs.realpathSync(base));
    } catch {
      // base may not exist yet; the as-given spelling still applies
    }
    for (const candidate of candidates) {
      const rel = path.relative(candidate, target);
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        return target;
      }
    }
  }
  throw new Error('Path traversal or escape not allowed');
}

/**
 * Validates that a name is safe for use as a single path segment (no ".." or path separators).
 * Use for project names, seed strings, and similar user-controlled identifiers.
 */
export function assertSafeSegment(name: string, kind: string = 'name'): void {
  if (name.includes('..')) {
    throw new Error(`${kind} must not contain ".."`);
  }
  if (name.includes(path.sep) || (path.sep !== '/' && name.includes('/'))) {
    throw new Error(`${kind} must not contain path separators`);
  }
}
