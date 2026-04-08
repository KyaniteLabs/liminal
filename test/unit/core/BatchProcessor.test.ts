import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchProcessor, type BatchJob } from '../../../src/core/BatchProcessor.js';
import { Status } from '../../../src/types/status.js';

describe('BatchProcessor', () => {
  let bp: BatchProcessor<string, number>;

  beforeEach(() => {
    bp = new BatchProcessor<string, number>(
      { maxConcurrency: 2, retryAttempts: 1, retryDelayMs: 10 },
      async (input) => input.length,
    );
  });

  // ── Constructor and configuration ─────────────────────────────────

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      const b = new BatchProcessor<string, number>();
      b.setProcessor(async (s) => s.length);
      const id = b.submit('test');
      expect(id).toMatch(/^job_\d+$/);
    });

    it('accepts processor in constructor', () => {
      const b = new BatchProcessor<string, number>(undefined, async (s) => s.length);
      const id = b.submit('hello');
      expect(id).toBeDefined();
    });

    it('accepts partial config overrides', () => {
      const b = new BatchProcessor<string, number>({ maxConcurrency: 8 });
      b.setProcessor(async (s) => s.length);
      expect(b.pendingCount).toBe(0);
    });
  });

  // ── submit() ──────────────────────────────────────────────────────

  describe('submit()', () => {
    it('throws if no processor is set', () => {
      const b = new BatchProcessor<string, number>();
      expect(() => b.submit('test')).toThrow('No processor function set');
    });

    it('returns a unique job ID', () => {
      const id1 = bp.submit('one');
      const id2 = bp.submit('two');
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^job_\d+$/);
    });

    it('creates job with PENDING status and correct input', () => {
      const id = bp.submit('hello');
      const job = bp.getStatus(id);
      expect(job).toBeDefined();
      expect(job!.status).toBe(Status.PENDING);
      expect(job!.input).toBe('hello');
      expect(job!.priority).toBe(0);
      expect(job!.submittedAt).toBeGreaterThan(0);
      expect(job!.completedAt).toBeUndefined();
    });

    it('respects priority parameter', () => {
      const id = bp.submit('high-priority', 10);
      const job = bp.getStatus(id);
      expect(job!.priority).toBe(10);
    });
  });

  // ── submitMany() ──────────────────────────────────────────────────

  describe('submitMany()', () => {
    it('throws if no processor is set', () => {
      const b = new BatchProcessor<string, number>();
      expect(() => b.submitMany(['a', 'b'])).toThrow('No processor function set');
    });

    it('returns one ID per input', () => {
      const ids = bp.submitMany(['a', 'b', 'c'], 5);
      expect(ids.length).toBe(3);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        const job = bp.getStatus(id);
        expect(job!.priority).toBe(5);
      }
    });
  });

  // ── process() ─────────────────────────────────────────────────────

  describe('process()', () => {
    it('throws if no processor is set', async () => {
      const b = new BatchProcessor<string, number>();
      await expect(b.process()).rejects.toThrow('No processor function set');
    });

    it('processes jobs and returns results', async () => {
      bp.submit('hi');
      bp.submit('world');
      const jobs = await bp.process();
      expect(jobs.length).toBe(2);
      expect(jobs.every((j) => j.status === Status.COMPLETED)).toBe(true);
      expect(jobs.find((j) => j.input === 'hi')!.result).toBe(2);
      expect(jobs.find((j) => j.input === 'world')!.result).toBe(5);
    });

    it('sets completedAt timestamp on completion', async () => {
      bp.submit('test');
      const jobs = await bp.process();
      expect(jobs[0].completedAt).toBeGreaterThan(0);
    });

    it('processes higher-priority jobs first', async () => {
      const order: string[] = [];
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 1, retryAttempts: 0, retryDelayMs: 0 },
        async (input) => { order.push(input); return input.length; },
      );
      b.submit('low', 0);
      b.submit('high', 10);
      b.submit('medium', 5);
      await b.process();
      expect(order).toEqual(['high', 'medium', 'low']);
    });

    it('retries failed jobs up to retryAttempts', async () => {
      let callCount = 0;
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 1, retryAttempts: 2, retryDelayMs: 5 },
        async (input) => {
          callCount++;
          if (callCount <= 2) throw new Error('transient');
          return input.length;
        },
      );
      b.submit('retry-test');
      const jobs = await b.process();
      // First attempt + 2 retries = 3 attempts, should succeed on 3rd
      expect(callCount).toBe(3);
      expect(jobs[0].status).toBe(Status.COMPLETED);
      expect(jobs[0].result).toBe(10);
    });

    it('marks job as failed after exhausting retries', async () => {
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 1, retryAttempts: 1, retryDelayMs: 5 },
        async () => { throw new Error('permanent failure'); },
      );
      b.submit('fail-test');
      const jobs = await b.process();
      expect(jobs[0].status).toBe(Status.FAILED);
      expect(jobs[0].error).toBe('permanent failure');
      expect(jobs[0].completedAt).toBeGreaterThan(0);
    });

    it('handles non-Error exceptions in failure message', async () => {
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 1, retryAttempts: 0, retryDelayMs: 0 },
        async () => { throw 'string error'; },
      );
      b.submit('string-error');
      const jobs = await b.process();
      expect(jobs[0].status).toBe(Status.FAILED);
      expect(jobs[0].error).toBe('string error');
    });

    it('respects concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 2, retryAttempts: 0, retryDelayMs: 0 },
        async (input) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          // Small delay to ensure concurrency is observable
          await new Promise((r) => setTimeout(r, 20));
          concurrent--;
          return input.length;
        },
      );
      for (let i = 0; i < 6; i++) {
        b.submit(`job-${i}`);
      }
      await b.process();
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('returns empty array when no pending jobs', async () => {
      const jobs = await bp.process();
      expect(jobs).toEqual([]);
    });

    it('handles non-Error non-string exceptions in failure message', async () => {
      const b = new BatchProcessor<string, number>(
        { maxConcurrency: 1, retryAttempts: 0, retryDelayMs: 0 },
        async () => { throw 42; },
      );
      b.submit('number-error');
      const jobs = await b.process();
      expect(jobs[0].status).toBe(Status.FAILED);
      expect(jobs[0].error).toBe('42');
    });
  });

  // ── getStatus() ───────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns the job by ID', () => {
      const id = bp.submit('test');
      const job = bp.getStatus(id);
      expect(job).toBeDefined();
      expect(job!.id).toBe(id);
    });

    it('returns undefined for nonexistent job', () => {
      expect(bp.getStatus('nonexistent')).toBeUndefined();
    });
  });

  // ── getResults() ──────────────────────────────────────────────────

  describe('getResults()', () => {
    it('returns only completed jobs', async () => {
      bp.submit('ok');
      bp.submit('fail');
      // Replace processor to fail one job
      bp.setProcessor(async (input) => {
        if (input === 'fail') throw new Error('nope');
        return input.length;
      });
      await bp.process();
      const results = bp.getResults();
      expect(results.length).toBe(1);
      expect(results[0].input).toBe('ok');
      expect(results[0].result).toBe(2);
    });

    it('returns empty array before processing', () => {
      bp.submit('test');
      expect(bp.getResults()).toEqual([]);
    });
  });

  // ── clear() ───────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes completed and failed jobs', async () => {
      bp.submit('a');
      bp.submit('b');
      bp.setProcessor(async (input) => {
        if (input === 'b') throw new Error('fail');
        return input.length;
      });
      await bp.process();
      bp.clear();
      // After clear, only pending/running should remain (none)
      expect(bp.pendingCount).toBe(0);
    });

    it('keeps pending jobs', () => {
      bp.submit('pending');
      bp.clear();
      expect(bp.getStatus('pending')).toBeUndefined(); // ID is job_1 not 'pending'
      expect(bp.pendingCount).toBe(1);
    });
  });

  // ── Properties ────────────────────────────────────────────────────

  describe('pendingCount', () => {
    it('returns 0 when no jobs submitted', () => {
      expect(bp.pendingCount).toBe(0);
    });

    it('returns correct count of pending jobs', () => {
      bp.submit('a');
      bp.submit('b');
      expect(bp.pendingCount).toBe(2);
    });
  });

  describe('activeJobCount', () => {
    it('returns 0 when no jobs running', () => {
      expect(bp.activeJobCount).toBe(0);
    });
  });

  // ── setProcessor() ────────────────────────────────────────────────

  describe('setProcessor()', () => {
    it('allows replacing the processor', async () => {
      const b = new BatchProcessor<string, number>();
      b.setProcessor(async (s) => s.length * 10);
      b.submit('abc');
      const jobs = await b.process();
      expect(jobs[0].result).toBe(30);
    });
  });
});
