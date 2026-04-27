/**
 * Git Module Types — Interfaces for Git integration
 *
 * GitConfig controls the RalphLoop integration behavior.
 * CommitInfo, BranchInfo, DiffResult wrap simple-git responses
 * into Liminal-native shapes.
 */

/** Configuration for git integration in RalphLoop */
export interface GitConfig {
  /** Enable git integration (default: false) */
  enabled: boolean;
  /** Auto-commit each RalphLoop iteration (default: false) */
  autoCommit: boolean;
  /** Create a branch per RalphLoop run (default: true when enabled) */
  branchPerRun: boolean;
  /** Branch name prefix (default: "liminal/") */
  branchPrefix: string;
  /** Auto-push after each commit (default: false) */
  autoPush: boolean;
  /** Commit message template. Variables: {prompt}, {n}, {score}, {model} */
  commitMessageTemplate: string;
  /** Bridge git events to compost EventStore (default: true) */
  bridgeToCompost: boolean;
}

/** Default git configuration — opt-in so creative runs never mutate the caller's branch */
export const DEFAULT_GIT_CONFIG: GitConfig = {
  enabled: false,
  autoCommit: true,
  branchPerRun: true,
  branchPrefix: 'liminal/',
  autoPush: false,
  commitMessageTemplate: 'liminal: {prompt} iteration {n} (score: {score})',
  bridgeToCompost: true,
};

/** Information about a single git commit */
export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
  /** Files changed in this commit */
  files?: string[];
}

/** Information about a git branch */
export interface BranchInfo {
  name: string;
  current: boolean;
  /** Commit hash at branch tip */
  commit: string;
}

/** Result of a diff between two refs */
export interface DiffResult {
  from: string;
  to: string;
  /** Number of files changed */
  filesChanged: number;
  /** Lines added */
  insertions: number;
  /** Lines removed */
  deletions: number;
  /** Per-file diff summary */
  files: DiffFile[];
}

/** Summary of a single file's changes in a diff */
export interface DiffFile {
  path: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

/** Context passed when committing a RalphLoop iteration */
export interface IterationCommitContext {
  prompt: string;
  score: number;
  model?: string;
  iteration: number;
  code: string;
  filePath: string;
}

/** A unified timeline entry from git or compost sources */
export interface GitTimelineEntry {
  timestamp: string;
  source: 'git' | 'compost';
  type: string;
  data: Record<string, unknown>;
}

/** Options for log queries */
export interface LogOptions {
  maxCount?: number;
  branch?: string;
  file?: string;
}
