/**
 * Meta-Harness Tools Index
 * 
 * Tool-based agent architecture inspired by Claude Code:
 * - Each tool is a discrete capability
 * - Tools are rate-limited and validated
 * - Results are logged for learning
 */

export { Tool, type ToolResult, type ToolCall, type ToolResponse } from './types.js';

export { readFileTool, ReadFileTool } from './ReadFileTool.js';
export { writeFileTool, WriteFileTool } from './WriteFileTool.js';
export { applyEditTool, ApplyEditTool } from './ApplyEditTool.js';
export { runBuildTool, RunBuildTool } from './RunBuildTool.js';
export { runTestsTool, RunTestsTool } from './RunTestsTool.js';
export { searchTool, SearchTool } from './SearchTool.js';
export { searchCodeTool, SearchCodeTool } from './SearchCodeTool.js';
export { searchDocsTool, SearchDocsTool } from './SearchDocsTool.js';
export { listDirTool, ListDirTool } from './ListDirTool.js';
export { typeCheckTool, TypeCheckTool } from './TypeCheckTool.js';
export { npmTool, NpmTool } from './NpmTool.js';
export { runLintTool, RunLintTool } from './RunLintTool.js';
export { runFocusedTestsTool, RunFocusedTestsTool } from './RunFocusedTestsTool.js';
export { lspTool, LSPTool } from './LSPTool.js';
export { astValidatorTool, ASTValidatorTool } from './ASTValidatorTool.js';
export { importGuardTool, ImportGuardTool } from './ImportGuardTool.js';
export { gitStatusTool, GitStatusTool } from './GitStatusTool.js';
export { executeSkillTool, ExecuteSkillTool } from './ExecuteSkillTool.js';
export { createBackupTool, restoreBackupTool, CreateBackupTool, RestoreBackupTool } from './BackupTools.js';

export { rateLimiter, RateLimiter } from './RateLimiter.js';
export { validationGuard, ValidationGuard } from './ValidationGuard.js';

export { toolTelemetry, ToolTelemetry, type ToolCallRecord, type ToolTelemetryAnalysis } from './ToolTelemetry.js';
export { telemetryWrapper, TelemetryWrapper, type ToolContext } from './TelemetryWrapper.js';

export { createBackup, restoreBackup, cleanupOldBackups, listBackups } from './backup.js';
