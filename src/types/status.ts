/**
 * Task/job status values
 * Use these instead of magic strings
 */
export enum Status {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
  IDLE = 'idle',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Type guard for Status enum
 */
export function isValidStatus(value: string): value is Status {
  return Object.values(Status).includes(value as Status);
}

/**
 * Terminal statuses - jobs that have finished processing
 */
export const TERMINAL_STATUSES = [
  Status.COMPLETED, 
  Status.FAILED, 
  Status.CANCELLED, 
  Status.SKIPPED,
  Status.SUCCESS,
  Status.ROLLED_BACK
];

/**
 * Active statuses - jobs that are currently being processed
 */
export const ACTIVE_STATUSES = [
  Status.RUNNING,
  Status.IN_PROGRESS
];

/**
 * Waiting statuses - jobs queued but not started
 */
export const WAITING_STATUSES = [
  Status.PENDING, 
  Status.QUEUED, 
  Status.IDLE
];

/**
 * Check if a status is terminal (job has finished)
 */
export function isTerminalStatus(status: Status): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if a status is waiting (job queued but not started)
 */
export function isWaitingStatus(status: Status): boolean {
  return WAITING_STATUSES.includes(status);
}

/**
 * Check if a status is active (job currently processing)
 */
export function isActiveStatus(status: Status): boolean {
  return ACTIVE_STATUSES.includes(status);
}


