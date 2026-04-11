/**
 * LocalCheckpointTool - create a local-only git commit to preserve verified progress
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult, type LocalCheckpointParams, type LocalCheckpointResult } from './types.js';

const execFileAsync = promisify(execFile);

export class LocalCheckpointTool extends Tool {
  readonly name = 'localCheckpoint';
  readonly description = 'Create a local-only git checkpoint commit on the current non-main branch';

  async execute(params: unknown): Promise<ToolResult<LocalCheckpointResult>> {
    const startTime = Date.now();
    const { message, taskId, verifyBuild = true } = params as LocalCheckpointParams;

    if (!message?.trim()) {
      return { success: false, error: 'message is required', duration: Date.now() - startTime };
    }

    try {
      const { stdout: branchStdout } = await execFileAsync('git', ['branch', '--show-current'], {
        cwd: process.cwd(),
        timeout: 30000,
      });
      const branch = branchStdout.trim();
      if (!branch) {
        return { success: false, error: 'detached HEAD is not allowed for local checkpoints', duration: Date.now() - startTime };
      }
      if (branch === 'main' || branch === 'master') {
        return { success: false, error: `refusing to create local checkpoint on protected branch ${branch}`, duration: Date.now() - startTime };
      }

      const { stdout: statusStdout } = await execFileAsync('git', ['status', '--short'], {
        cwd: process.cwd(),
        timeout: 30000,
      });
      const changed = statusStdout
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean);
      if (changed.length === 0) {
        return { success: false, error: 'no changes to checkpoint', duration: Date.now() - startTime };
      }

      let buildVerified = false;
      if (verifyBuild) {
        await execFileAsync('npm', ['run', 'build'], {
          cwd: process.cwd(),
          timeout: 120000,
        });
        buildVerified = true;
      }

      await execFileAsync('git', ['add', '-A'], { cwd: process.cwd(), timeout: 30000 });

      const commitMessage = this.formatMessage(message.trim(), taskId, buildVerified);
      await execFileAsync('git', ['commit', '-m', commitMessage], {
        cwd: process.cwd(),
        timeout: 30000,
      });

      const { stdout: hashStdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: process.cwd(),
        timeout: 30000,
      });
      const commitHash = hashStdout.trim();

      return {
        success: true,
        data: {
          commitHash,
          shortHash: commitHash.slice(0, 8),
          branch,
          filesChanged: changed.length,
          buildVerified,
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

  private formatMessage(message: string, taskId: string | undefined, buildVerified: boolean): string {
    const trailers = [
      `Constraint: Local checkpoint only — no push or history rewrite`,
      `Confidence: medium`,
      `Scope-risk: narrow`,
      `Directive: Promote this commit to a review branch explicitly if it should leave the runtime lane`,
      `Tested: ${buildVerified ? 'npm run build' : 'not requested'}`,
    ];
    const prefix = taskId ? `[${taskId}] ` : '';
    return `${prefix}${message}\n\n${trailers.join('\n')}`;
  }
}

export const localCheckpointTool = new LocalCheckpointTool();
