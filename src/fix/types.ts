/**
 * Type definitions for the AutoFixOrchestrator system.
 *
 * These types support the `liminal fix` command for self-healing code fixes.
 */

/**
 * Types of fix requests supported by the orchestrator.
 */
export type FixType = 'file-error' | 'test-failures' | 'natural-language';

/**
 * Confirmation levels for applying fixes.
 */
export type ConfirmLevel = 'auto' | 'ask' | 'never';

/**
 * Request parameters for executing a fix.
 */
export interface FixRequest {
  /** Type of fix to perform */
  type: FixType;
  /** Target file, test pattern, or description */
  target?: string;
  /** Description of the error or issue */
  errorDescription?: string;
  /** If true, simulate the fix without applying changes */
  dryRun?: boolean;
  /** Level of user confirmation required */
  confirmLevel?: ConfirmLevel;
}

/**
 * Represents a single file change made during a fix.
 */
export interface FileChange {
  /** Path to the modified file */
  path: string;
  /** Path to the backup file (if created) */
  backupPath?: string;
  /** Diff of the changes made */
  diff?: string;
}

/**
 * Result of executing a fix request.
 */
export interface FixResult {
  /** Whether the fix was successful */
  success: boolean;
  /** Unique identifier for this fix task */
  taskId: string;
  /** List of file changes made */
  changes: FileChange[];
  /** Whether the build passed after applying fixes */
  buildPassed: boolean;
  /** Whether tests passed after applying fixes */
  testsPassed: boolean;
  /** Whether changes were rolled back due to failures */
  rolledBack: boolean;
  /** Error message if the fix failed */
  error?: string;
}
