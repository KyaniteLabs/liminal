/**
 * RunBuild Tool - Run TypeScript build to verify changes
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult, type RunBuildParams, type RunBuildResult } from './types.js';

const execFileAsync = promisify(execFile);

export class RunBuildTool extends Tool {
  readonly name = 'runBuild';
  readonly description = 'Run npm run build to verify TypeScript compiles';
  
  async execute(params: unknown): Promise<ToolResult<RunBuildResult>> {
    const startTime = Date.now();
    const { timeoutMs = 60000 } = params as RunBuildParams;
    
    try {
      const { stdout, stderr } = await execFileAsync('npm', ['run', 'build'], {
        timeout: timeoutMs,
        cwd: process.cwd(),
      });
      
      const exitCode = 0; // If we get here, it succeeded
      
      return {
        success: true,
        data: {
          exitCode,
          stdout: stdout.slice(-2000), // Limit output size
          stderr: stderr.slice(-1000),
          success: true,
        },
        duration: Date.now() - startTime,
      };
    } catch (error: unknown) {
      // Build failed
      const execErr = error as Record<string, unknown>;
      return {
        success: false,
        data: {
          exitCode: (execErr.code as number) || 1,
          stdout: (execErr.stdout as string)?.slice(-2000) || '',
          stderr: (execErr.stderr as string)?.slice(-2000) || (error instanceof Error ? error.message : String(error)),
          success: false,
        },
        error: `Build failed with exit code ${(execErr.code as number) || 1}`,
        duration: Date.now() - startTime,
      };
    }
  }
}

export const runBuildTool = new RunBuildTool();
