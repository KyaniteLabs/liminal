/**
 * Phase 9: Self-Hosting Task Ledger — Type Definitions
 *
 * Defines the manifest, attempt, candidate, and decision types
 * that represent the full lifecycle of a self-hosting task.
 * All entities are persisted via LiminalFS manifests, refs, and artifacts.
 */

import type { LiminalObjectRef } from '../fs/types.js';

// ─── Enums & Status ────────────────────────────────────────────────

/** Task status lifecycle */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';

/** Task class — determines difficulty, scope, and agent assignment */
export type TaskClass = 'leaf' | 'wiring' | 'harness-quality' | 'orchestrator';

// ─── File Access Policy ────────────────────────────────────────────

/** Bounded file access policy for task execution */
export interface FileAccessPolicy {
  /** Glob patterns for files the task is allowed to modify */
  allowlist: string[];
  /** Glob patterns for files the task must NOT modify */
  denylist: string[];
}

// ─── Task Manifest ─────────────────────────────────────────────────

/**
 * Task manifest — the core entity.
 * Stored as a LiminalFS manifest at `task/<id>/manifest`.
 */
export interface TaskManifest {
  /** Unique task identifier (e.g., 'L001', 'W001') */
  id: string;
  /** Short human-readable title */
  title: string;
  /** Detailed description of what the task should accomplish */
  description: string;
  /** Task classification — determines agent pool and retry budget */
  taskClass: TaskClass;
  /** Current lifecycle status */
  status: TaskStatus;
  /** File boundaries for task execution */
  files: FileAccessPolicy;
  /** Shell command to verify task completion (default: 'pnpm test') */
  verifyCommand: string;
  /** Scoring criteria passed to ScoringEngine for semantic evaluation */
  scoringCriteria: string[];
  /** Lane assignment for parallel execution */
  lane: number;
  /** Number of attempts recorded so far */
  attemptCount: number;
  /** Maximum attempts before marking as failed */
  maxAttempts: number;
  /** ISO 8601 timestamp when the task was created */
  createdAt: string;
  /** ISO 8601 timestamp when the task was last updated */
  updatedAt: string;
}

// ─── Task Attempt ──────────────────────────────────────────────────

/**
 * A single attempt at executing a task.
 * Stored as a LiminalFS manifest + ref at `task/<id>/attempt/<attempt-id>`.
 */
export interface TaskAttempt {
  /** Unique attempt identifier */
  id: string;
  /** Parent task identifier */
  taskId: string;
  /** The prompt sent to RalphLoop */
  prompt: string;
  /** RalphLoop run ID (from LoopResult.timestamp) */
  runId: string;
  /** ISO 8601 timestamp when execution started */
  startedAt: string;
  /** ISO 8601 timestamp when execution completed */
  completedAt: string;
  /** Duration in milliseconds */
  duration: number;
  /** Number of RalphLoop iterations */
  iterations: number;
  /** Whether RalphLoop reported completion */
  completed: boolean;
  /** RalphLoop's reason for stopping */
  reason: string;
  /** Final quality score from RalphLoop (0–1) */
  finalScore: number;
  /** Ref to the generated artifact (set after verification) */
  artifactRef: LiminalObjectRef | null;
}

// ─── Task Candidate ───────────────────────────────────────────────

/**
 * A verified candidate output for a task.
 * Stored as a LiminalFS artifact + ref at `task/<id>/candidate/<candidate-id>`.
 */
export interface TaskCandidate {
  /** Unique candidate identifier */
  id: string;
  /** Parent task identifier */
  taskId: string;
  /** Parent attempt identifier */
  attemptId: string;
  /** The generated code */
  code: string;
  /** Semantic score from ScoringEngine (0–1) */
  semanticScore: number;
  /** Whether the verify command passed */
  testPassed: boolean;
  /** ISO 8601 timestamp when the candidate was evaluated */
  evaluatedAt: string;
}

// ─── Task Decision ─────────────────────────────────────────────────

/**
 * An acceptance or rejection decision for a candidate.
 * Stored as a LiminalFS manifest at `task/<id>/decision/<decision-id>`.
 */
export interface TaskDecision {
  /** Unique decision identifier */
  id: string;
  /** Parent task identifier */
  taskId: string;
  /** Candidate this decision applies to */
  candidateId: string;
  /** The decision */
  decision: 'accepted' | 'rejected';
  /** Human-readable rationale */
  rationale: string;
  /** Combined score at decision time */
  score: number;
  /** ISO 8601 timestamp when the decision was made */
  decidedAt: string;
}

// ─── CLI Action ────────────────────────────────────────────────────

/** Discriminated union for CLI subcommand parsing */
export type LedgerCLIAction =
  | { command: 'list'; lane?: number }
  | { command: 'show'; taskId: string }
  | { command: 'run'; taskId: string; dryRun?: boolean }
  | { command: 'verify'; taskId: string }
  | { command: 'accept'; taskId: string; candidateId: string }
  | { command: 'reject'; taskId: string; candidateId: string; reason?: string }
  | { command: 'status' }
  | { command: 'load'; path: string };
