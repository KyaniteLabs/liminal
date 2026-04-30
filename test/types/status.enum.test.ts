import { describe, it, expect } from 'vitest';
import {
  Status,
  isValidStatus,
  isTerminalStatus,
  isWaitingStatus,
  isResumableStatus,
  isRetryableStatusReceipt,
  classifyStatusNextAction,
  describeStatusLifecycle,
  formatStatusEvidenceLines,
  formatStatusNextAction,
  formatStatusRiskLine,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  WAITING_STATUSES,
  RESUMABLE_STATUSES,
} from '../../src/types/status.js';

describe('Status enum', () => {
  it('should have PENDING = pending', () => {
    expect(Status.PENDING).toBe('pending');
  });
  
  it('should have RUNNING = running', () => {
    expect(Status.RUNNING).toBe('running');
  });
  
  it('should have COMPLETED = completed', () => {
    expect(Status.COMPLETED).toBe('completed');
  });
  
  it('should have FAILED = failed', () => {
    expect(Status.FAILED).toBe('failed');
  });
  
  it('should have CANCELLED = cancelled', () => {
    expect(Status.CANCELLED).toBe('cancelled');
  });
  
  it('should have SKIPPED = skipped', () => {
    expect(Status.SKIPPED).toBe('skipped');
  });
  
  it('should have IDLE = idle', () => {
    expect(Status.IDLE).toBe('idle');
  });
  
  it('should have QUEUED = queued', () => {
    expect(Status.QUEUED).toBe('queued');
  });
  
  it('should have IN_PROGRESS = in_progress', () => {
    expect(Status.IN_PROGRESS).toBe('in_progress');
  });
  
  it('should have SUCCESS = success', () => {
    expect(Status.SUCCESS).toBe('success');
  });
  
  it('should have ROLLED_BACK = rolled_back', () => {
    expect(Status.ROLLED_BACK).toBe('rolled_back');
  });

  it('should have SUSPENDED = suspended', () => {
    expect(Status.SUSPENDED).toBe('suspended');
  });
  
  it('should include all statuses in values array', () => {
    const values = Object.values(Status);
    expect(values).toContain('pending');
    expect(values).toContain('running');
    expect(values).toContain('completed');
    expect(values).toContain('failed');
    expect(values).toContain('cancelled');
    expect(values).toContain('skipped');
    expect(values).toContain('idle');
    expect(values).toContain('queued');
    expect(values).toContain('in_progress');
    expect(values).toContain('success');
    expect(values).toContain('rolled_back');
    expect(values).toContain('suspended');
  });
  
  it('should distinguish terminal from non-terminal statuses', () => {
    // Terminal: completed, failed, cancelled, skipped, success, rolled_back
    // Non-terminal: pending, running, idle, queued, in_progress
    expect(Status.COMPLETED).not.toBe(Status.PENDING);
    expect(Status.FAILED).not.toBe(Status.RUNNING);
  });
});

describe('isValidStatus type guard', () => {
  it('should return true for valid status strings', () => {
    expect(isValidStatus('pending')).toBe(true);
    expect(isValidStatus('running')).toBe(true);
    expect(isValidStatus('completed')).toBe(true);
    expect(isValidStatus('failed')).toBe(true);
    expect(isValidStatus('suspended')).toBe(true);
  });
  
  it('should return false for invalid status strings', () => {
    expect(isValidStatus('invalid')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('active')).toBe(false);
  });
});

describe('TERMINAL_STATUSES array', () => {
  it('should include all terminal statuses', () => {
    expect(TERMINAL_STATUSES).toContain(Status.COMPLETED);
    expect(TERMINAL_STATUSES).toContain(Status.FAILED);
    expect(TERMINAL_STATUSES).toContain(Status.CANCELLED);
    expect(TERMINAL_STATUSES).toContain(Status.SKIPPED);
    expect(TERMINAL_STATUSES).toContain(Status.SUCCESS);
    expect(TERMINAL_STATUSES).toContain(Status.ROLLED_BACK);
  });
  
  it('should not include non-terminal statuses', () => {
    expect(TERMINAL_STATUSES).not.toContain(Status.PENDING);
    expect(TERMINAL_STATUSES).not.toContain(Status.RUNNING);
    expect(TERMINAL_STATUSES).not.toContain(Status.IDLE);
    expect(TERMINAL_STATUSES).not.toContain(Status.QUEUED);
    expect(TERMINAL_STATUSES).not.toContain(Status.IN_PROGRESS);
    expect(TERMINAL_STATUSES).not.toContain(Status.SUSPENDED);
  });
});

describe('ACTIVE_STATUSES array', () => {
  it('should include running status', () => {
    expect(ACTIVE_STATUSES).toContain(Status.RUNNING);
    expect(ACTIVE_STATUSES).toContain(Status.IN_PROGRESS);
  });
});

describe('WAITING_STATUSES array', () => {
  it('should include waiting statuses', () => {
    expect(WAITING_STATUSES).toContain(Status.PENDING);
    expect(WAITING_STATUSES).toContain(Status.QUEUED);
    expect(WAITING_STATUSES).toContain(Status.IDLE);
  });
});

describe('isTerminalStatus helper', () => {
  it('should return true for terminal statuses', () => {
    expect(isTerminalStatus(Status.COMPLETED)).toBe(true);
    expect(isTerminalStatus(Status.FAILED)).toBe(true);
    expect(isTerminalStatus(Status.CANCELLED)).toBe(true);
    expect(isTerminalStatus(Status.SKIPPED)).toBe(true);
    expect(isTerminalStatus(Status.SUCCESS)).toBe(true);
    expect(isTerminalStatus(Status.ROLLED_BACK)).toBe(true);
  });
  
  it('should return false for non-terminal statuses', () => {
    expect(isTerminalStatus(Status.PENDING)).toBe(false);
    expect(isTerminalStatus(Status.RUNNING)).toBe(false);
    expect(isTerminalStatus(Status.IDLE)).toBe(false);
    expect(isTerminalStatus(Status.QUEUED)).toBe(false);
    expect(isTerminalStatus(Status.IN_PROGRESS)).toBe(false);
    expect(isTerminalStatus(Status.SUSPENDED)).toBe(false);
  });
});

describe('isWaitingStatus helper', () => {
  it('should return true for waiting statuses', () => {
    expect(isWaitingStatus(Status.PENDING)).toBe(true);
    expect(isWaitingStatus(Status.QUEUED)).toBe(true);
    expect(isWaitingStatus(Status.IDLE)).toBe(true);
  });
  
  it('should return false for non-waiting statuses', () => {
    expect(isWaitingStatus(Status.RUNNING)).toBe(false);
    expect(isWaitingStatus(Status.COMPLETED)).toBe(false);
    expect(isWaitingStatus(Status.FAILED)).toBe(false);
    expect(isWaitingStatus(Status.IN_PROGRESS)).toBe(false);
  });
});

describe('canonical lifecycle helpers', () => {
  it('treats suspended as resumable but not failed or terminal', () => {
    expect(RESUMABLE_STATUSES).toContain(Status.SUSPENDED);
    expect(isResumableStatus(Status.SUSPENDED)).toBe(true);
    expect(describeStatusLifecycle(Status.SUSPENDED)).toMatchObject({
      category: 'suspended',
      suspended: true,
      resumable: true,
      failed: false,
      terminal: false,
    });
  });

  it('normalizes retryability from provider receipts', () => {
    expect(isRetryableStatusReceipt('OpenAI error | retryable=true')).toBe(true);
    expect(isRetryableStatusReceipt('OpenAI error | retryable=false | status=400')).toBe(false);
    expect(describeStatusLifecycle(Status.FAILED, 'upstream 503 timeout')).toMatchObject({
      failed: true,
      retryable: true,
    });
  });

  it('classifies actionable failure next steps', () => {
    expect(classifyStatusNextAction(Status.SUSPENDED).action).toBe('resume_checkpoint');
    expect(classifyStatusNextAction(Status.FAILED, 'context window exceeded').action).toBe('shrink_prompt');
    expect(classifyStatusNextAction(Status.FAILED, 'response_format not supported').action).toBe('switch_model');
    expect(classifyStatusNextAction(Status.FAILED, 'upstream 503 timeout').action).toBe('retry_provider');
    expect(classifyStatusNextAction(Status.FAILED, undefined, {
      lastVerification: { passed: false, type: 'build', error: 'tsc failed' },
    }).action).toBe('rerun_verification');
    expect(classifyStatusNextAction(Status.FAILED, 'parse failure', {
      mutatedFiles: ['src/foo.ts'],
    })).toMatchObject({
      action: 'inspect_file',
      reason: expect.stringContaining('src/foo.ts'),
    });
  });

  it('formats lifecycle evidence and action lines from the shared contract', () => {
    const lifecycle = describeStatusLifecycle(Status.SUSPENDED, 'MiniMax overload | retryable=true');

    expect(formatStatusEvidenceLines(lifecycle)).toEqual([
      '- Resumable: yes',
      '- Retryable provider failure: yes',
      '- Next action: Resume checkpoint',
    ]);
    expect(formatStatusNextAction(lifecycle.nextAction)).toBe('Resume checkpoint: The run was suspended with a checkpoint and should continue from saved state.');
    expect(formatStatusNextAction(lifecycle.nextAction, ' — ')).toBe('Resume checkpoint — The run was suspended with a checkpoint and should continue from saved state.');
    expect(formatStatusRiskLine(lifecycle)).toBe('- Medium: checkpointed work exists; resume before starting a replacement run in the same area.');
  });
});
