/**
 * Phase 9: Self-Hosting Task Ledger
 *
 * A thin workflow layer that composes LiminalFS (persistence),
 * RalphLoop (execution), and ScoringEngine (verification) to enable
 * bounded self-hosting task execution with full lineage tracking.
 */

// Types — always available
export type {
  TaskStatus,
  TaskClass,
  FileAccessPolicy,
  TaskManifest,
  TaskAttempt,
  TaskCandidate,
  TaskDecision,
  LedgerCLIAction,
} from './types.js';

// TaskLedger — core persistence layer
export { TaskLedger } from './TaskLedger.js';
