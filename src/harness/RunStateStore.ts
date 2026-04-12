/**
 * RunStateStore - Persist and detect resumable self-improvement runs
 *
 * When a run is interrupted or exhausts its step budget, this module
 * writes enough state to .omx/run-state.json so a subsequent run
 * can detect it and resume instead of starting from zero.
 *
 * This is NOT a replacement for LocalCheckpoint - that handles git commits.
 * This handles the runtime resume-detection layer on top.
 *
 * Semantic boundaries define safe resume points:
 * - run_created: initial state, no work done
 * - plan_committed: LLM has committed to a plan
 * - mutation_applied: a file mutation has been applied
 * - verification_started: build/test verification started
 * - verification_finished: verification completed
 * - interrupted: process was interrupted mid-run
 * - completed: run finished successfully
 * - failed: run failed terminally
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from '../utils/Logger.js';
import { Status } from '../types/status.js';

const execFileAsync = promisify(execFile);

/**
 * Semantic boundaries for run state.
 * Resume is only allowed from committed boundaries.
 */
export enum SemanticBoundary {
  RUN_CREATED = 'run_created',
  PLAN_COMMITTED = 'plan_committed',
  MUTATION_APPLIED = 'mutation_applied',
  VERIFICATION_STARTED = 'verification_started',
  VERIFICATION_FINISHED = 'verification_finished',
  INTERRUPTED = 'interrupted',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Verification state snapshot for resume context.
 */
export interface VerificationState {
  /** Whether the last verification passed */
  passed: boolean;
  /** Type of verification (build, test, typecheck) */
  type: string;
  /** Error message if verification failed */
  error?: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Workspace fingerprint for detecting changes between runs.
 */
export interface WorkspaceFingerprint {
  /** Git HEAD commit hash */
  gitHead: string;
  /** Git branch name */
  gitBranch: string;
  /** Whether working tree is clean */
  workingTreeClean: boolean;
  /** Timestamp when fingerprint was taken */
  timestamp: string;
}

export interface RunState {
  /** Unique run identifier */
  runId: string;
  /** Task ID of the suspended run */
  taskId: string;
  /** Task title */
  taskTitle: string;
  /** Task description */
  taskDescription: string;
  /** Status when suspended */
  status: Status.SUSPENDED;
  /** Current semantic boundary */
  phase: SemanticBoundary;
  /** Steps completed before suspension */
  stepsCompleted: number;
  /** Maximum steps in original budget */
  maxSteps: number;
  /** Whether to continue until done */
  continueUntilDone: boolean;
  /** ISO timestamp of when the run started */
  startedAt: string;
  /** ISO timestamp of when the run was suspended */
  suspendedAt: string;
  /** Git commit hash of the last checkpoint (if any) */
  lastCheckpointHash?: string;
  /** File hints that were already explored */
  exploredPaths: string[];
  /** Summary of what was accomplished */
  progressSummary: string;
  /** Whether the run had made mutations before suspension */
  hadMutations: boolean;
  /** Whether a mutation has been applied and not yet verified */
  mutationApplied: boolean;
  /** Last verification state */
  lastVerification?: VerificationState;
  /** Workspace fingerprint at time of suspension */
  workspaceFingerprint?: WorkspaceFingerprint;
  /** Reason for interruption (if interrupted) */
  interruptionReason?: string;
  /** Files that were mutated in this run */
  mutatedFiles: string[];
  /** Active bounded-focus file when the run was suspended */
  activeFocusFile?: string;
  /** Index into primaryFiles for the active focus */
  activeFocusIndex?: number;
  /** Remaining inspection reads for the active focus */
  focusInspectionBudgetRemaining?: number;
  /** Current focus status */
  focusStatus?: 'unresolved' | 'committed' | 'rejected';
  /** Whether the one-off adjacent read allowance has been used */
  focusAdjacentFileUsed?: boolean;
  /** Last explicit focus decision */
  focusDecision?: 'reject' | 'resolve';
  /** When the last explicit focus decision was made */
  focusDecisionAt?: string;
}

const RUN_STATE_DIR = '.omx';
const RUN_STATE_FILE = 'run-state.json';

function runStatePath(cwd?: string): string {
  return join(cwd ?? process.cwd(), RUN_STATE_DIR, RUN_STATE_FILE);
}

/**
 * Save run state for later resume
 */
export async function saveRunState(state: RunState, cwd?: string): Promise<void> {
  const dir = join(cwd ?? process.cwd(), RUN_STATE_DIR);
  await mkdir(dir, { recursive: true });

  const path = runStatePath(cwd);
  Logger.debug('RunStateStore', `Saving run state to ${path}`);

  await writeFile(path, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Read any existing run state
 */
export async function readRunState(cwd?: string): Promise<RunState | null> {
  const path = runStatePath(cwd);
  try {
    const content = await readFile(path, 'utf-8');
    const state = JSON.parse(content) as RunState;
    if (state.status === Status.SUSPENDED) {
      return state;
    }
    return null;
  } catch {
    // No run state file or invalid JSON - no resumable run
    return null;
  }
}

/**
 * Clear run state (called on successful completion or when explicitly abandoning a run)
 */
export async function clearRunState(cwd?: string): Promise<void> {
  const path = runStatePath(cwd);
  try {
    await writeFile(path, '', 'utf-8');
  } catch {
    // Ignore - file may not exist
  }
}

/**
 * Capture a workspace fingerprint for later identity verification.
 *
 * The fingerprint records git HEAD, branch, and working-tree cleanliness
 * so that a subsequent resume can detect if the workspace has drifted.
 */
export async function captureWorkspaceFingerprint(cwd?: string): Promise<WorkspaceFingerprint> {
  const repoPath = cwd ?? process.cwd();

  const [{ stdout: head }, { stdout: branch }, { stdout: short }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, timeout: 10_000 }),
    execFileAsync('git', ['branch', '--show-current'], { cwd: repoPath, timeout: 10_000 }),
    execFileAsync('git', ['status', '--short'], { cwd: repoPath, timeout: 10_000 }),
  ]);

  return {
    gitHead: head.trim(),
    gitBranch: branch.trim(),
    workingTreeClean: short.trim().length === 0,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate that the current workspace matches a previously captured fingerprint.
 *
 * Returns { valid: true } if the workspace identity has not drifted,
 * or { valid: false, reason } explaining the mismatch.
 */
export async function validateWorkspaceFingerprint(
  saved: WorkspaceFingerprint,
  cwd?: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  const current = await captureWorkspaceFingerprint(cwd);

  if (current.gitHead !== saved.gitHead) {
    return {
      valid: false,
      reason: `HEAD mismatch: saved=${saved.gitHead.slice(0, 8)}, current=${current.gitHead.slice(0, 8)}`,
    };
  }

  if (current.gitBranch !== saved.gitBranch) {
    return {
      valid: false,
      reason: `Branch mismatch: saved=${saved.gitBranch}, current=${current.gitBranch}`,
    };
  }

  // Working-tree cleanliness guard: if the workspace was clean at
  // suspension time, it must still be clean on resume.  A dirty tree
  // on resume when the saved state expected cleanliness indicates
  // external modifications that could conflict with the resumed run.
  if (saved.workingTreeClean && !current.workingTreeClean) {
    return {
      valid: false,
      reason: 'Working tree was clean at suspension but is now dirty - external modifications detected',
    };
  }

  return { valid: true };
}

/**
 * Check if there is a resumable run for a given task ID
 */
export async function hasResumableRun(taskId?: string, cwd?: string): Promise<RunState | null> {
  const state = await readRunState(cwd);
  if (!state) return null;
  if (taskId && state.taskId !== taskId) return null;
  return state;
}

function formatVerificationSummary(lastVerification?: VerificationState): string | null {
  if (!lastVerification) return null;

  const outcome = lastVerification.passed ? 'passed' : 'failed';
  const errorSuffix = lastVerification.error ? ` — ${lastVerification.error}` : '';
  return `Last verification: ${lastVerification.type} ${outcome} at ${lastVerification.timestamp}${errorSuffix}`;
}

/**
 * Format a progress summary from a session for resume context
 */
export function formatResumeContext(state: RunState): string {
  const verificationSummary = formatVerificationSummary(state.lastVerification);
  const lines = [
    `## Resume Context`,
    ``,
    `A previous run of this task was suspended after ${state.stepsCompleted}/${state.maxSteps} steps.`,
    `Started: ${state.startedAt}`,
    `Suspended: ${state.suspendedAt}`,
    `Phase at suspension: ${state.phase}`,
    state.lastCheckpointHash ? `Last checkpoint: ${state.lastCheckpointHash.slice(0, 8)}` : 'No checkpoint was created',
    state.hadMutations ? 'Mutations were made and checkpointed.' : 'No mutations were made.',
    state.mutatedFiles.length > 0 ? `Files already mutated: ${state.mutatedFiles.join(', ')}` : '',
    state.exploredPaths.length > 0 ? `Paths already explored: ${state.exploredPaths.join(', ')}` : '',
    state.activeFocusFile ? `Active focus file: ${state.activeFocusFile}` : '',
    typeof state.focusInspectionBudgetRemaining === 'number' ? `Focus inspection reads remaining: ${state.focusInspectionBudgetRemaining}` : '',
    state.focusDecision ? `Last focus decision: ${state.focusDecision}${state.focusDecisionAt ? ` at ${state.focusDecisionAt}` : ''}` : '',
    verificationSummary ?? '',
    ``,
    `Progress: ${state.progressSummary}`,
    ``,
    `Continue from where the previous run left off. Do NOT re-explore files already examined.`,
    `Pick up the implementation at the next logical step.`,
  ];
  return lines.filter(l => l !== '' || lines.indexOf(l) < 3).join('\n');
}
