import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for RetryManager - Exponential backoff retry logic
 * 
 * The RetryManager handles transient failures with exponential backoff.
 * Only retries LLMTimeoutError and LLMRateLimitError - other errors fail fast.
 */

import { RetryManager } from '../../../src/llm/RetryManager.js';
import { LLMTimeoutError, LLMRateLimitError } from '../../../src/llm/LLMClient.js';

describe('RetryManager', () => {
  describe('executeWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await RetryManager.executeWithRetry(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on LLMTimeoutError', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockResolvedValue('success');
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 3, 
        baseDelayMs: 1000 
      });
      
      // First call fails
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on LLMRateLimitError', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMRateLimitError('test'))
        .mockResolvedValue('success');
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 3, 
        baseDelayMs: 500 
      });
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(500);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('fails fast on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Not retryable'));
      
      await expect(RetryManager.executeWithRetry(fn, { maxRetries: 3 }))
        .rejects.toThrow('Not retryable');
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('uses exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockResolvedValue('success');
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 5, 
        baseDelayMs: 100 
      });
      
      // First call
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
      
      // Retry 1: 100ms delay
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);
      
      // Retry 2: 200ms delay
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);
      
      // Retry 3: 400ms delay
      await vi.advanceTimersByTimeAsync(400);
      expect(fn).toHaveBeenCalledTimes(4);
      
      await promise;
    });

    it('respects retryAfterSeconds from rate limit', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMRateLimitError('test', 5)) // 5 seconds
        .mockResolvedValue('success');
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 3, 
        baseDelayMs: 100 // Should be overridden by retryAfter
      });
      
      await vi.advanceTimersByTimeAsync(0);
      
      // Should wait 5000ms, not 100ms
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('caps delay at maxDelayMs', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockResolvedValue('success');
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 5, 
        baseDelayMs: 1000,
        maxDelayMs: 2000 // Cap at 2 seconds
      });
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000); // 1st retry
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry (capped)
      await vi.advanceTimersByTimeAsync(2000); // 3rd retry (capped)
      await vi.advanceTimersByTimeAsync(2000); // 4th retry (capped)
      
      await promise;
    });

    it('throws last error after max retries exceeded', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'))
        .mockRejectedValueOnce(new LLMTimeoutError('test'));
      
      const promise = RetryManager.executeWithRetry(fn, { 
        maxRetries: 2, 
        baseDelayMs: 10 
      }).catch(e => e);
      
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);
      
      const result = await promise;
      expect(result).toBeInstanceOf(LLMTimeoutError);
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('succeeds immediately if no errors', async () => {
      const fn = vi.fn().mockResolvedValue('immediate success');
      
      const result = await RetryManager.executeWithRetry(fn, { 
        maxRetries: 5, 
        baseDelayMs: 1000 
      });
      
      expect(result).toBe('immediate success');
      expect(fn).toHaveBeenCalledTimes(1);
      
      // No timers should have been set
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('mapSettled', () => {
    it('processes all items with concurrency limit', async () => {
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn(async (item: number) => item * 2);
      
      const results = await RetryManager.mapSettled(items, fn, 2);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.status).toBe('fulfilled');
        expect((result as PromiseFulfilledResult<unknown>).value).toBe((i + 1) * 2);
      });
    });

    it('handles errors without stopping', async () => {
      const items = [1, 2, 3];
      const fn = vi.fn(async (item: number) => {
        if (item === 2) throw new Error('Item 2 failed');
        return item * 2;
      });
      
      const results = await RetryManager.mapSettled(items, fn, 3);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('respects concurrency limit', async () => {
      let running = 0;
      let maxRunning = 0;
      
      const items = [1, 2, 3, 4, 5];
      const fn = async (_item: number) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(resolve => setTimeout(resolve, 10));
        running--;
        return 'done';
      };
      
      await RetryManager.mapSettled(items, fn, 2);
      
      expect(maxRunning).toBe(2);
    });

    it('handles empty array', async () => {
      const results = await RetryManager.mapSettled([], async () => 'done', 3);
      
      expect(results).toHaveLength(0);
    });

    it('handles single item', async () => {
      const results = await RetryManager.mapSettled([42], async (item) => item * 2, 3);
      
      expect(results).toHaveLength(1);
      expect((results[0] as PromiseFulfilledResult<unknown>).value).toBe(84);
    });
  });
});
