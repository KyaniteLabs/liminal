/**
 * WriteFile Tool - Write file content safely with backup
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Tool, type ToolResult, type WriteFileParams, type WriteFileResult } from './types.js';
import { createBackup } from './backup.js';

export class WriteFileTool extends Tool {
  readonly name = 'writeFile';
  readonly description = 'Write content to a file';
  
  async execute(params: unknown): Promise<ToolResult<WriteFileResult>> {
    const startTime = Date.now();
    const { path: filePath, content, mode = 'overwrite', createBackup: shouldBackup = true } = params as WriteFileParams;
    
    try {
      // Security validation
      if (!this.validatePath(filePath)) {
        return {
          success: false,
          error: `Path '${filePath}' is outside allowed directories`,
          duration: Date.now() - startTime,
        };
      }
      
      // Create backup if file exists and backup requested
      let backupPath: string | undefined;
      const exists = await fs.stat(filePath).catch(() => null);
      
      if (exists && shouldBackup) {
        const backup = await createBackup(filePath);
        if (backup.success) {
          backupPath = backup.backupPath;
        }
      }
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write file
      const writeMode = mode === 'append' ? { flag: 'a' as const } : { flag: 'w' as const };
      await fs.writeFile(filePath, content, writeMode);
      
      return {
        success: true,
        data: {
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          backupPath,
        },
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

export const writeFileTool = new WriteFileTool();
