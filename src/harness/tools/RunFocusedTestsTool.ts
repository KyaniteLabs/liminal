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
  /** Optional Go test name/pattern passed to `go test -run`. */
  testNamePattern?: string;
  timeoutMs?: number;
}

export interface RunFocusedTestsResult {
  command: string;
  stdout: string;
  stderr: string;
}

export class RunFocusedTestsTool extends Tool {
  readonly name = 'runFocusedTests';
  readonly description = 'Run focused Vitest or Bubble Tea Go tests for specific files or patterns';

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

    const execution = this.buildExecution(targets, rawParams);

    try {
      const { stdout, stderr } = await this.runner(execution.command, execution.args, {
        cwd: execution.cwd,
        timeout: timeoutMs,
      });

      return {
        success: true,
        data: { command: execution.displayCommand, stdout, stderr },
      };
    } catch (error) {
      return {
        success: false,
        error: this.formatError(error),
        data: { command: execution.displayCommand, stdout: '', stderr: this.formatError(error) },
      };
    }
  }

  private buildExecution(targets: string[], params: RunFocusedTestsParams | null | undefined) {
    const goTestPattern = this.normalizeGoTestPattern(params);
    if (this.isGoTarget(targets)) {
      const packagePath = this.resolveGoPackagePath(targets[0]!);
      const args = ['test', packagePath];
      if (goTestPattern) args.push('-run', goTestPattern);
      return {
        command: 'go',
        args,
        cwd: 'bubbletea',
        displayCommand: `go ${args.join(' ')}`,
      };
    }

    const args = ['vitest', 'run', ...targets, '--coverage=false'];
    return {
      command: 'npx',
      args,
      cwd: process.cwd(),
      displayCommand: `npx ${args.join(' ')}`,
    };
  }

  private isGoTarget(targets: string[]): boolean {
    return targets.some(target => target.startsWith('bubbletea/') || target.endsWith('.go'));
  }

  private resolveGoPackagePath(target: string): string {
    const normalized = target.replace(/\\/g, '/');
    const relative = normalized.startsWith('bubbletea/') ? normalized.slice('bubbletea/'.length) : normalized;
    const lastSlash = relative.lastIndexOf('/');
    const dir = lastSlash >= 0 ? relative.slice(0, lastSlash) : '.';
    return dir === '.' ? './' : `./${dir}`;
  }

  private normalizeGoTestPattern(params: RunFocusedTestsParams | null | undefined): string | undefined {
    if (!params) return undefined;
    if (typeof params.testNamePattern === 'string' && params.testNamePattern.trim() !== '') {
      return params.testNamePattern.trim();
    }
    return undefined;
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
