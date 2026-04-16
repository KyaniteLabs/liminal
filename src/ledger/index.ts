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
  FailureClass,
  FileCoverage,
  SourceAnnotation,
  ConveyorTaskResult,
  ConveyorBatchResult,
} from './types.js';

// TaskLedger — core persistence layer
export { TaskLedger } from './TaskLedger.js';

// TaskRunner — executes tasks via RalphLoop
export { TaskRunner } from './TaskRunner.js';

// TaskVerifier — scores + test-verifies candidates
export { TaskVerifier } from './TaskVerifier.js';

// @architecture Phase 10 conveyor modules
export { TaskIntake } from './TaskIntake.js';
export { ConveyorRunner } from './ConveyorRunner.js';
export { ReplayBundle } from './ReplayBundle.js';
export { ConveyorMonitor } from './ConveyorMonitor.js';
