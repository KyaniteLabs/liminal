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
  ROLLED_BACK = 'rolled_back',
  /** Run was checkpointed and suspended - can be resumed */
  SUSPENDED = 'suspended'
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
 * Resumable statuses - jobs that were suspended and can be continued
 */
export const RESUMABLE_STATUSES = [
  Status.SUSPENDED
];

export type StatusLifecycleCategory =
  | 'waiting'
  | 'active'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'suspended';

export type StatusNextActionName =
  | 'none'
  | 'resume_checkpoint'
  | 'retry_provider'
  | 'switch_model'
  | 'shrink_prompt'
  | 'inspect_file'
  | 'rerun_verification';

export interface StatusNextAction {
  action: StatusNextActionName;
  label: string;
  reason: string;
}

export interface StatusLifecycleHints {
  lastVerification?: {
    passed: boolean;
    type: string;
    error?: string;
  };
  mutatedFiles?: string[];
}

export interface StatusLifecycleDescriptor {
  status: Status;
  category: StatusLifecycleCategory;
  terminal: boolean;
  active: boolean;
  waiting: boolean;
  succeeded: boolean;
  failed: boolean;
  cancelled: boolean;
  suspended: boolean;
  resumable: boolean;
  rolledBack: boolean;
  retryable: boolean;
  nextAction: StatusNextAction;
}

/**
 * Check if a status is active (job currently processing)
 */
export function isActiveStatus(status: Status): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Check if a status is resumable (suspended with checkpoint)
 */
export function isResumableStatus(status: Status): boolean {
  return RESUMABLE_STATUSES.includes(status);
}

export function isSuccessfulStatus(status: Status): boolean {
  return status === Status.SUCCESS || status === Status.COMPLETED;
}

export function isFailedStatus(status: Status): boolean {
  return status === Status.FAILED || status === Status.ROLLED_BACK;
}

export function isRetryableStatusReceipt(receipt?: string): boolean {
  if (!receipt) return false;
  if (/\bretryable\s*=\s*false\b/i.test(receipt)) return false;
  if (/\bretryable\s*=\s*true\b/i.test(receipt)) return true;
  return /rate limit|429|529|overload|timeout|502|503|504|upstream|temporar/i.test(receipt);
}

export function classifyStatusNextAction(
  status: Status,
  receipt?: string,
  hints: StatusLifecycleHints = {},
): StatusNextAction {
  const text = `${receipt || ''}\n${hints.lastVerification?.error || ''}`.trim();

  if (isResumableStatus(status)) {
    return {
      action: 'resume_checkpoint',
      label: 'Resume checkpoint',
      reason: 'The run was suspended with a checkpoint and should continue from saved state.',
    };
  }

  if (hints.lastVerification && !hints.lastVerification.passed) {
    return {
      action: 'rerun_verification',
      label: 'Rerun verification',
      reason: `The last ${hints.lastVerification.type} verification failed and should be rerun after the focused fix.`,
    };
  }

  if (/context window|context length|token limit|too many tokens|prompt too large|request too large|413\b|maximum context/i.test(text)) {
    return {
      action: 'shrink_prompt',
      label: 'Shrink prompt',
      reason: 'The failure indicates the prompt or context packet exceeded the provider limit.',
    };
  }

  if (/unsupported|response_format|not supported|model .*not|capability|vision.*not|tool.*not/i.test(text)) {
    return {
      action: 'switch_model',
      label: 'Switch model',
      reason: 'The failure indicates the selected route or model lacks the required capability.',
    };
  }

  if (isRetryableStatusReceipt(text)) {
    return {
      action: 'retry_provider',
      label: 'Retry provider',
      reason: 'The provider failure is marked transient or retryable.',
    };
  }

  if (isSuccessfulStatus(status)) {
    return {
      action: 'none',
      label: 'No failure action',
      reason: 'The run completed successfully.',
    };
  }

  return {
    action: 'inspect_file',
    label: 'Inspect file',
    reason: hints.mutatedFiles?.[0]
      ? `Inspect ${hints.mutatedFiles[0]} and the latest failure context.`
      : 'Inspect the latest failure context and relevant files before retrying.',
  };
}

export function describeStatusLifecycle(
  status: Status,
  receipt?: string,
  hints: StatusLifecycleHints = {},
): StatusLifecycleDescriptor {
  const waiting = isWaitingStatus(status);
  const active = isActiveStatus(status);
  const resumable = isResumableStatus(status);
  const succeeded = isSuccessfulStatus(status);
  const failed = isFailedStatus(status);
  const cancelled = status === Status.CANCELLED;
  const rolledBack = status === Status.ROLLED_BACK;
  const category: StatusLifecycleCategory = waiting
    ? 'waiting'
    : active
      ? 'active'
      : resumable
        ? 'suspended'
        : succeeded
          ? 'succeeded'
          : cancelled
            ? 'cancelled'
            : 'failed';

  return {
    status,
    category,
    terminal: isTerminalStatus(status),
    active,
    waiting,
    succeeded,
    failed,
    cancelled,
    suspended: status === Status.SUSPENDED,
    resumable,
    rolledBack,
    retryable: isRetryableStatusReceipt(receipt),
    nextAction: classifyStatusNextAction(status, receipt, hints),
  };
}

export function formatStatusEvidenceLines(lifecycle: StatusLifecycleDescriptor): string[] {
  return [
    `- Resumable: ${lifecycle.resumable ? 'yes' : 'no'}`,
    `- Retryable provider failure: ${lifecycle.retryable ? 'yes' : 'no'}`,
    `- Next action: ${lifecycle.nextAction.label}`,
  ];
}

export function formatStatusNextAction(action: StatusNextAction, separator = ': '): string {
  return `${action.label}${separator}${action.reason}`;
}

export function formatStatusRiskLine(lifecycle: StatusLifecycleDescriptor): string {
  if (lifecycle.resumable) {
    return '- Medium: checkpointed work exists; resume before starting a replacement run in the same area.';
  }
  if (lifecycle.succeeded) {
    return '- Low: trust generated changes only after reviewing the diff and verification output.';
  }
  return '- The run did not report full success; inspect logs and working tree changes before trusting results.';
}
