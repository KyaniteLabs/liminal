/**
 * Git Module — Barrel exports
 *
 * Provides version control integration for Sinter:
 * - GitService: Core git operations (commit, branch, diff, log)
 * - GitIntegration: RalphLoop orchestrator (branch-per-run, commit-per-iteration)
 * - GitCLI: CLI handler for `sinter git <subcommand>`
 */

export { GitService } from './GitService.js';
export { GitIntegration } from './GitIntegration.js';
export { handleGitCommand } from './GitCLI.js';
export type {
  GitConfig,
  CommitInfo,
  BranchInfo,
  DiffResult,
  DiffFile,
  IterationCommitContext,
  GitTimelineEntry,
  LogOptions,
} from './types.js';
export { DEFAULT_GIT_CONFIG } from './types.js';
