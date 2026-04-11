/**
 * ReadFile Tool - Read file content safely
 */

import fs from 'node:fs/promises';
import { Tool, type ToolResult, type ReadFileParams, type ReadFileResult } from './types.js';

export class ReadFileTool extends Tool {
  readonly name = 'readFile';
  readonly description = 'Read the contents of a file';
  
  async execute(params: unknown): Promise<ToolResult<ReadFileResult>> {
    const startTime = Date.now();
    const { path: filePath, maxLines = 1000, offset = 0, limit } = params as ReadFileParams;
    
    try {
      // Security validation
      if (!this.validatePath(filePath)) {
        return {
          success: false,
          error: `Path '${filePath}' is outside allowed directories`,
          duration: Date.now() - startTime,
        };
      }
      
      // Check if file exists
      const stats = await fs.stat(filePath).catch(() => null);
      if (!stats || !stats.isFile()) {
        return {
          success: false,
          error: `File '${filePath}' does not exist`,
          data: { content: '', exists: false, lineCount: 0 },
          duration: Date.now() - startTime,
        };
      }
      
      // Read file
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const lineCount = lines.length;
      const safeOffset = Math.max(0, offset);
      const pageSize = Math.max(1, limit ?? maxLines);
      const page = lines.slice(safeOffset, safeOffset + pageSize);
      const startLine = lineCount === 0 ? 0 : Math.min(safeOffset + 1, lineCount);
      const endLine = safeOffset + page.length;

      let truncatedContent = page.join('\n');
      let truncated = false;
      if (safeOffset > 0 || endLine < lineCount) {
        truncated = true;
        const before = safeOffset;
        const after = Math.max(0, lineCount - endLine);
        const prefix = before > 0 ? `... [truncated: ${before} lines before] ...\n` : '';
        const suffix = after > 0 ? `\n... [truncated: ${after} more lines] ...` : '';
        truncatedContent = `${prefix}${truncatedContent}${suffix}`;
      }
      
      return {
        success: true,
        data: {
          content: truncatedContent,
          exists: true,
          lineCount,
          truncated,
          startLine,
          endLine,
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

export const readFileTool = new ReadFileTool();
