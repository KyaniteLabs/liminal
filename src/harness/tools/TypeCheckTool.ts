/**
 * TypeCheckTool - Run TypeScript type checking
 * 
 * Essential for:
 * - Catching type errors before build
 * - Validating refactors didn't break types
 * - Fast feedback loop (faster than full build)
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult } from './types.js';

const execFileAsync = promisify(execFile);

export interface TypeCheckParams {
  path?: string;
  strict?: boolean;
}

export interface TypeCheckResult {
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    code: string;
  }>;
  totalErrors: number;
  success: boolean;
}

export class TypeCheckTool extends Tool {
  readonly name = 'typeCheck';
  readonly description = 'Run TypeScript type checker';

  async execute(params: unknown): Promise<ToolResult<TypeCheckResult>> {
    const { path: checkPath, strict = false } = params as TypeCheckParams;

    try {
      const args = ['--noEmit', '--pretty', 'false'];
      
      if (strict) {
        args.push('--strict');
      }
      
      if (checkPath) {
        args.push(checkPath);
      }

      const { stdout, stderr } = await execFileAsync('npx', ['tsc', ...args], {
        timeout: 60000,
        cwd: process.cwd(),
      }).catch(err => {
        // Type errors return exit code 2
        if (err.exitCode === 2) {
          return { stdout: err.stdout, stderr: err.stderr };
        }
        throw err;
      });

      const output = stdout + stderr;
      
      // Parse TypeScript error format: file(line,col): error TSxxxx: message
      const errorRegex = /^(.*?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/gm;
      const errors: TypeCheckResult['errors'] = [];
      
      let match;
      while ((match = errorRegex.exec(output)) !== null) {
        errors.push({
          file: match[1].trim(),
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          code: match[4],
          message: match[5].trim(),
        });
      }

      return {
        success: errors.length === 0,
        data: {
          errors: errors.slice(0, 20), // Limit to first 20
          totalErrors: errors.length,
          success: errors.length === 0,
        },
      };

    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }
}

export const typeCheckTool = new TypeCheckTool();
