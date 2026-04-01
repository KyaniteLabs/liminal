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
    const { path: filePath, maxLines = 1000 } = params as ReadFileParams;
    
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
      
      // Truncate if needed
      let truncatedContent = content;
      let truncated = false;
      if (lines.length > maxLines) {
        truncatedContent = lines.slice(0, maxLines).join('\n');
        truncatedContent += `\n\n... [truncated: ${lines.length - maxLines} more lines] ...`;
        truncated = true;
      }
      
      return {
        success: true,
        data: {
          content: truncatedContent,
          exists: true,
          lineCount,
          truncated,
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
