/**
 * CompostHeap — manages the raw input heap for the Compost Mill.
 * Handles file intake, size tracking, and capacity monitoring.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';
import type { CompostConfig } from './types.js';

export class CompostHeap {
  private heapDir: string;
  private maxHeapSizeBytes: number;

  constructor(config: Partial<CompostConfig> & Pick<CompostConfig, 'heapDir'>) {
    this.heapDir = config.heapDir;
    this.maxHeapSizeBytes = config.maxHeapSizeBytes ?? 50 * 1024 * 1024;
  }

  /** Ensure the heap directory exists. */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.heapDir, { recursive: true });
  }

  /** Copy a single file into the heap. Returns the heap path. */
  async addFile(srcPath: string): Promise<string> {
    await this.ensureDir();
    const destPath = path.join(this.heapDir, path.basename(srcPath));
    await fs.copyFile(srcPath, destPath);
    return destPath;
  }

  /** Recursively copy a directory into the heap. Returns array of heap paths. */
  async addDirectory(srcPath: string): Promise<string[]> {
    await this.ensureDir();
    const destBase = path.join(this.heapDir, path.basename(srcPath));
    const results: string[] = [];

    await this.copyDirRecursive(srcPath, destBase, results);
    return results;
  }

  private async copyDirRecursive(src: string, dest: string, results: string[]): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcEntry = path.join(src, entry.name);
      const destEntry = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcEntry, destEntry, results);
      } else {
        await fs.copyFile(srcEntry, destEntry);
        results.push(destEntry);
      }
    }
  }

  /** Return total bytes of all files in the heap. */
  async getHeapSize(): Promise<number> {
    await this.ensureDir();
    const files = await this.listFiles();
    let total = 0;
    for (const relPath of files) {
      const stat = await fs.stat(path.join(this.heapDir, relPath));
      total += stat.size;
    }
    return total;
  }

  /** Return true when heap exceeds 80% of maxHeapSizeBytes. */
  async isOverCapacity(): Promise<boolean> {
    const size = await this.getHeapSize();
    return size > this.maxHeapSizeBytes * 0.8;
  }

  /** Return relative paths of all files in the heap. */
  async listFiles(): Promise<string[]> {
    await this.ensureDir();
    const results: string[] = [];
    await this.walkDir(this.heapDir, '', results);
    return results;
  }

  private async walkDir(dir: string, prefix: string, results: string[]): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.warn('[CompostHeap] walkDir failed:', err);
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await this.walkDir(path.join(dir, entry.name), relPath, results);
      } else {
        results.push(relPath);
      }
    }
  }

  /** Remove all files from the heap. */
  async clear(): Promise<void> {
    await this.ensureDir();
    const files = await this.listFiles();
    for (const relPath of files) {
      await fs.unlink(path.join(this.heapDir, relPath));
    }
  }

  /** Purge heap contents (alias for clear — used after digest). */
  async purge(): Promise<void> {
    await this.clear();
  }
}
