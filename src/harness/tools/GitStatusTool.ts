/**
 * GitStatusTool - read-only repository status inspection
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult, type GitStatusParams, type GitStatusResult } from './types.js';

const execFileAsync = promisify(execFile);

export class GitStatusTool extends Tool {
  readonly name = 'gitStatus';
  readonly description = 'Inspect git branch and working tree status';

  async execute(params: unknown): Promise<ToolResult<GitStatusResult>> {
    const startTime = Date.now();
    const { path: repoPath = process.cwd() } = (params || {}) as GitStatusParams;

    try {
      if (!this.validatePath(repoPath)) {
        return { success: false, error: 'Path not allowed', duration: Date.now() - startTime };
      }

      const [{ stdout: branch }, { stdout: short }] = await Promise.all([
        execFileAsync('git', ['branch', '--show-current'], { cwd: repoPath, timeout: 30000 }),
        execFileAsync('git', ['status', '--short'], { cwd: repoPath, timeout: 30000 }),
      ]);

      return {
        success: true,
        data: {
          branch: branch.trim(),
          short: short.trim(),
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

export const gitStatusTool = new GitStatusTool();
