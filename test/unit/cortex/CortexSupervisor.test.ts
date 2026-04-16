import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CortexSupervisor } from '../../../src/cortex/CortexSupervisor.js';

describe('CortexSupervisor', () => {
  let supervisor: CortexSupervisor;

  beforeEach(() => {
    supervisor = new CortexSupervisor();
  });

  it('grants a lease and tracks it', () => {
    const lease = supervisor.grantLease('act-1', 5000, 'Test action');
    expect(lease.actionId).toBe('act-1');
    expect(lease.deadlineMs).toBe(5000);
    expect(lease.description).toBe('Test action');
    expect(lease.startedAt).toBeTruthy();

    const active = supervisor.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].actionId).toBe('act-1');
  });

  it('revokes an existing lease', () => {
    supervisor.grantLease('act-1', 5000, 'Test');
    expect(supervisor.revokeLease('act-1')).toBe(true);
    expect(supervisor.getActive()).toHaveLength(0);
  });

  it('returns false when revoking unknown lease', () => {
    expect(supervisor.revokeLease('nonexistent')).toBe(false);
  });

  it('detects expired leases', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-16T12:00:00Z');
    vi.setSystemTime(now);

    supervisor.grantLease('act-1', 1000, 'Short deadline');

    vi.advanceTimersByTime(2000);
    const expired = supervisor.checkExpired();

    expect(expired).toHaveLength(1);
    expect(expired[0].actionId).toBe('act-1');
    expect(supervisor.getActive()).toHaveLength(0);

    vi.useRealTimers();
  });

  it('keeps non-expired leases after check', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));

    supervisor.grantLease('act-1', 10000, 'Long deadline');

    vi.advanceTimersByTime(5000);
    const expired = supervisor.checkExpired();

    expect(expired).toHaveLength(0);
    expect(supervisor.getActive()).toHaveLength(1);

    vi.useRealTimers();
  });

  it('getStuck returns past-deadline leases without removing them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));

    supervisor.grantLease('act-1', 1000, 'Will be stuck');

    vi.advanceTimersByTime(5000);
    const stuck = supervisor.getStuck();

    expect(stuck).toHaveLength(1);
    expect(stuck[0].actionId).toBe('act-1');
    // getStuck does NOT remove — checkExpired does
    expect(supervisor.getActive()).toHaveLength(1);

    vi.useRealTimers();
  });

  it('getStuck returns empty for active leases', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));

    supervisor.grantLease('act-1', 60000, 'Still active');
    vi.advanceTimersByTime(1000);

    expect(supervisor.getStuck()).toHaveLength(0);

    vi.useRealTimers();
  });

  it('handles multiple leases with mixed states', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));

    supervisor.grantLease('act-1', 1000, 'Short');
    supervisor.grantLease('act-2', 60000, 'Long');

    vi.advanceTimersByTime(5000);
    const expired = supervisor.checkExpired();

    expect(expired).toHaveLength(1);
    expect(expired[0].actionId).toBe('act-1');
    expect(supervisor.getActive()).toHaveLength(1);
    expect(supervisor.getActive()[0].actionId).toBe('act-2');

    vi.useRealTimers();
  });

  it('clear removes all leases', () => {
    supervisor.grantLease('a', 5000, 'A');
    supervisor.grantLease('b', 5000, 'B');
    supervisor.clear();
    expect(supervisor.getActive()).toHaveLength(0);
  });
});
