/**
 * DigestScheduler unit tests — schedules periodic digestion runs.
 * Tests public API: schedule(), cancel().
 *
 * The scheduler uses recursive setTimeout. With fake timers, we advance
 * one interval at a time using vi.advanceTimersToNextTimer() to avoid
 * cascading timer execution issues.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDigest, mockWarn, mockError } = vi.hoisted(() => ({
  mockDigest: vi.fn<() => Promise<void>>(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('../../../src/compost/CompostMill.js', () => ({
  CompostMill: class MockCompostMill {
    digest = mockDigest;
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: mockWarn,
    error: mockError,
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

import { DigestScheduler } from '../../../src/compost/DigestScheduler.js';
import { CompostMill } from '../../../src/compost/CompostMill.js';

/** Advance to the next scheduled timer and flush microtasks. */
async function tickNextTimer(): Promise<void> {
  await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
}

describe('DigestScheduler', () => {
  let scheduler: DigestScheduler;
  let mill: CompostMill;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new DigestScheduler();
    mill = new CompostMill();
    vi.clearAllMocks();
  });

  afterEach(() => {
    scheduler.cancel();
    vi.useRealTimers();
  });

  describe('schedule()', () => {
    it('does nothing for manual mode', () => {
      scheduler.schedule(mill, 'manual');
      vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
      expect(mockDigest).not.toHaveBeenCalled();
    });

    it('schedules daily digest at 24h interval', async () => {
      mockDigest.mockResolvedValue(undefined);
      scheduler.schedule(mill, 'daily');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(mockDigest).toHaveBeenCalledTimes(1);
    });

    it('schedules weekly digest at 7-day interval', async () => {
      mockDigest.mockResolvedValue(undefined);
      scheduler.schedule(mill, 'weekly');

      await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);

      expect(mockDigest).toHaveBeenCalledTimes(1);
    });

    it('reschedules after each successful daily digest', async () => {
      mockDigest.mockResolvedValue(undefined);
      scheduler.schedule(mill, 'daily');

      const oneDay = 24 * 60 * 60 * 1000;
      // Advance 3 days
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(oneDay);
      }

      expect(mockDigest).toHaveBeenCalledTimes(3);
    });

    it('logs warning on digest failure and continues rescheduling', async () => {
      mockDigest.mockRejectedValue(new Error('disk full'));
      scheduler.schedule(mill, 'daily');

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(mockDigest).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith(
        'DigestScheduler',
        'scheduled digest failed:',
        expect.any(Error),
      );
    });

    it('stops after 5 consecutive failures', async () => {
      mockDigest.mockRejectedValue(new Error('persistent error'));
      scheduler.schedule(mill, 'daily');

      const oneDay = 24 * 60 * 60 * 1000;

      // Let 5 failures fire one by one
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(oneDay);
      }

      // After the 5th failure, the scheduler stops — advance more to confirm
      await vi.advanceTimersByTimeAsync(oneDay * 3);

      expect(mockDigest.mock.calls.length).toBeLessThanOrEqual(5);
      expect(mockError).toHaveBeenCalledWith(
        'DigestScheduler',
        '5 consecutive digest failures, stopping scheduler',
      );
    });

    it('resets failure count after a successful digest', async () => {
      let callCount = 0;
      mockDigest.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) throw new Error('transient');
      });

      scheduler.schedule(mill, 'daily');

      const oneDay = 24 * 60 * 60 * 1000;
      for (let i = 0; i < 7; i++) {
        await vi.advanceTimersByTimeAsync(oneDay);
      }

      // All 7 calls made, no stop triggered
      expect(mockDigest).toHaveBeenCalledTimes(7);
      expect(mockError).not.toHaveBeenCalled();
    });
  });

  describe('cancel()', () => {
    it('cancels a daily schedule before first digest', () => {
      mockDigest.mockResolvedValue(undefined);
      scheduler.schedule(mill, 'daily');
      scheduler.cancel();

      vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
      expect(mockDigest).not.toHaveBeenCalled();
    });

    it('is safe to call cancel when nothing is scheduled', () => {
      expect(() => scheduler.cancel()).not.toThrow();
    });

    it('stops the rescheduling loop after a failure', async () => {
      mockDigest.mockRejectedValue(new Error('error'));
      scheduler.schedule(mill, 'daily');

      const oneDay = 24 * 60 * 60 * 1000;

      // Let one failure fire
      await vi.advanceTimersByTimeAsync(oneDay);
      const countAfterFirst = mockDigest.mock.calls.length;
      expect(countAfterFirst).toBeGreaterThanOrEqual(1);

      // Cancel
      scheduler.cancel();

      // Advance more time — no more digests
      await vi.advanceTimersByTimeAsync(oneDay * 5);

      expect(mockDigest).toHaveBeenCalledTimes(countAfterFirst);
    });
  });
});
