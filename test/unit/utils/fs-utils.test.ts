/**
 * Tests for src/utils/fs.ts — filesystem utility functions.
 * All functions wrap Node fs operations with proper error formatting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the 'fs' and 'path' modules
const mockMkdirSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdir = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  promises: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
}));

vi.mock('path', () => ({
  dirname: (p: string) => {
    const parts = p.split('/');
    parts.pop();
    return parts.join('/');
  },
  join: (...segments: string[]) => segments.join('/'),
}));

import { ensureDir, ensureDirAsync, writeFileEnsuringDir, writeFileEnsuringDirAsync } from '../../../src/utils/fs.js';

describe('fs utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default no-op implementations
    mockMkdirSync.mockReturnValue(undefined);
    mockWriteFileSync.mockReturnValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // ensureDir
  // -------------------------------------------------------------------------

  describe('ensureDir', () => {
    it('creates directory recursively', () => {
      ensureDir('/tmp/test/nested/dir');
      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/test/nested/dir', { recursive: true });
    });

    it('throws formatted error when mkdirSync fails', () => {
      const cause = new Error('EACCES: permission denied');
      mockMkdirSync.mockImplementation(() => { throw cause; });
      try {
        ensureDir('/no/permissions');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Failed to create directory: EACCES: permission denied');
        expect((err as any).cause).toBe(cause);
      }
    });

    it('handles non-Error thrown values', () => {
      mockMkdirSync.mockImplementation(() => { throw 'string error'; });
      try {
        ensureDir('/bad/path');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toBe('Failed to create directory: Unknown error');
      }
    });
  });

  // -------------------------------------------------------------------------
  // ensureDirAsync
  // -------------------------------------------------------------------------

  describe('ensureDirAsync', () => {
    it('creates directory recursively', async () => {
      await ensureDirAsync('/tmp/async/nested/dir');
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/async/nested/dir', { recursive: true });
    });

    it('throws formatted error when async mkdir fails', async () => {
      const cause = new Error('ENOSPC: no space');
      mockMkdir.mockRejectedValue(cause);
      try {
        await ensureDirAsync('/no/space');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toBe('Failed to create directory: ENOSPC: no space');
        expect((err as any).cause).toBe(cause);
      }
    });

    it('handles non-Error rejected values', async () => {
      mockMkdir.mockRejectedValue(42);
      try {
        await ensureDirAsync('/bad/value');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toBe('Failed to create directory: Unknown error');
      }
    });
  });

  // -------------------------------------------------------------------------
  // writeFileEnsuringDir
  // -------------------------------------------------------------------------

  describe('writeFileEnsuringDir', () => {
    it('creates parent directory and writes file', () => {
      writeFileEnsuringDir('/tmp/test/file.txt', 'content');
      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/test', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/test/file.txt', 'content', 'utf-8');
    });

    it('throws formatted error when writeFileSync fails', () => {
      const cause = new Error('disk full');
      mockWriteFileSync.mockImplementation(() => { throw cause; });
      try {
        writeFileEnsuringDir('/tmp/test/fail.txt', 'content');
        expect.unreachable('should have thrown');
      } catch (err) {
        // The outer catch wraps ensureDir+writeFileSync errors as "Failed to write file"
        expect((err as Error).message).toContain('Failed to write file');
      }
    });

    it('throws formatted error when mkdirSync fails', () => {
      const cause = new Error('mkdir failed');
      mockMkdirSync.mockImplementation(() => { throw cause; });
      try {
        writeFileEnsuringDir('/tmp/fail/file.txt', 'content');
        expect.unreachable('should have thrown');
      } catch (err) {
        // ensureDir throws "Failed to create directory", outer catch wraps as "Failed to write file"
        expect((err as Error).message).toContain('Failed to write file');
      }
    });
  });

  // -------------------------------------------------------------------------
  // writeFileEnsuringDirAsync
  // -------------------------------------------------------------------------

  describe('writeFileEnsuringDirAsync', () => {
    it('creates parent directory and writes file asynchronously', async () => {
      await writeFileEnsuringDirAsync('/tmp/test/async.txt', 'async content');
      expect(mockMkdir).toHaveBeenCalledWith('/tmp/test', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith('/tmp/test/async.txt', 'async content', 'utf-8');
    });

    it('throws formatted error when async writeFile fails', async () => {
      const cause = new Error('async write failed');
      mockWriteFile.mockRejectedValue(cause);
      try {
        await writeFileEnsuringDirAsync('/tmp/test/fail.txt', 'content');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect((err as Error).message).toContain('Failed to write file');
      }
    });

    it('throws formatted error when async mkdir fails', async () => {
      const cause = new Error('async mkdir failed');
      mockMkdir.mockRejectedValue(cause);
      try {
        await writeFileEnsuringDirAsync('/tmp/fail/file.txt', 'content');
        expect.unreachable('should have thrown');
      } catch (err) {
        // ensureDirAsync throws, outer catch wraps as "Failed to write file"
        expect((err as Error).message).toContain('Failed to write file');
      }
    });
  });
});
