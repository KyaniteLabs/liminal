import { describe, it, expect } from 'vitest';
import { ProcessorError } from '../../../src/errors/ProcessorError.js';

describe('ProcessorError', () => {
  it('creates error with message only', () => {
    const err = new ProcessorError('job failed');
    expect(err.message).toBe('job failed');
    expect(err.code).toBe('ERR_PROCESSOR');
    expect(err.jobId).toBeUndefined();
    expect(err.cause).toBeUndefined();
  });

  it('stores jobId when provided', () => {
    const err = new ProcessorError('failed', { jobId: 'job-123' });
    expect(err.jobId).toBe('job-123');
    expect(err.context).toEqual({ jobId: 'job-123' });
  });

  it('passes Error cause to SinterError', () => {
    const cause = new Error('timeout');
    const err = new ProcessorError('wrapped', { cause });
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ causeMessage: 'timeout' });
  });

  it('handles non-Error cause without causeMessage in context', () => {
    const err = new ProcessorError('bad', { cause: 'string' as any });
    expect(err.cause).toBeUndefined();
  });

  it('is instanceof Error', () => {
    expect(new ProcessorError('test')).toBeInstanceOf(Error);
  });
});
