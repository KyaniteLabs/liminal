/**
 * File system utilities for directory creation and file writing.
 * Extracted from duplicate patterns across the codebase.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensure a directory exists, creating it recursively if needed.
 * No-op if directory already exists.
 */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Ensure a directory exists (async version).
 * No-op if directory already exists.
 */
export async function ensureDirAsync(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * Write a file, ensuring the parent directory exists first.
 */
export function writeFileEnsuringDir(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Write a file async, ensuring the parent directory exists first.
 */
export async function writeFileEnsuringDirAsync(filePath: string, content: string): Promise<void> {
  await ensureDirAsync(path.dirname(filePath));
  await fs.promises.writeFile(filePath, content, 'utf-8');
}
