/**
 * GitStatusTool - Return concise working tree status for the current repo
 *
 * Useful for:
 * - Checking whether edits are still pending
 * - Confirming a task touched the expected paths
 * - Giving the meta-harness low-risk repo awareness
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

interface GitStatusParams {
  path?: string;
}

interface GitStatusResult {
  branch: string;
  short: string;
}

export class GitStatusTool extends Tool {
  readonly name = 'gitStatus';
  readonly description = 'Get concise git working tree status';

  async execute(params: unknown): Promise<ToolResult<GitStatusResult>> {
    const { path: statusPath } = (params ?? {}) as GitStatusParams;

    if (statusPath && !this.validatePath(statusPath)) {
      return { success: false, error: 'Path not allowed' };
    }

    try {
      const args = ['status', '--short', '--branch'];
      if (statusPath) {
        args.push('--', statusPath);
      }

      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd: process.cwd(),
        timeout: 30_000,
      });

      if (stderr.trim()) {
        return { success: false, error: stderr.trim() };
      }

      const lines = stdout.trim().split('\n').filter(Boolean);
      const branchLine = lines.find(line => line.startsWith('## ')) ?? '## detached';
      const short = lines.filter(line => !line.startsWith('## ')).join('\n');

      return {
        success: true,
        data: {
          branch: branchLine.replace(/^##\s*/, ''),
          short,
        },
      };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }
}

export const gitStatusTool = new GitStatusTool();
