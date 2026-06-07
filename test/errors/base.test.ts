import { describe, it, expect } from 'vitest';
import { SinterError } from '../../src/errors/base';

describe('SinterError', () => {
  it('should create an error with message, code, and context', () => {
    const context = { foo: 'bar', count: 42 };
    const error = new SinterError('Something went wrong', 'ERR_TEST', context);

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('ERR_TEST');
    expect(error.context).toEqual(context);
    expect(error.name).toBe('SinterError');
  });

  it('should work without context', () => {
    const error = new SinterError('Simple error', 'ERR_SIMPLE');

    expect(error.message).toBe('Simple error');
    expect(error.code).toBe('ERR_SIMPLE');
    expect(error.context).toBeUndefined();
  });

  it('should be an instance of Error', () => {
    const error = new SinterError('Test', 'ERR_TEST');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SinterError);
  });

  it('should capture stack trace', () => {
    const error = new SinterError('Stack test', 'ERR_STACK');

    expect(error.stack).toContain('Stack test');
    expect(error.stack).toContain('SinterError');
  });
});
