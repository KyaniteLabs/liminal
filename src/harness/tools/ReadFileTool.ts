/**
 * ReadFile Tool - Read file content safely
 */

import fs from 'node:fs/promises';
import { Tool, type ToolResult, type ReadFileParams, type ReadFileResult } from './types.js';

export class ReadFileTool extends Tool {
  readonly name = 'readFile';
  readonly description = 'Read the contents of a file';

  private numericParam(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return fallback;
  }

  private optionalNumericParam(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
    return undefined;
  }
  
  async execute(params: unknown): Promise<ToolResult<ReadFileResult>> {
    const startTime = Date.now();
    const rawParams = params as Partial<ReadFileParams> | null | undefined;
    const filePath = rawParams?.path;
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      return {
        success: false,
        error: `readFile requires params.path to be a non-empty string; received ${Array.isArray(filePath) ? 'array' : typeof filePath}. Use {"path":"src/index.ts"} or another exact repository-relative file path.`,
        duration: Date.now() - startTime,
      };
    }
    const { offset, startLine: requestedStartLine } = rawParams ?? {};
    const maxLines = this.numericParam(rawParams?.maxLines, 1000);
    const limit = this.optionalNumericParam(rawParams?.limit);
    
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
      const numericOffset = this.optionalNumericParam(offset);
      const numericStartLine = this.optionalNumericParam(requestedStartLine);
      const requestedOffset = numericOffset ?? (numericStartLine != null ? numericStartLine - 1 : 0);
      const safeOffset = Math.max(0, requestedOffset);
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
