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
    const rawParams = (params || {}) as ApplyEditParams;
    const {
      path: filePath,
      oldString: rawOldString,
      newString: rawNewString,
      search,
      replace,
      createBackup: shouldBackup = true,
    } = rawParams;
    const oldString = rawOldString ?? search;
    const newString = rawNewString ?? replace;
    
    try {
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        return {
          success: false,
          error: 'applyEdit requires params.path to be a non-empty string.',
          duration: Date.now() - startTime,
        };
      }

      // Security validation
      if (!this.validatePath(filePath)) {
        return {
          success: false,
          error: `Path '${filePath}' is outside allowed directories`,
          duration: Date.now() - startTime,
        };
      }
      
      // Validate parameters
      if (typeof oldString !== 'string' || oldString === '') {
        return {
          success: false,
          error: 'applyEdit requires params.oldString or params.search to be a non-empty string.',
          duration: Date.now() - startTime,
        };
      }

      if (typeof newString !== 'string') {
        return {
          success: false,
          error: 'applyEdit requires params.newString or params.replace to be a string.',
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
          verificationHint: getVerificationHint(filePath),
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

/**
 * Returns a verification hint based on file extension.
 * Guides the LLM to pick the right verification tool after an edit.
 */
function getVerificationHint(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';

  // Go files - npm build won't cover these
  if (ext === 'go') {
    return 'Modified a Go file. runBuild will NOT verify this. Use astValidate or run go-specific checks.';
  }

  // Non-code files - no TypeScript build needed
  if (['md', 'txt', 'rst'].includes(ext)) {
    return 'Modified a Markdown/text file. No build needed - use readFile to verify content.';
  }
  if (['json', 'jsonc'].includes(ext) || base === 'package.json') {
    return 'Modified a JSON file. No build needed - use readFile to verify structure.';
  }
  if (['css', 'scss', 'less', 'sass'].includes(ext)) {
    return 'Modified a CSS/SCSS file. No TypeScript build needed - use readFile to verify.';
  }
  if (['html', 'htm', 'svg'].includes(ext)) {
    return 'Modified an HTML file. No build needed - use readFile to verify.';
  }
  if (['yaml', 'yml', 'toml'].includes(ext)) {
    return 'Modified a YAML/TOML file. No build needed - use readFile to verify.';
  }

  // TypeScript/JavaScript files - use typeCheck for type-only changes, runBuild for full verification
  if (['ts', 'tsx', 'js', 'jsx', 'mts', 'cts'].includes(ext)) {
    return 'Modified a TypeScript/JS file. Run typeCheck (fast) or runBuild (full) to verify.';
  }

  // Default: suggest build
  return 'Run runBuild to verify changes compile correctly.';
}

export const applyEditTool = new ApplyEditTool();
