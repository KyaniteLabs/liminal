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
      const execError = error instanceof Error ? error : new Error(String(error));
      const code = (error as { code?: number }).code || 1;
      return {
        success: false,
        data: {
          exitCode: code,
          stdout: (error as { stdout?: string }).stdout?.slice(-2000) || '',
          stderr: (error as { stderr?: string }).stderr?.slice(-2000) || execError.message,
          success: false,
        },
        error: `Build failed with exit code ${code}`,
        duration: Date.now() - startTime,
      };
    }
  }
}

export const runBuildTool = new RunBuildTool();
