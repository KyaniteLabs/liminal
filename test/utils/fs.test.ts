import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ensureDir, ensureDirAsync, writeFileEnsuringDir, writeFileEnsuringDirAsync } from '../../src/utils/fs.js';

describe('fs utilities', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `liminal-fs-test-${Date.now()}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* cleanup best-effort */ }
  });

  describe('ensureDir', () => {
    it('creates a directory that does not exist', () => {
      ensureDir(tmpDir);
      expect(fs.statSync(tmpDir).isDirectory()).toBe(true);
    });

    it('is a no-op when directory already exists', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      ensureDir(tmpDir);
      expect(fs.statSync(tmpDir).isDirectory()).toBe(true);
    });

    it('creates nested directories recursively', () => {
      const nested = path.join(tmpDir, 'a', 'b', 'c');
      ensureDir(nested);
      expect(fs.statSync(nested).isDirectory()).toBe(true);
    });

    it('throws a descriptive error when target is a file', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, 'blocking-file');
      fs.writeFileSync(filePath, 'blocker');
      expect(() => ensureDir(filePath)).toThrow('Failed to create directory');
    });
  });

  describe('ensureDirAsync', () => {
    it('creates a directory that does not exist', async () => {
      await ensureDirAsync(tmpDir);
      expect(fs.statSync(tmpDir).isDirectory()).toBe(true);
    });

    it('is a no-op when directory already exists', async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      await ensureDirAsync(tmpDir);
      expect(fs.statSync(tmpDir).isDirectory()).toBe(true);
    });

    it('throws a descriptive error on failure', async () => {
      vi.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('Async permission denied'));
      await expect(ensureDirAsync('/no/such/path')).rejects.toThrow('Failed to create directory: Async permission denied');
    });
  });

  describe('writeFileEnsuringDir', () => {
    it('writes a file creating parent directories', () => {
      const filePath = path.join(tmpDir, 'sub', 'dir', 'file.txt');
      writeFileEnsuringDir(filePath, 'hello world');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world');
    });

    it('overwrites an existing file', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, 'file.txt');
      fs.writeFileSync(filePath, 'old content');
      writeFileEnsuringDir(filePath, 'new content');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
    });

    it('throws a descriptive error on write failure', () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const blockingDir = path.join(tmpDir, 'blocking-dir');
      fs.mkdirSync(blockingDir);
      expect(() => writeFileEnsuringDir(blockingDir, 'data')).toThrow('Failed to write file');
    });
  });

  describe('writeFileEnsuringDirAsync', () => {
    it('writes a file creating parent directories', async () => {
      const filePath = path.join(tmpDir, 'sub', 'dir', 'file.txt');
      await writeFileEnsuringDirAsync(filePath, 'async hello');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('async hello');
    });

    it('throws a descriptive error on write failure', async () => {
      vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('Async disk full'));
      const filePath = path.join(tmpDir, 'file.txt');
      fs.mkdirSync(tmpDir, { recursive: true });
      await expect(writeFileEnsuringDirAsync(filePath, 'data')).rejects.toThrow('Failed to write file: Async disk full');
    });
  });
});
