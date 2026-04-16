import { describe, it, expect } from 'vitest';
import { LiminalError } from '../../src/errors/base';

describe('LiminalError', () => {
  it('should create an error with message, code, and context', () => {
    const context = { foo: 'bar', count: 42 };
    const error = new LiminalError('Something went wrong', 'ERR_TEST', context);

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('ERR_TEST');
    expect(error.context).toEqual(context);
    expect(error.name).toBe('LiminalError');
  });

  it('should work without context', () => {
    const error = new LiminalError('Simple error', 'ERR_SIMPLE');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('ERR_SIMPLE');
    expect(error.context).toBeUndefined();
  });

  it('should be an instance of Error', () => {
    const error = new LiminalError('Test', 'ERR_TEST');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LiminalError);
  });

  it('should capture stack trace', () => {
    const error = new LiminalError('Stack test', 'ERR_STACK');

    expect(error.stack).toContain('Stack test');
    expect(error.stack).toContain('LiminalError');
  });
});
