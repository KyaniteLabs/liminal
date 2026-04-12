import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export interface RunFocusedTestsParams {
  targets: string[];
  timeoutMs?: number;
}

export interface RunFocusedTestsResult {
  command: string;
  stdout: string;
  stderr: string;
}

export class RunFocusedTestsTool extends Tool {
  readonly name = 'runFocusedTests';
  readonly description = 'Run a focused Vitest slice for specific files or patterns';

  constructor(
    private readonly runner: CommandRunner = (command, args, options) =>
      execFileAsync(command, args, options),
  ) {
    super();
  }

  async execute(params: unknown): Promise<ToolResult<RunFocusedTestsResult>> {
    const { targets = [], timeoutMs = 60000 } = params as RunFocusedTestsParams;

    if (targets.length === 0) {
      return { success: false, error: 'targets must include at least one test path or pattern' };
    }

    const args = ['vitest', 'run', ...targets];
    const command = `npx ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await this.runner('npx', args, {
        cwd: process.cwd(),
        timeout: timeoutMs,
      });

      return {
        success: true,
        data: { command, stdout, stderr },
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        data: { command, stdout: '', stderr: this.formatError(error) },
      };
    }
  }
}

export const runFocusedTestsTool = new RunFocusedTestsTool();
