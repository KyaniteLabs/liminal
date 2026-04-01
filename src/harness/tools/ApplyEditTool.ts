/**
 * ApplyEdit Tool - Apply targeted string replacement
 * 
 * This is the PRIMARY tool for making code changes.
 * Uses exact string matching for safety.
 */

import fs from 'node:fs/promises';
import { Tool, type ToolResult, type ApplyEditParams, type ApplyEditResult } from './types.js';
import { createBackup } from './backup.js';

export class ApplyEditTool extends Tool {
  readonly name = 'applyEdit';
  readonly description = 'Apply a targeted string replacement to a file';
  
  async execute(params: unknown): Promise<ToolResult<ApplyEditResult>> {
    const startTime = Date.now();
    const { path: filePath, oldString, newString, createBackup: shouldBackup = true } = params as ApplyEditParams;
    
    try {
      // Security validation
      if (!this.validatePath(filePath)) {
        return {
          success: false,
          error: `Path '${filePath}' is outside allowed directories`,
          duration: Date.now() - startTime,
        };
      }
      
      // Validate parameters
      if (!oldString) {
        return {
          success: false,
          error: 'oldString is required',
          duration: Date.now() - startTime,
        };
      }
      
      // Read current content
      const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
      if (content === null) {
        return {
          success: false,
          error: `File '${filePath}' does not exist`,
          duration: Date.now() - startTime,
        };
      }
      
      // Count occurrences
      const occurrences = content.split(oldString).length - 1;
      if (occurrences === 0) {
        return {
          success: false,
          error: `String not found in file. Expected:\n${oldString.slice(0, 200)}...`,
          duration: Date.now() - startTime,
        };
      }
      
      if (occurrences > 1) {
        return {
          success: false,
          error: `String appears ${occurrences} times in file. Must be unique for safety.`,
          duration: Date.now() - startTime,
        };
      }
      
      // Create backup
      let backupPath: string | undefined;
      if (shouldBackup) {
        const backup = await createBackup(filePath);
        if (backup.success) {
          backupPath = backup.backupPath;
        }
      }
      
      // Apply replacement
      const newContent = content.replace(oldString, newString);
      
      // Verify the change was applied
      if (newContent === content) {
        return {
          success: false,
          error: 'Replacement failed - content unchanged',
          duration: Date.now() - startTime,
        };
      }
      
      // Write new content
      await fs.writeFile(filePath, newContent, 'utf-8');
      
      return {
        success: true,
        data: {
          replacements: 1,
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

export const applyEditTool = new ApplyEditTool();
