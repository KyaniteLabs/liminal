import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export interface RunLintParams {
  files?: string[];
  timeoutMs?: number;
}

export interface RunLintResult {
  command: string;
  stdout: string;
  stderr: string;
}

export class RunLintTool extends Tool {
  readonly name = 'runLint';
  readonly description = 'Run project lint or eslint on a focused file set';

  constructor(
    private readonly runner: CommandRunner = (command, args, options) =>
      execFileAsync(command, args, options),
  ) {
    super();
  }

  async execute(params: unknown): Promise<ToolResult<RunLintResult>> {
    const { files = [], timeoutMs = 60000 } = params as RunLintParams;

    const command = files.length > 0 ? 'npx eslint ' + files.join(' ') : 'npm run lint';
    const execCommand = files.length > 0 ? 'npx' : 'npm';
    const execArgs = files.length > 0 ? ['eslint', ...files] : ['run', 'lint'];

    try {
      const { stdout, stderr } = await this.runner(execCommand, execArgs, {
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

export const runLintTool = new RunLintTool();
