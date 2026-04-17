import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export interface RunFocusedTestsParams {
  targets?: string[];
  /** Single test path alias for models that provide path instead of targets. */
  path?: string;
  /** Single test pattern alias for models that provide pattern instead of targets. */
  pattern?: string;
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
    const rawParams = params as RunFocusedTestsParams | null | undefined;
    const targets = this.normalizeTargets(rawParams);
    const timeoutMs = rawParams?.timeoutMs ?? 60000;

    if (targets.length === 0) {
      return {
        success: false,
        error: 'runFocusedTests requires params.targets, params.path, or params.pattern. Use {"targets":["test/unit/example.test.ts"]} or {"path":"test/unit/example.test.ts"}.',
      };
    }

    const args = ['vitest', 'run', ...targets, '--coverage=false'];
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

  private normalizeTargets(params: RunFocusedTestsParams | null | undefined): string[] {
    if (!params) return [];
    if (Array.isArray(params.targets)) {
      return params.targets
        .filter((target): target is string => typeof target === 'string' && target.trim() !== '')
        .map(target => target.trim());
    }
    if (typeof params.path === 'string' && params.path.trim() !== '') {
      return [params.path.trim()];
    }
    if (typeof params.pattern === 'string' && params.pattern.trim() !== '') {
      return [params.pattern.trim()];
    }
    return [];
  }
}

export const runFocusedTestsTool = new RunFocusedTestsTool();
