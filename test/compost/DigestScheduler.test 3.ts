import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for DigestScheduler — schedules periodic digestion.
 */

import { DigestScheduler } from '../../src/compost/DigestScheduler.js';

describe('DigestScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedule with manual mode does nothing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockMill: any = { digest: vi.fn() };
    const scheduler = new DigestScheduler();
    scheduler.schedule(mockMill, 'manual');
    vi.advanceTimersByTime(100000);
    expect(mockMill.digest).not.toHaveBeenCalled();
  });

  it('cancel removes scheduled trigger', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockMill: any = { digest: vi.fn() };
    const scheduler = new DigestScheduler();
    scheduler.schedule(mockMill, 'daily');
    scheduler.cancel();
    vi.advanceTimersByTime(100000);
    expect(mockMill.digest).not.toHaveBeenCalled();
  });
});
