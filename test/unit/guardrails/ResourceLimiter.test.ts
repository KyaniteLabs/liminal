import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResourceLimiter,
  createResourceLimiter,
  getResourceLimiter,
  removeResourceLimiter,
  getAllResourceLimiters,
} from '../../../src/guardrails/core/ResourceLimiter.js';
import type { ResourceLimits, ResourceCheckResult } from '../../../src/guardrails/core/ResourceLimiter.js';

const DEFAULT_LIMITS: ResourceLimits = {
  maxTokens: 100000,
  maxMemoryMB: 512,
  maxTimeMs: 300000,
  maxApiCalls: 50,
};

describe('ResourceLimiter', () => {
  let limiter: ResourceLimiter;

  beforeEach(() => {
    // Use short limits for predictable tests
    limiter = new ResourceLimiter({
      maxTokens: 1000,
      maxMemoryMB: 64,
      maxTimeMs: 60000,
      maxApiCalls: 10,
    });
  });

  // ── constructor defaults ────────────────────────────────────────────

  describe('constructor', () => {
    it('applies default limits when no overrides given', () => {
      const defaultLimiter = new ResourceLimiter();
      const limits = defaultLimiter.getLimits();

      expect(limits.maxTokens).toBe(100000);
      expect(limits.maxMemoryMB).toBe(512);
      expect(limits.maxTimeMs).toBe(300000);
      expect(limits.maxApiCalls).toBe(50);
    });

    it('merges partial overrides with defaults', () => {
      const partial = new ResourceLimiter({ maxTokens: 5000 });
      const limits = partial.getLimits();

      expect(limits.maxTokens).toBe(5000);
      expect(limits.maxMemoryMB).toBe(512);
      expect(limits.maxTimeMs).toBe(300000);
      expect(limits.maxApiCalls).toBe(50);
    });
  });

  // ── checkAll() ──────────────────────────────────────────────────────

  describe('checkAll()', () => {
    it('returns 4 results (tokens, memory, time, apiCalls)', () => {
      const results = limiter.checkAll();
      expect(results).toHaveLength(4);
    });

    it('all resources are allowed when usage is zero', () => {
      const results = limiter.checkAll();
      expect(results.every(r => r.allowed)).toBe(true);
    });

    it('each result has the correct shape', () => {
      const results = limiter.checkAll();
      for (const r of results) {
        expect(r).toHaveProperty('allowed');
        expect(r).toHaveProperty('resource');
        expect(r).toHaveProperty('current');
        expect(r).toHaveProperty('limit');
        expect(r).toHaveProperty('message');
        expect(typeof r.allowed).toBe('boolean');
        expect(typeof r.resource).toBe('string');
        expect(typeof r.current).toBe('number');
        expect(typeof r.limit).toBe('number');
      }
    });

    it('reports token violation when tokens exceed limit', () => {
      limiter.recordTokens(1001);
      const results = limiter.checkAll();
      const tokenCheck = results.find(r => r.resource === 'tokensUsed');

      expect(tokenCheck).toBeDefined();
      expect(tokenCheck!.allowed).toBe(false);
      expect(tokenCheck!.current).toBe(1001);
      expect(tokenCheck!.limit).toBe(1000);
    });

    it('reports API call violation when calls exceed limit', () => {
      for (let i = 0; i < 11; i++) limiter.recordApiCall();
      const results = limiter.checkAll();
      const apiCheck = results.find(r => r.resource === 'apiCalls');

      expect(apiCheck).toBeDefined();
      expect(apiCheck!.allowed).toBe(false);
      expect(apiCheck!.current).toBe(11);
      expect(apiCheck!.limit).toBe(10);
    });
  });

  // ── isAllowed() ─────────────────────────────────────────────────────

  describe('isAllowed()', () => {
    it('returns true when all resources are within limits', () => {
      expect(limiter.isAllowed()).toBe(true);
    });

    it('returns false when tokens are exhausted', () => {
      limiter.recordTokens(1001);
      expect(limiter.isAllowed()).toBe(false);
    });

    it('returns false when API calls are exhausted', () => {
      for (let i = 0; i < 11; i++) limiter.recordApiCall();
      expect(limiter.isAllowed()).toBe(false);
    });
  });

  // ── getFirstViolation() ─────────────────────────────────────────────

  describe('getFirstViolation()', () => {
    it('returns undefined when no limits are exceeded', () => {
      expect(limiter.getFirstViolation()).toBeUndefined();
    });

    it('returns the first exceeded resource', () => {
      limiter.recordTokens(1001);
      const violation = limiter.getFirstViolation();

      expect(violation).toBeDefined();
      expect(violation!.allowed).toBe(false);
      expect(violation!.resource).toBe('tokensUsed');
      expect(violation!.current).toBe(1001);
    });

    it('returns the first violation in checkAll order', () => {
      // checkAll checks: tokens, memory, time, apiCalls
      // Exhaust API calls but not tokens
      for (let i = 0; i < 11; i++) limiter.recordApiCall();
      const violation = limiter.getFirstViolation();

      // API calls is the 4th check, so if tokens/memory/time are fine,
      // apiCalls is the first violation
      expect(violation!.resource).toBe('apiCalls');
    });
  });

  // ── recordTokens() ──────────────────────────────────────────────────

  describe('recordTokens()', () => {
    it('accumulates token usage', () => {
      limiter.recordTokens(100);
      limiter.recordTokens(250);
      expect(limiter.getUsage().tokensUsed).toBe(350);
    });

    it('accumulates to zero correctly', () => {
      limiter.recordTokens(0);
      expect(limiter.getUsage().tokensUsed).toBe(0);
    });
  });

  // ── recordApiCall() ─────────────────────────────────────────────────

  describe('recordApiCall()', () => {
    it('increments apiCalls by 1', () => {
      limiter.recordApiCall();
      limiter.recordApiCall();
      limiter.recordApiCall();
      expect(limiter.getUsage().apiCalls).toBe(3);
    });
  });

  // ── canUseTokens() ──────────────────────────────────────────────────

  describe('canUseTokens()', () => {
    it('returns true when proposed tokens fit within limit', () => {
      expect(limiter.canUseTokens(999)).toBe(true);
      expect(limiter.canUseTokens(1000)).toBe(true);
    });

    it('returns false when proposed tokens would exceed limit', () => {
      expect(limiter.canUseTokens(1001)).toBe(false);
    });

    it('accounts for already-recorded tokens', () => {
      limiter.recordTokens(800);
      expect(limiter.canUseTokens(200)).toBe(true);
      expect(limiter.canUseTokens(201)).toBe(false);
    });

    it('returns false when limit is already exceeded', () => {
      limiter.recordTokens(1001);
      expect(limiter.canUseTokens(0)).toBe(false);
    });
  });

  // ── getRemaining() ──────────────────────────────────────────────────

  describe('getRemaining()', () => {
    it('returns full limit when nothing used', () => {
      expect(limiter.getRemaining('tokensUsed')).toBe(1000);
      expect(limiter.getRemaining('apiCalls')).toBe(10);
    });

    it('returns correct remaining after partial usage', () => {
      limiter.recordTokens(300);
      limiter.recordApiCall();
      limiter.recordApiCall();

      expect(limiter.getRemaining('tokensUsed')).toBe(700);
      expect(limiter.getRemaining('apiCalls')).toBe(8);
    });

    it('returns 0 when limit is exceeded', () => {
      limiter.recordTokens(1500);
      expect(limiter.getRemaining('tokensUsed')).toBe(0);
    });

    it('returns 0 for memory/time when not yet exceeded', () => {
      // Memory and time are process-dependent; at init they should be
      // well within limits, so remaining should be positive
      const memRemaining = limiter.getRemaining('memoryUsedMB');
      const timeRemaining = limiter.getRemaining('timeElapsedMs');

      expect(memRemaining).toBeGreaterThanOrEqual(0);
      expect(timeRemaining).toBeGreaterThan(0);
    });
  });

  // ── getUsagePercent() ───────────────────────────────────────────────

  describe('getUsagePercent()', () => {
    it('returns 0 when nothing used', () => {
      expect(limiter.getUsagePercent('tokensUsed')).toBe(0);
      expect(limiter.getUsagePercent('apiCalls')).toBe(0);
    });

    it('returns correct percentage for token usage', () => {
      limiter.recordTokens(500);
      // 500 / 1000 * 100 = 50
      expect(limiter.getUsagePercent('tokensUsed')).toBe(50);
    });

    it('returns correct percentage for API calls', () => {
      for (let i = 0; i < 5; i++) limiter.recordApiCall();
      // 5 / 10 * 100 = 50
      expect(limiter.getUsagePercent('apiCalls')).toBe(50);
    });

    it('returns 100 when exactly at limit', () => {
      limiter.recordTokens(1000);
      expect(limiter.getUsagePercent('tokensUsed')).toBe(100);
    });

    it('returns >100 when over limit', () => {
      limiter.recordTokens(1500);
      expect(limiter.getUsagePercent('tokensUsed')).toBe(150);
    });

    it('returns 25 for quarter usage', () => {
      limiter.recordTokens(250);
      expect(limiter.getUsagePercent('tokensUsed')).toBe(25);
    });
  });

  // ── estimateTokens() ────────────────────────────────────────────────

  describe('estimateTokens()', () => {
    it('returns 0 for empty string', () => {
      expect(limiter.estimateTokens('')).toBe(0);
    });

    it('estimates ~4 chars per token', () => {
      // 16 chars / 4 = 4 tokens
      expect(limiter.estimateTokens('Hello, world!!!')).toBe(4);
    });

    it('rounds up fractional tokens', () => {
      // 5 chars / 4 = 1.25 → ceil = 2
      expect(limiter.estimateTokens('hello')).toBe(2);
    });

    it('returns 1 for a single character', () => {
      expect(limiter.estimateTokens('a')).toBe(1);
    });
  });

  // ── getUsage() ──────────────────────────────────────────────────────

  describe('getUsage()', () => {
    it('returns a snapshot of current usage', () => {
      const usage = limiter.getUsage();

      expect(usage.tokensUsed).toBe(0);
      expect(usage.tokensLimit).toBe(1000);
      expect(usage.apiCalls).toBe(0);
      expect(usage.apiCallLimit).toBe(10);
      expect(typeof usage.memoryUsedMB).toBe('number');
      expect(typeof usage.timeElapsedMs).toBe('number');
    });

    it('returns a copy, not a reference', () => {
      const usage1 = limiter.getUsage();
      limiter.recordTokens(100);
      const usage2 = limiter.getUsage();

      expect(usage1.tokensUsed).toBe(0);
      expect(usage2.tokensUsed).toBe(100);
    });
  });

  // ── getLimits() ─────────────────────────────────────────────────────

  describe('getLimits()', () => {
    it('returns a copy of the current limits', () => {
      const limits = limiter.getLimits();

      expect(limits.maxTokens).toBe(1000);
      expect(limits.maxMemoryMB).toBe(64);
      expect(limits.maxTimeMs).toBe(60000);
      expect(limits.maxApiCalls).toBe(10);
    });

    it('returns a copy, not a reference', () => {
      const limits = limiter.getLimits();
      // Mutation should not affect the limiter
      limits.maxTokens = 99999;
      expect(limiter.getLimits().maxTokens).toBe(1000);
    });
  });

  // ── edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero token limit', () => {
      const zeroLimiter = new ResourceLimiter({ maxTokens: 0, maxApiCalls: 0 });
      expect(zeroLimiter.canUseTokens(0)).toBe(true);
      expect(zeroLimiter.canUseTokens(1)).toBe(false);
      expect(zeroLimiter.isAllowed()).toBe(false);
    });

    it('handles very large token request', () => {
      expect(limiter.canUseTokens(Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('handles negative token recording (accumulator keeps going)', () => {
      limiter.recordTokens(-100);
      // usage goes negative; remaining would be 1000 - (-100) = 1100
      expect(limiter.getUsage().tokensUsed).toBe(-100);
      expect(limiter.getRemaining('tokensUsed')).toBe(1100);
    });

    it('handles a single token limit', () => {
      const oneLimiter = new ResourceLimiter({ maxTokens: 1, maxApiCalls: 1 });
      expect(oneLimiter.canUseTokens(1)).toBe(true);
      oneLimiter.recordTokens(1);
      expect(oneLimiter.canUseTokens(1)).toBe(false);
    });

    it('getRemaining never returns negative (clamped to 0)', () => {
      limiter.recordTokens(5000);
      expect(limiter.getRemaining('tokensUsed')).toBe(0);
    });
  });
});

// ── global factory functions ───────────────────────────────────────────

describe('global ResourceLimiter factory', () => {
  beforeEach(() => {
    // Clean up any leftover limiters from other tests
    const all = getAllResourceLimiters();
    for (const key of all.keys()) {
      removeResourceLimiter(key);
    }
  });

  it('createResourceLimiter creates and stores a limiter', () => {
    const limiter = createResourceLimiter('task-1', { maxTokens: 500 });
    expect(limiter).toBeInstanceOf(ResourceLimiter);
    expect(limiter.getLimits().maxTokens).toBe(500);

    const retrieved = getResourceLimiter('task-1');
    expect(retrieved).toBe(limiter);
  });

  it('getResourceLimiter returns undefined for unknown task', () => {
    expect(getResourceLimiter('nonexistent')).toBeUndefined();
  });

  it('removeResourceLimiter deletes the stored limiter', () => {
    createResourceLimiter('task-2');
    expect(getResourceLimiter('task-2')).toBeDefined();

    removeResourceLimiter('task-2');
    expect(getResourceLimiter('task-2')).toBeUndefined();
  });

  it('getAllResourceLimiters returns a copy of the map', () => {
    createResourceLimiter('task-3');
    const all = getAllResourceLimiters();

    all.delete('task-3');
    // Original should still be there
    expect(getResourceLimiter('task-3')).toBeDefined();

    // Clean up
    removeResourceLimiter('task-3');
  });
});
