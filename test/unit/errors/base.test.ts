import { describe, it, expect } from 'vitest';
import { SinterError } from '../../../src/errors/base.js';

describe('SinterError', () => {
  it('creates error with message and code', () => {
    const err = new SinterError('something broke', 'ERR_TEST');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('ERR_TEST');
    expect(err.context).toBeUndefined();
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('SinterError');
  });

  it('stores context when provided', () => {
    const ctx = { userId: 42, action: 'generate' };
    const err = new SinterError('fail', 'ERR_CTX', ctx);
    expect(err.context).toEqual(ctx);
  });

  it('sets retryable to true via opts', () => {
    const err = new SinterError('timeout', 'ERR_TIMEOUT', undefined, { retryable: true });
    expect(err.retryable).toBe(true);
  });

  it('sets retryable to false by default', () => {
    const err = new SinterError('fail', 'ERR_NOPE', undefined, {});
    expect(err.retryable).toBe(false);
  });

  it('passes cause to native Error when provided', () => {
    const cause = new Error('root cause');
    const err = new SinterError('wrapped', 'ERR_WRAP', undefined, { cause });
    expect(err.cause).toBe(cause);
  });

  it('does not set cause when opts has no cause', () => {
    const err = new SinterError('fail', 'ERR_NONE', undefined, { retryable: false });
    expect(err.cause).toBeUndefined();
  });

  it('is instanceof Error', () => {
    const err = new SinterError('test', 'ERR_TEST');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets name to constructor name', () => {
    const err = new SinterError('test', 'ERR_TEST');
    expect(err.name).toBe('SinterError');
  });
});
