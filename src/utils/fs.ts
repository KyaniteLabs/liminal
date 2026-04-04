/**
 * File system utilities for directory creation and file writing.
 * Extracted from duplicate patterns across the codebase.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Format error message with context
 */
function formatFsError(context: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return `${context}: ${message}`;
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 * No-op if directory already exists.
 * @throws Error if directory creation fails
 */
export function ensureDir(dir: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw new Error(formatFsError('Failed to create directory', error), { cause: error });
  }
}

/**
 * Ensure a directory exists (async version).
 * No-op if directory already exists.
 * @throws Error if directory creation fails
 */
export async function ensureDirAsync(dir: string): Promise<void> {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (error) {
    throw new Error(formatFsError('Failed to create directory', error), { cause: error });
  }
}

/**
 * Write a file, ensuring the parent directory exists first.
 * @throws Error if write fails
 */
export function writeFileEnsuringDir(filePath: string, content: string): void {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(formatFsError('Failed to write file', error), { cause: error });
  }
}

/**
 * Write a file async, ensuring the parent directory exists first.
 * @throws Error if write fails
 */
export async function writeFileEnsuringDirAsync(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirAsync(path.dirname(filePath));
    await fs.promises.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(formatFsError('Failed to write file', error), { cause: error });
  }
}
