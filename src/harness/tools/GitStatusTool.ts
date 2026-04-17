/**
 * GitStatusTool - read-only repository status inspection
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult, type GitStatusParams, type GitStatusResult } from './types.js';

const execFileAsync = promisify(execFile);

export class GitStatusTool extends Tool {
  readonly name = 'gitStatus';
  readonly description = 'Inspect git branch and working tree status';

  constructor(
    private readonly runner: CommandRunner = (command, args, options) =>
      execFileAsync(command, args, options),
  ) {
    super();
  }

  async execute(params: unknown): Promise<ToolResult<GitStatusResult>> {
    const startTime = Date.now();
    const { path: repoPath = process.cwd() } = (params || {}) as GitStatusParams;

    try {
      if (!this.validatePath(repoPath)) {
        return { success: false, error: 'Path not allowed', duration: Date.now() - startTime };
      }

      const [{ stdout: root }, { stdout: branch }, { stdout: commitSha }, { stdout: short }] = await Promise.all([
        this.runner('git', ['rev-parse', '--show-toplevel'], { cwd: repoPath, timeout: 30000 }),
        this.runner('git', ['branch', '--show-current'], { cwd: repoPath, timeout: 30000 }),
        this.runner('git', ['rev-parse', 'HEAD'], { cwd: repoPath, timeout: 30000 }),
        this.runner('git', ['status', '--short'], { cwd: repoPath, timeout: 30000 }),
      ]);
      const trimmedCommitSha = commitSha.trim();
      const trimmedShort = short.trim();

      return {
        success: true,
        data: {
          branch: branch.trim(),
          commitSha: trimmedCommitSha,
          shortSha: trimmedCommitSha.slice(0, 9),
          short: trimmedShort,
          clean: trimmedShort.length === 0,
          root: root.trim(),
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
