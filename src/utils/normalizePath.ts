/**
 * Path normalization and containment check.
 * Resolves subPath against baseDir and throws if the result is outside baseDir.
 */

import path from 'path';
import fs from 'fs';

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
