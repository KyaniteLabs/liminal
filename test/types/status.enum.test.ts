import { describe, it, expect } from 'vitest';
import { Status, isValidStatus, isTerminalStatus, isWaitingStatus, TERMINAL_STATUSES, ACTIVE_STATUSES, WAITING_STATUSES } from '../../src/types/status.js';

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
