import { describe, it, expect } from 'vitest';
import { BatchProcessor } from '../../src/core/BatchProcessor.js';

describe('BatchProcessor', () => {
  it('submits and processes a single job', async () => {
    const bp = new BatchProcessor<string, number>(
      { maxConcurrency: 2, retryAttempts: 0, retryDelayMs: 0 },
      async (input) => input.length,
    );
    const id = bp.submit('hello');
    expect(id).toBe('job_1');
    const jobs = await bp.process();
    expect(jobs[0].status).toBe('completed');
    expect(jobs[0].result).toBe(5);
  });

  it('reports pending count and job status', () => {
    const bp = new BatchProcessor<number, number>({}, async (n) => n * 2);
    bp.submit(1);
    bp.submit(2);
    expect(bp.pendingCount).toBe(2);
    expect(bp.getStatus('job_1')).not.toBeNull();
    expect(bp.getStatus('job_1')?.status).toBe('pending');
  });

  it('throws if submit is called without a processor', () => {
    const bp = new BatchProcessor<string, string>();
    expect(() => bp.submit('x')).toThrow('No processor function set');
  });

  it('should handle concurrent batches safely', async () => {
    const bp = new BatchProcessor<number, number>(
      { maxConcurrency: 2, retryAttempts: 0, retryDelayMs: 0 },
      async (n) => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return n * 2;
      },
    );

    // Submit first batch
    const ids1 = bp.submitMany([1, 2, 3]);
    expect(ids1).toHaveLength(3);

    // Process first batch
    const results1 = await bp.process();
    expect(results1).toHaveLength(3);
    expect(results1.every(r => r.status === 'completed')).toBe(true);
    expect(results1.map(r => r.result)).toEqual([2, 4, 6]);

    // Submit second batch (verify processor still works)
    const ids2 = bp.submitMany([4, 5]);
    expect(ids2).toHaveLength(2);

    const results2 = await bp.process();
    expect(results2).toHaveLength(5); // Includes previous jobs
    const completedJobs = results2.filter(r => r.status === 'completed');
    expect(completedJobs).toHaveLength(5);
  });

  it('should handle high concurrency without race conditions', async () => {
    const bp = new BatchProcessor<number, number>(
      { maxConcurrency: 5, retryAttempts: 0, retryDelayMs: 0 },
      async (n) => {
        // Random delay to increase chance of race conditions
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        return n * n;
      },
    );

    // Submit many jobs at once
    const inputs = Array.from({ length: 20 }, (_, i) => i + 1);
    bp.submitMany(inputs);

    const results = await bp.process();
    expect(results).toHaveLength(20);
    
    // All should complete successfully
    const completed = results.filter(r => r.status === 'completed');
    expect(completed).toHaveLength(20);
    
    // Results should be correct
    const expectedResults = inputs.map(n => n * n);
    const actualResults = completed.map(r => r.result).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(actualResults).toEqual(expectedResults);
  });

  it('should handle job failures without affecting other jobs', async () => {
    const bp = new BatchProcessor<number, number>(
      { maxConcurrency: 2, retryAttempts: 0, retryDelayMs: 0 },
      async (n) => {
        if (n === 2) {
          throw new Error('Intentional failure');
        }
        return n * 2;
      },
    );

    bp.submitMany([1, 2, 3]);
    const results = await bp.process();

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe('completed');
    expect(results[0].result).toBe(2);
    expect(results[1].status).toBe('failed');
    expect(results[1].error).toContain('Intentional failure');
    expect(results[2].status).toBe('completed');
    expect(results[2].result).toBe(6);
  });

  it('should respect maxConcurrency limit', async () => {
    let concurrentCount = 0;
    let maxConcurrentObserved = 0;

    const bp = new BatchProcessor<number, number>(
      { maxConcurrency: 2, retryAttempts: 0, retryDelayMs: 0 },
      async (n) => {
        concurrentCount++;
        maxConcurrentObserved = Math.max(maxConcurrentObserved, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return n;
      },
    );

    bp.submitMany([1, 2, 3, 4, 5]);
    await bp.process();

    expect(maxConcurrentObserved).toBeLessThanOrEqual(2);
  });

  it('should retry failed jobs when retryAttempts > 0', async () => {
    let attempts = 0;
    const bp = new BatchProcessor<number, number>(
      { maxConcurrency: 1, retryAttempts: 2, retryDelayMs: 10 },
      async (n) => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return n * 2;
      },
    );

    bp.submit(5);
    const results = await bp.process();

    expect(results[0].status).toBe('completed');
    expect(results[0].result).toBe(10);
    expect(attempts).toBe(3); // Initial + 2 retries
  });
});
