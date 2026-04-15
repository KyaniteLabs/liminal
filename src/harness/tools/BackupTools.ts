/**
 * Backup Management Tools
 */

import { Tool, type ToolResult, type CreateBackupParams, type CreateBackupResult, type RestoreBackupParams, type RestoreBackupResult } from './types.js';
import { createBackup, restoreBackup } from './backup.js';

export class CreateBackupTool extends Tool {
  readonly name = 'createBackup';
  readonly description = 'Create a backup of a file';
  
  async execute(params: unknown): Promise<ToolResult<CreateBackupResult>> {
    const startTime = Date.now();
    const { path: filePath } = params as CreateBackupParams;
    
    try {
      if (!this.validatePath(filePath)) {
        return {
          success: false,
          error: `Path '${filePath}' is outside allowed directories`,
          duration: Date.now() - startTime,
        };
      }
      
      const result = await createBackup(filePath);
      
      return {
        success: result.success,
        data: result as CreateBackupResult,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        duration: Date.now() - startTime,
      };
    }
  }
}

export class RestoreBackupTool extends Tool {
  readonly name = 'restoreBackup';
  readonly description = 'Restore a file from backup';
  
  async execute(params: unknown): Promise<ToolResult<RestoreBackupResult>> {
    const startTime = Date.now();
    const { backupPath, originalPath } = params as RestoreBackupParams;
    
    try {
      const result = await restoreBackup(backupPath, originalPath);
      
      return {
        success: result.success,
        data: { success: result.success },
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        duration: Date.now() - startTime,
      };
    }
  }
}

export const createBackupTool = new CreateBackupTool();
export const restoreBackupTool = new RestoreBackupTool();
