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
    const pattern = typeof rawParams?.pattern === 'string' && rawParams.pattern.trim() !== ''
      ? rawParams.pattern
      : typeof rawParams?.symbol === 'string' && rawParams.symbol.trim() !== ''
        ? rawParams.symbol
        : undefined;
    const before = Math.max(0, this.optionalNumericParam(rawParams?.before) ?? 0);
    const after = Math.max(0, this.optionalNumericParam(rawParams?.after) ?? 0);
    
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

      if (pattern) {
        const matchIndex = lines.findIndex(line => line.includes(pattern));
        if (matchIndex === -1) {
          return {
            success: false,
            error: `Pattern '${pattern}' was not found in '${filePath}'`,
            duration: Date.now() - startTime,
          };
        }

        const additionalMatchesExist = lines.slice(matchIndex + 1).some(line => line.includes(pattern));
        const excerptStart = Math.max(0, matchIndex - before);
        const excerptEndExclusive = Math.min(lineCount, matchIndex + after + 1);
        const excerpt = lines.slice(excerptStart, excerptEndExclusive).join('\n');
        const startLine = lineCount === 0 ? 0 : excerptStart + 1;
        const endLine = excerptEndExclusive;
        const truncated = excerptStart > 0 || excerptEndExclusive < lineCount;
        const prefix = excerptStart > 0 ? `... [truncated: ${excerptStart} lines before] ...\n` : '';
        const suffix = excerptEndExclusive < lineCount ? `\n... [truncated: ${lineCount - excerptEndExclusive} more lines] ...` : '';

        return {
          success: true,
          data: {
            content: `${prefix}${excerpt}${suffix}`,
            exists: true,
            lineCount,
            truncated,
            startLine,
            endLine,
            matchLine: matchIndex + 1,
            additionalMatchesExist,
          },
          duration: Date.now() - startTime,
        };
      }

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
        const beforeCount = safeOffset;
        const afterCount = Math.max(0, lineCount - endLine);
        const prefix = beforeCount > 0 ? `... [truncated: ${beforeCount} lines before] ...\n` : '';
        const suffix = afterCount > 0 ? `\n... [truncated: ${afterCount} more lines] ...` : '';
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
