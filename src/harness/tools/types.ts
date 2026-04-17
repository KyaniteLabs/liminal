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
  offset?: number;
  /** 1-based line number alias for offset; useful for models reading startLine/endLine metadata. */
  startLine?: number;
  limit?: number;
}

export interface ReadFileResult {
  content: string;
  exists: boolean;
  lineCount: number;
  truncated?: boolean;
  startLine?: number;
  endLine?: number;
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
  oldString?: string;
  newString?: string;
  /** Alias commonly emitted by model planners. */
  search?: string;
  /** Alias commonly emitted by model planners. */
  replace?: string;
  createBackup?: boolean;
}

export interface ApplyEditResult {
  replacements: number;
  backupPath?: string;
  /** Hint for which verification tool to use based on file extension */
  verificationHint?: string;
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

export interface GitStatusParams {
  path?: string;
}

export interface GitStatusResult {
  branch: string;
  commitSha: string;
  shortSha: string;
  hasHeadCommit: boolean;
  short: string;
  clean: boolean;
  root: string;
}

export interface LocalCheckpointParams {
  /** Short description of what was accomplished */
  message: string;
  /** Task ID for traceability */
  taskId?: string;
  /** Whether to run build verification before committing (default: true) */
  verifyBuild?: boolean;
}

export interface LocalCheckpointResult {
  /** The commit hash of the checkpoint */
  commitHash: string;
  /** Short commit hash */
  shortHash: string;
  /** Branch the checkpoint was created on */
  branch: string;
  /** Number of files changed */
  filesChanged: number;
  /** Whether build verification was run and passed */
  buildVerified: boolean;
}

export interface CreateBackupParams {
  path: string;
}

export interface CreateBackupResult {
  backupPath: string;
  originalPath: string;
  success: boolean;
}

export interface RestoreBackupParams {
  backupPath: string;
  originalPath?: string;
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

export interface CommandRunnerResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; timeout: number },
) => Promise<CommandRunnerResult>;

import path from 'node:path';

export abstract class Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  
  abstract execute(params: unknown): Promise<ToolResult>;
  
  protected validatePath(filePath: string): boolean {
    // Security: Only allow paths within project
    const resolved = path.resolve(filePath);
    const cwd = process.cwd();
    
    // Allow project implementation and verification surfaces. Bubble Tea is
    // part of the active TUI, so the meta-harness must be able to inspect and
    // patch it instead of falsely reporting that tools cannot touch the UI.
    const allowedPrefixes = [
      path.join(cwd, 'src'),
      path.join(cwd, 'test'),
      path.join(cwd, 'docs'),
      path.join(cwd, 'scripts'),
      path.join(cwd, 'bubbletea'),
      path.join(cwd, 'harness-tasks'),
      path.join(cwd, '.omx'),
    ];
    const allowedFiles = [
      path.join(cwd, 'package.json'),
      path.join(cwd, 'package-lock.json'),
      path.join(cwd, 'pnpm-lock.yaml'),
    ];

    return resolved === cwd ||
      allowedFiles.includes(resolved) ||
      allowedPrefixes.some(prefix => resolved.startsWith(prefix));
  }
  
  protected formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
