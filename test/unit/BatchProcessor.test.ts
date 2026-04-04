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
    expect(bp.getStatus('job_1')).toBeDefined();
    expect(bp.getStatus('job_1')!.status).toBe('pending');
  });

  it('throws if submit is called without a processor', () => {
    const bp = new BatchProcessor<string, string>();
    expect(() => bp.submit('x')).toThrow('No processor function set');
  });
});
