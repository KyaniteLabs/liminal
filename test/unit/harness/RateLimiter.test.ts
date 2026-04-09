import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for RateLimiter - Burst protection and throttle enforcement
 *
 * RateLimiter tracks per-operation call counts within a sliding 1-minute window.
 * Key behaviors:
 * - checkBurst(): allows or blocks based on maxPerMinute config
 * - throttle(): enforces minimum delay between calls
 * - execute(): combines burst check + throttle + record + run
 * - getStatus(): reports current call count, limit, and remaining quota
 */

import { RateLimiter } from '../../../src/harness/tools/RateLimiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // checkBurst
  // ---------------------------------------------------------------------------
  describe('checkBurst', () => {
    it('allows calls within burst limit', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 5 } });

      for (let i = 0; i < 4; i++) {
        await limiter.recordCall('llmCall');
      }

      const result = await limiter.checkBurst('llmCall');

      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBeUndefined();
    });

    it('blocks calls that exceed burst limit', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 3 } });

      for (let i = 0; i < 3; i++) {
        await limiter.recordCall('llmCall');
      }

      const result = await limiter.checkBurst('llmCall');

      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('allows unknown operations (no config = unlimited)', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 1 } });

      // No config registered for 'unknownOp'
      const result = await limiter.checkBurst('unknownOp');

      expect(result.allowed).toBe(true);
    });

    it('releases block after time window passes', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 2 } });

      await limiter.recordCall('llmCall');
      await limiter.recordCall('llmCall');

      // Blocked now
      expect((await limiter.checkBurst('llmCall')).allowed).toBe(false);

      // Advance past the 1-minute window
      vi.advanceTimersByTime(60_000 + 1);

      // Should be allowed again — old calls are outside the window
      const result = await limiter.checkBurst('llmCall');
      expect(result.allowed).toBe(true);
    });

    it('reports retryAfterMs as time until oldest call exits the window', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 1 } });

      await limiter.recordCall('llmCall');
      // Elapse 10 seconds so the retry time is ~50s
      vi.advanceTimersByTime(10_000);

      const result = await limiter.checkBurst('llmCall');
      expect(result.allowed).toBe(false);
      // Should be roughly 50 seconds (60 - 10 = 50), allow ±2s for rounding
      expect(result.retryAfterMs!).toBeGreaterThanOrEqual(49_000);
      expect(result.retryAfterMs!).toBeLessThanOrEqual(51_000);
    });
  });

  // ---------------------------------------------------------------------------
  // throttle
  // ---------------------------------------------------------------------------
  describe('throttle', () => {
    it('delays when called too soon after previous call', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 2000, maxPerMinute: 100 } });

      // First call sets the last-call timestamp
      await limiter.throttle('llmCall');

      // Second call should delay for ~2000ms
      const promise = limiter.throttle('llmCall');

      // Not resolved yet (pending)
      vi.advanceTimersByTime(500);
      let resolved = false;
      promise.then(() => { resolved = true; });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      // Resolve after full delay
      vi.advanceTimersByTime(1500);
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(true);
    });

    it('does not delay when enough time has passed', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 1000, maxPerMinute: 100 } });

      await limiter.throttle('llmCall');

      // Advance well past the min delay
      vi.advanceTimersByTime(5000);

      // This should resolve immediately (no pending sleep)
      const start = Date.now();
      await limiter.throttle('llmCall');
      expect(Date.now()).toBe(start);
    });

    it('skips throttle for operations with zero minDelayMs', async () => {
      const limiter = new RateLimiter({ fastOp: { minDelayMs: 0, maxPerMinute: 100 } });

      // Two rapid calls should both resolve instantly
      await limiter.throttle('fastOp');
      await limiter.throttle('fastOp');
      // No assertion needed — if delay was applied the test would hang
    });

    it('skips throttle for unknown operations', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 5000, maxPerMinute: 5 } });

      // unknownOp has no config
      await limiter.throttle('unknownOp');
      await limiter.throttle('unknownOp');
    });
  });

  // ---------------------------------------------------------------------------
  // execute
  // ---------------------------------------------------------------------------
  describe('execute', () => {
    it('returns result when within limits', async () => {
      const limiter = new RateLimiter({ op: { minDelayMs: 0, maxPerMinute: 5 } });

      const result = await limiter.execute('op', async () => 42);

      expect(result.result).toBe(42);
      expect(result.error).toBeUndefined();
      expect(result.rateLimited).toBeUndefined();
    });

    it('returns rateLimited=true when burst limit exceeded', async () => {
      const limiter = new RateLimiter({ op: { minDelayMs: 0, maxPerMinute: 1 } });

      await limiter.execute('op', async () => 'first');
      const result = await limiter.execute('op', async () => 'second');

      expect(result.result).toBeUndefined();
      expect(result.rateLimited).toBe(true);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('catches and returns errors from the function', async () => {
      const limiter = new RateLimiter({ op: { minDelayMs: 0, maxPerMinute: 100 } });

      const result = await limiter.execute('op', async () => {
        throw new Error('boom');
      });

      expect(result.result).toBeUndefined();
      expect(result.error).toContain('boom');
      expect(result.rateLimited).toBeUndefined();
    });

    it('records the call on success', async () => {
      const limiter = new RateLimiter({ op: { minDelayMs: 0, maxPerMinute: 10 } });

      await limiter.execute('op', async () => 'ok');
      const status = await limiter.getStatus('op');

      expect(status.callsLastMinute).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------
  describe('getStatus', () => {
    it('returns zero counts for an untracked operation', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 5 } });

      const status = await limiter.getStatus('llmCall');

      expect(status.callsLastMinute).toBe(0);
      expect(status.limit).toBe(5);
      expect(status.remaining).toBe(5);
      expect(status.timeUntilReset).toBe(0);
    });

    it('returns correct counts after recorded calls', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 5 } });

      await limiter.recordCall('llmCall');
      await limiter.recordCall('llmCall');
      await limiter.recordCall('llmCall');

      const status = await limiter.getStatus('llmCall');

      expect(status.callsLastMinute).toBe(3);
      expect(status.limit).toBe(5);
      expect(status.remaining).toBe(2);
    });

    it('returns Infinity for unknown operations', async () => {
      const limiter = new RateLimiter({ llmCall: { minDelayMs: 0, maxPerMinute: 5 } });

      const status = await limiter.getStatus('mystery');

      expect(status.callsLastMinute).toBe(0);
      expect(status.limit).toBe(Infinity);
      expect(status.remaining).toBe(Infinity);
    });

    it('reports timeUntilReset based on oldest call in window', async () => {
      const limiter = new RateLimiter({ op: { minDelayMs: 0, maxPerMinute: 10 } });

      await limiter.recordCall('op');
      vi.advanceTimersByTime(15_000);

      const status = await limiter.getStatus('op');

      // Oldest call was 15s ago, so reset in ~45s
      expect(status.timeUntilReset!).toBeGreaterThanOrEqual(44_000);
      expect(status.timeUntilReset!).toBeLessThanOrEqual(46_000);
    });
  });

  // ---------------------------------------------------------------------------
  // Independent operation tracking
  // ---------------------------------------------------------------------------
  describe('multiple operations tracked independently', () => {
    it('tracks separate operations without interference', async () => {
      const limiter = new RateLimiter({
        opA: { minDelayMs: 0, maxPerMinute: 2 },
        opB: { minDelayMs: 0, maxPerMinute: 5 },
      });

      // Fill opA to its limit
      await limiter.recordCall('opA');
      await limiter.recordCall('opA');

      // opA is blocked, opB is still allowed
      expect((await limiter.checkBurst('opA')).allowed).toBe(false);
      expect((await limiter.checkBurst('opB')).allowed).toBe(true);

      // Statuses are independent
      expect((await limiter.getStatus('opA')).callsLastMinute).toBe(2);
      expect((await limiter.getStatus('opB')).callsLastMinute).toBe(0);
    });

    it('resets one operation without affecting another', async () => {
      const limiter = new RateLimiter({
        opA: { minDelayMs: 0, maxPerMinute: 1 },
        opB: { minDelayMs: 0, maxPerMinute: 1 },
      });

      await limiter.recordCall('opA');
      await limiter.recordCall('opB');

      // Both blocked
      expect((await limiter.checkBurst('opA')).allowed).toBe(false);
      expect((await limiter.checkBurst('opB')).allowed).toBe(false);

      // Advance past window
      vi.advanceTimersByTime(60_001);

      // Both unblocked
      expect((await limiter.checkBurst('opA')).allowed).toBe(true);
      expect((await limiter.checkBurst('opB')).allowed).toBe(true);
    });
  });
});
