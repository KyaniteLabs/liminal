import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createBackup, restoreBackup, cleanupOldBackups, listBackups } from '../../../../src/harness/tools/backup.js';

vi.mock('node:fs/promises');
vi.mock('../../../../src/utils/Logger.js', () => ({
  Logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const BACKUP_DIR = path.join(os.tmpdir(), 'sinter-harness-backups');

describe('backup utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.stat).mockResolvedValue({
      mtime: new Date(),
      isFile: () => true,
    } as any);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
  });

  describe('createBackup', () => {
    it('creates backup successfully', async () => {
      const result = await createBackup('/project/src/awesome.ts');
      expect(result.success).toBe(true);
      expect(result.originalPath).toBe('/project/src/awesome.ts');
      expect(result.backupPath).toContain('awesome.ts');
      expect(result.backupPath).toContain(BACKUP_DIR);
      expect(fs.mkdir).toHaveBeenCalledWith(BACKUP_DIR, { recursive: true });
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/project/src/awesome.ts',
        expect.stringContaining('awesome.ts'),
      );
    });

    it('returns failure when copyFile fails', async () => {
      vi.mocked(fs.copyFile).mockRejectedValue(new Error('permission denied'));
      const result = await createBackup('/protected/file.ts');
      expect(result.success).toBe(false);
      expect(result.error).toContain('createBackup');
    });

    it('returns failure when mkdir fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('disk full'));
      const result = await createBackup('/some/file.ts');
      expect(result.success).toBe(false);
    });
  });

  describe('restoreBackup', () => {
    it('restores with explicit target path', async () => {
      const result = await restoreBackup('/tmp/backup/file.ts.1234567890.backup', '/project/file.ts');
      expect(result.success).toBe(true);
      expect(result.backupPath).toContain('file.ts.1234567890.backup');
      expect(fs.copyFile).toHaveBeenCalledWith(
        '/tmp/backup/file.ts.1234567890.backup',
        '/project/file.ts',
      );
    });

    it('derives target path from backup filename when not provided', async () => {
      const backupPath = path.join(BACKUP_DIR, 'config.json.9999999999.backup');
      const result = await restoreBackup(backupPath);
      expect(result.success).toBe(true);
      // The targetPath is derived by removing .timestamp.backup suffix
      expect(fs.copyFile).toHaveBeenCalledWith(backupPath, 'config.json');
    });

    it('throws when backup does not exist (stat returns null)', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
      await expect(restoreBackup('/no/such/file.backup')).rejects.toThrow('Backup restore failed');
    });

    it('throws when copyFile fails during restore', async () => {
      vi.mocked(fs.copyFile).mockRejectedValue(new Error('write error'));
      await expect(
        restoreBackup('/tmp/backup/file.ts.111.backup', '/target/file.ts'),
      ).rejects.toThrow('Backup restore failed');
    });
  });

  describe('cleanupOldBackups', () => {
    it('deletes files older than max age', async () => {
      const oldFile = 'old-config.ts.1000000000.backup';
      vi.mocked(fs.readdir).mockResolvedValue([oldFile] as any);
      const oldMtime = new Date(Date.now() - 48 * 60 * 60 * 1000);
      vi.mocked(fs.stat).mockResolvedValue({ mtime: oldMtime } as any);

      await cleanupOldBackups(24);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(BACKUP_DIR, oldFile));
    });

    it('keeps files newer than max age', async () => {
      const recentFile = 'recent-config.ts.9999999999.backup';
      vi.mocked(fs.readdir).mockResolvedValue([recentFile] as any);
      const recentMtime = new Date(Date.now() - 1 * 60 * 60 * 1000);
      vi.mocked(fs.stat).mockResolvedValue({ mtime: recentMtime } as any);

      await cleanupOldBackups(24);
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('ignores errors during cleanup (e.g. readdir fails)', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('dir missing'));
      await expect(cleanupOldBackups()).resolves.toBeUndefined();
    });

    it('handles unlink failure within loop', async () => {
      const oldFile = 'stale.ts.100.backup';
      vi.mocked(fs.readdir).mockResolvedValue([oldFile] as any);
      vi.mocked(fs.stat).mockResolvedValue({
        mtime: new Date(Date.now() - 48 * 60 * 60 * 1000),
      } as any);
      vi.mocked(fs.unlink).mockRejectedValue(new Error('permission denied'));

      await expect(cleanupOldBackups()).resolves.toBeUndefined();
    });

    it('uses default 24-hour max age', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([]);
      await cleanupOldBackups();
      expect(fs.readdir).toHaveBeenCalledWith(BACKUP_DIR);
    });
  });

  describe('listBackups', () => {
    it('lists all backups when no filter', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'file1.ts.100.backup',
        'file2.ts.200.backup',
      ] as any);
      const result = await listBackups();
      expect(result).toEqual(['file1.ts.100.backup', 'file2.ts.200.backup']);
    });

    it('filters backups by file path', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'config.json.100.backup',
        'config.json.200.backup',
        'other.ts.300.backup',
      ] as any);
      const result = await listBackups('/project/config.json');
      expect(result).toEqual(['config.json.100.backup', 'config.json.200.backup']);
    });

    it('returns empty array on readdir failure', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('not found'));
      const result = await listBackups();
      expect(result).toEqual([]);
    });

    it('returns empty array when no matching files', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['other.ts.100.backup'] as any);
      const result = await listBackups('/project/missing.json');
      expect(result).toEqual([]);
    });
  });
});
