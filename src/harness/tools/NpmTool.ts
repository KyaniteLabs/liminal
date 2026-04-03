/**
 * NpmTool - Install npm packages
 * 
 * Essential for:
 * - Adding dependencies when implementing features
 * - Installing types for new packages
 * - Updating outdated packages
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type ToolResult } from './types.js';
import { formatError } from '../../utils/errors.js';

const execFileAsync = promisify(execFile);

export interface NpmInstallParams {
  packages: string[];
  dev?: boolean;
  exact?: boolean;
}

export interface NpmInstallResult {
  installed: string[];
  failed: string[];
  stdout: string;
  stderr: string;
}

export class NpmTool extends Tool {
  readonly name = 'npm';
  readonly description = 'Install npm packages';

  async execute(params: unknown): Promise<ToolResult<NpmInstallResult>> {
    const { packages, dev = false, exact = false } = params as NpmInstallParams;

    if (!packages || packages.length === 0) {
      return { success: false, error: 'packages array is required' };
    }

    try {
      // Use pnpm if available, fallback to npm
      const pm = await this.detectPackageManager();
      
      const args = ['add', ...packages];
      
      if (dev) {
        args.push('--save-dev');
      }
      
      if (exact) {
        args.push('--save-exact');
      }

      const { stdout, stderr } = await execFileAsync(pm, args, {
        timeout: 120000,
        cwd: process.cwd(),
      });

      // Parse installed packages from output
      const installed: string[] = [];
      const failed: string[] = [];

      for (const pkg of packages) {
        if (stdout.includes(pkg) || stderr.includes(pkg)) {
          installed.push(pkg);
        } else {
          failed.push(pkg);
        }
      }

      return {
        success: failed.length === 0,
        data: {
          installed,
          failed,
          stdout: stdout.slice(-500), // Last 500 chars
          stderr: stderr.slice(-500),
        },
      };

    } catch (error) {
      const errMsg = formatError('NpmTool', error);
      return { 
        success: false, 
        error: errMsg,
        data: {
          installed: [],
          failed: packages,
          stdout: '',
          stderr: errMsg,
        },
      };
    }
  }

  private async detectPackageManager(): Promise<string> {
    try {
      await execFileAsync('which', ['pnpm']);
      return 'pnpm';
    } catch {
      try {
        await execFileAsync('which', ['npm']);
        return 'npm';
      } catch {
        return 'npm'; // Fallback
      }
    }
  }
}

export const npmTool = new NpmTool();
