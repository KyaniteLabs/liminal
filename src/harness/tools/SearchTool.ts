/**
 * SearchTool - Grep-like search across codebase
 * 
 * Essential for:
 * - Finding where functions are defined
 * - Locating patterns to refactor
 * - Discovering API usage examples
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export interface SearchParams {
  pattern: string;
  path?: string;
  glob?: string;
  maxResults?: number;
}

export interface SearchResult {
  matches: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  totalMatches: number;
  truncated: boolean;
}

export class SearchTool extends Tool {
  readonly name = 'search';
  readonly description = 'Search for patterns in codebase using ripgrep';

  async execute(params: unknown): Promise<ToolResult<SearchResult>> {
    const { pattern, path: searchPath = '.', glob, maxResults = 20 } = params as SearchParams;

    if (!pattern) {
      return { success: false, error: 'pattern is required' };
    }

    try {
      // Security: Validate path is within project
      if (!this.validatePath(searchPath)) {
        return { success: false, error: 'Path not allowed' };
      }

      const args = [
        '--line-number',
        '--with-filename',
        '--color=never',
        '--max-count', String(maxResults + 5), // Buffer for truncation
        pattern,
        searchPath,
      ];

      if (glob) {
        args.push('--glob', glob);
      }

      const { stdout, stderr } = await execFileAsync('rg', args, { 
        timeout: 30000,
        cwd: process.cwd(),
      }).catch(err => {
        // No matches is not an error for ripgrep
        if (err.exitCode === 1) return { stdout: '', stderr: '' };
        throw err;
      });

      if (stderr) {
        return { success: false, error: stderr };
      }

      const lines = stdout.split('\n').filter(Boolean);
      const matches = lines.slice(0, maxResults).map(line => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) return null;
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          content: match[3].trim(),
        };
      }).filter((m): m is NonNullable<typeof m> => m !== null);

      return {
        success: true,
        data: {
          matches,
          totalMatches: lines.length,
          truncated: lines.length > maxResults,
        },
      };

    } catch (error) {
      // Fallback to grep if ripgrep not available
      return this.fallbackGrep(pattern, searchPath, maxResults);
    }
  }

  private async fallbackGrep(pattern: string, searchPath: string, maxResults: number): Promise<ToolResult<SearchResult>> {
    try {
      const { stdout } = await execFileAsync('grep', [
        '-rn',
        '--include=*.ts',
        '--include=*.js',
        '--include=*.tsx',
        '--include=*.jsx',
        '-m', String(maxResults + 5),
        pattern,
        searchPath,
      ], { timeout: 30000 });

      const lines = stdout.split('\n').filter(Boolean);
      const matches = lines.slice(0, maxResults).map(line => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) return null;
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          content: match[3].trim(),
        };
      }).filter((m): m is NonNullable<typeof m> => m !== null);

      return {
        success: true,
        data: {
          matches,
          totalMatches: lines.length,
          truncated: lines.length > maxResults,
        },
      };
    } catch {
      return { success: false, error: 'Search failed. Install ripgrep: brew install ripgrep' };
    }
  }
}

export const searchTool = new SearchTool();
