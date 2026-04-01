/**
 * RunTests Tool - Run tests to verify changes
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult, type RunTestsParams, type RunTestsResult } from './types.js';

const execFileAsync = promisify(execFile);

export class RunTestsTool extends Tool {
  readonly name = 'runTests';
  readonly description = 'Run tests to verify changes';
  
  async execute(params: unknown): Promise<ToolResult<RunTestsResult>> {
    const startTime = Date.now();
    const { pattern, timeoutMs = 60000 } = params as RunTestsParams;
    
    try {
      const args = ['test'];
      if (pattern) {
        args.push(pattern);
      }
      
      const { stdout, stderr } = await execFileAsync('npm', args, {
        timeout: timeoutMs,
        cwd: process.cwd(),
      });
      
      // Parse test results
      const passed = (stdout.match(/✓|PASS|passed/gi) || []).length;
      const failed = (stdout.match(/✗|FAIL|failed/gi) || []).length;
      
      return {
        success: true,
        data: {
          exitCode: 0,
          passed,
          failed,
          stdout: stdout.slice(-2000),
          stderr: stderr.slice(-1000),
          success: true,
        },
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      // Tests failed or error occurred
      const stdout = error.stdout || '';
      const passed = (stdout.match(/✓|PASS|passed/gi) || []).length;
      const failed = (stdout.match(/✗|FAIL|failed/gi) || []).length;
      
      return {
        success: false,
        data: {
          exitCode: error.code || 1,
          passed,
          failed: failed || 1,
          stdout: stdout.slice(-2000),
          stderr: (error.stderr || error.message).slice(-2000),
          success: false,
        },
        error: `Tests failed with exit code ${error.code || 1}`,
        duration: Date.now() - startTime,
      };
    }
  }
}

export const runTestsTool = new RunTestsTool();
