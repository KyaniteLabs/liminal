import { describe, it, expect } from 'vitest';
import { CompostError, CompostDigestError, CompostSoupError, CompostStoreError } from '../../../src/errors/CompostError.js';

describe('CompostError', () => {
  it('creates error with message only', () => {
    const err = new CompostError('heap overflow');
    expect(err.message).toBe('heap overflow');
    expect(err.code).toBe('ERR_COMPOST');
    expect(err.retryable).toBe(false);
    expect(err.cause).toBeUndefined();
  });

  it('accepts cause and retryable', () => {
    const cause = new Error('disk full');
    const err = new CompostError('failed', { cause, retryable: true });
    expect(err.cause).toBe(cause);
    expect(err.retryable).toBe(true);
  });

  it('accepts custom context', () => {
    const err = new CompostError('bad', { context: { heapSize: 1024 } });
    expect(err.context).toEqual({ heapSize: 1024 });
  });
});

describe('CompostDigestError', () => {
  it('is retryable by default', () => {
    const err = new CompostDigestError('digest timeout');
    expect(err.retryable).toBe(true);
    expect(err.code).toBe('ERR_COMPOST');
  });

  it('preserves cause from opts', () => {
    const cause = new Error('oom');
    const err = new CompostDigestError('fail', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('CompostSoupError', () => {
  it('is retryable by default', () => {
    const err = new CompostSoupError('soup stale');
    expect(err.retryable).toBe(true);
  });
});

describe('CompostStoreError', () => {
  it('is retryable by default', () => {
    const err = new CompostStoreError('store full');
    expect(err.retryable).toBe(true);
  });
});
