/**
 * Backup Utilities for Meta-Harness Tools
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const BACKUP_DIR = path.join(os.tmpdir(), 'liminal-harness-backups');

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  error?: string;
}

/**
 * Create a backup of a file
 */
export async function createBackup(filePath: string): Promise<BackupResult> {
  try {
    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    
    // Generate backup filename
    const timestamp = Date.now();
    const basename = path.basename(filePath);
    const backupPath = path.join(BACKUP_DIR, `${basename}.${timestamp}.backup`);
    
    // Copy file to backup location
    await fs.copyFile(filePath, backupPath);
    
    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Restore a file from backup
 */
export async function restoreBackup(backupPath: string, originalPath?: string): Promise<BackupResult> {
  try {
    // Validate backup exists
    const stats = await fs.stat(backupPath).catch(() => null);
    if (!stats) {
      return {
        success: false,
        error: `Backup '${backupPath}' does not exist`,
      };
    }
    
    // If original path not provided, derive from backup name
    let targetPath = originalPath;
    if (!targetPath) {
      const basename = path.basename(backupPath);
      // Remove .timestamp.backup suffix
      targetPath = basename.replace(/\.\d+\.backup$/, '');
    }
    
    // Restore file
    await fs.copyFile(backupPath, targetPath);
    
    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old backups (older than 24 hours)
 */
export async function cleanupOldBackups(maxAgeHours: number = 24): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAgeMs) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * List available backups for a file
 */
export async function listBackups(filePath?: string): Promise<string[]> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    
    if (filePath) {
      const basename = path.basename(filePath);
      return files.filter(f => f.startsWith(basename));
    }
    
    return files;
  } catch {
    return [];
  }
}
