/**
 * Tool Types for Meta-Harness Agent
 * 
 * Each tool follows the JSON-RPC style interface:
 * - name: Tool identifier
 * - params: Input parameters
 * - result: Output result
 */

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
}

export interface ReadFileParams {
  path: string;
  maxLines?: number;
}

export interface ReadFileResult {
  content: string;
  exists: boolean;
  lineCount: number;
  truncated?: boolean;
}

export interface WriteFileParams {
  path: string;
  content: string;
  mode?: 'overwrite' | 'append';
  createBackup?: boolean;
}

export interface WriteFileResult {
  bytesWritten: number;
  backupPath?: string;
}

export interface ApplyEditParams {
  path: string;
  oldString: string;
  newString: string;
  createBackup?: boolean;
}

export interface ApplyEditResult {
  replacements: number;
  backupPath?: string;
}

export interface RunBuildParams {
  timeoutMs?: number;
}

export interface RunBuildResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface RunTestsParams {
  pattern?: string;
  timeoutMs?: number;
}

export interface RunTestsResult {
  exitCode: number;
  passed: number;
  failed: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export interface CreateBackupParams {
  path: string;
}

export interface CreateBackupResult {
  backupPath: string;
  success: boolean;
}

export interface RestoreBackupParams {
  backupPath: string;
}

export interface RestoreBackupResult {
  success: boolean;
}

export interface ToolCall {
  id: string;
  tool: string;
  params: unknown;
}

export interface ToolResponse {
  id: string;
  result: ToolResult;
}

import path from 'node:path';

export abstract class Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  
  abstract execute(params: unknown): Promise<ToolResult>;
  
  protected validatePath(filePath: string): boolean {
    // Security: Only allow paths within project
    const resolved = path.resolve(filePath);
    const cwd = process.cwd();
    
    // Allow src/, test/, docs/, scripts/ directories
    const allowedPrefixes = [
      path.join(cwd, 'src'),
      path.join(cwd, 'test'),
      path.join(cwd, 'docs'),
      path.join(cwd, 'scripts'),
    ];
    
    return allowedPrefixes.some(prefix => resolved.startsWith(prefix));
  }
  
  protected formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
