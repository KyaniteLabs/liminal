import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Dirent } from 'node:fs';

// --- Mocks ---

const { mockReaddir, mockStat } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: mockReaddir,
    stat: mockStat,
  },
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual('node:path');
  return actual;
});

import { ListDirTool } from '../../../src/harness/tools/ListDirTool.js';

function makeDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
  } as Dirent;
}

describe('ListDirTool', () => {
  let tool: ListDirTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ListDirTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Properties ---

  describe('properties', () => {
    it('has name "listDir"', () => {
      expect(tool.name).toBe('listDir');
    });

    it('has a non-empty description', () => {
      expect(tool.description.length).toBeGreaterThan(0);
    });
  });

  // --- Missing path ---

  describe('missing path', () => {
    it('returns failure when path is empty string', async () => {
      const result = await tool.execute({ path: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('path is required');
    });

    it('returns failure when path is missing', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBe('path is required');
    });

    it('returns failure when path is null', async () => {
      const result = await tool.execute({ path: null });
      expect(result.success).toBe(false);
      expect(result.error).toBe('path is required');
    });
  });

  // --- Path validation ---

  describe('path validation', () => {
    it('returns failure for path outside allowed directories', async () => {
      const result = await tool.execute({ path: '/etc/passwd' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });

    it('returns failure for path traversing above project', async () => {
      const result = await tool.execute({ path: '../../etc' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not allowed');
    });
  });

  // --- Successful listing ---

  describe('successful listing', () => {
    it('lists files and directories', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('src', true),
        makeDirent('index.ts', false),
      ]);
      mockStat.mockResolvedValue({
        size: 1024,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.entries).toHaveLength(2);

      const dirEntry = result.data!.entries.find(e => e.type === 'directory');
      expect(dirEntry!.name).toContain('src');

      const fileEntry = result.data!.entries.find(e => e.type === 'file');
      expect(fileEntry!.name).toContain('index.ts');
      expect(fileEntry!.size).toBe(1024);
      expect(fileEntry!.modified).toBe('2026-04-05T00:00:00.000Z');
    });

    it('counts totalFiles and totalDirs separately', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('dir1', true),
        makeDirent('dir2', true),
        makeDirent('file1.ts', false),
        makeDirent('file2.ts', false),
        makeDirent('file3.ts', false),
      ]);
      mockStat.mockResolvedValue({
        size: 100,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.totalFiles).toBe(3);
      expect(result.data!.totalDirs).toBe(2);
    });

    it('filters to files only when includeDirs is false', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('src', true),
        makeDirent('index.ts', false),
      ]);
      mockStat.mockResolvedValue({
        size: 500,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src', includeDirs: false });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const types = result.data!.entries.map(e => e.type);
      expect(types).not.toContain('directory');
      expect(types).toContain('file');
      // totalDirs still counted even when not in entries
      expect(result.data!.totalDirs).toBe(1);
    });

    it('filters to dirs only when includeFiles is false', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('src', true),
        makeDirent('index.ts', false),
      ]);
      mockStat.mockResolvedValue({
        size: 500,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src', includeFiles: false });

      expect(result.success).toBe(true);
      if (!result.success) return;
      const types = result.data!.entries.map(e => e.type);
      expect(types).not.toContain('file');
      expect(types).toContain('directory');
      // totalFiles still counted even when not in entries
      expect(result.data!.totalFiles).toBe(1);
    });

    it('limits entries to 100', async () => {
      const entries = Array.from({ length: 120 }, (_, i) =>
        makeDirent(`file${i}.ts`, false)
      );
      mockReaddir.mockResolvedValue(entries);
      mockStat.mockResolvedValue({
        size: 100,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.entries.length).toBeLessThanOrEqual(100);
      expect(result.data!.totalFiles).toBe(120); // total still counted
    });
  });

  // --- Recursive listing ---

  describe('recursive listing', () => {
    it('reads subdirectories when recursive is true', async () => {
      // First call: top-level, has a dir
      // Second call: subdirectory, has a file
      mockReaddir
        .mockResolvedValueOnce([makeDirent('sub', true)])
        .mockResolvedValueOnce([makeDirent('nested.ts', false)]);
      mockStat.mockResolvedValue({
        size: 200,
        mtime: new Date('2026-04-05T00:00:00.000Z'),
      });

      const result = await tool.execute({ path: 'src', recursive: true });

      expect(result.success).toBe(true);
      if (!result.success) return;
      // Should have the sub dir and the nested file
      expect(result.data!.entries.length).toBeGreaterThanOrEqual(2);
      expect(mockReaddir).toHaveBeenCalledTimes(2);
    });

    it('does not recurse by default', async () => {
      mockReaddir.mockResolvedValue([makeDirent('sub', true)]);

      await tool.execute({ path: 'src' });

      // Only one readdir call (the top level), no recursion into sub
      expect(mockReaddir).toHaveBeenCalledTimes(1);
    });

    it('stops recursion at depth 2', async () => {
      // depth 0: has dir1, depth 1: has dir2, depth 2: has dir3 (should NOT recurse into)
      mockReaddir
        .mockResolvedValueOnce([makeDirent('depth1', true)])
        .mockResolvedValueOnce([makeDirent('depth2', true)])
        .mockResolvedValueOnce([makeDirent('depth3', true)]);

      const result = await tool.execute({ path: 'src', recursive: true });

      expect(result.success).toBe(true);
      // depth 0 calls readdir, depth 1 calls readdir, depth 2 calls readdir
      // depth 3 should NOT be called because depth < 2 check prevents it
      expect(mockReaddir).toHaveBeenCalledTimes(3);
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('returns failure when directory does not exist', async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' }));

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('returns failure on permission error', async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }));

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('EACCES');
    });
  });

  // --- Empty directory ---

  describe('empty directory', () => {
    it('returns empty entries with zero counts', async () => {
      mockReaddir.mockResolvedValue([]);

      const result = await tool.execute({ path: 'src' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data!.entries).toEqual([]);
      expect(result.data!.totalFiles).toBe(0);
      expect(result.data!.totalDirs).toBe(0);
    });
  });
});
