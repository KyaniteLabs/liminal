/**
 * ListDirTool - List directory contents
 * 
 * Essential for:
 * - Exploring codebase structure
 * - Finding files to modify
 * - Understanding project layout
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Tool, type ToolResult } from './types.js';

export interface ListDirParams {
  path: string;
  recursive?: boolean;
  includeFiles?: boolean;
  includeDirs?: boolean;
}

export interface ListDirResult {
  entries: Array<{
    name: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: string;
  }>;
  totalFiles: number;
  totalDirs: number;
}

export class ListDirTool extends Tool {
  readonly name = 'listDir';
  readonly description = 'List directory contents';

  async execute(params: unknown): Promise<ToolResult<ListDirResult>> {
    const { path: dirPath, recursive = false, includeFiles = true, includeDirs = true } = params as ListDirParams;

    if (!dirPath) {
      return { success: false, error: 'path is required' };
    }

    // Security: Validate path
    if (!this.validatePath(dirPath)) {
      return { success: false, error: 'Path not allowed' };
    }

    try {
      const entries: ListDirResult['entries'] = [];
      let totalFiles = 0;
      let totalDirs = 0;

      const readDir = async (currentPath: string, depth = 0): Promise<void> => {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(currentPath, item.name);
          const relativePath = path.relative(process.cwd(), fullPath);

          if (item.isDirectory()) {
            if (includeDirs) {
              entries.push({
                name: relativePath,
                type: 'directory',
              });
            }
            totalDirs++;

            if (recursive && depth < 2) {
              await readDir(fullPath, depth + 1);
            }
          } else if (item.isFile()) {
            if (includeFiles) {
              const stats = await fs.stat(fullPath);
              entries.push({
                name: relativePath,
                type: 'file',
                size: stats.size,
                modified: stats.mtime.toISOString(),
              });
            }
            totalFiles++;
          }
        }
      };

      await readDir(dirPath);

      return {
        success: true,
        data: {
          entries: entries.slice(0, 100), // Limit results
          totalFiles,
          totalDirs,
        },
      };

    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }
}

export const listDirTool = new ListDirTool();
