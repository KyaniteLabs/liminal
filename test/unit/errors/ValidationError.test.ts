import { describe, it, expect } from 'vitest';
import { ValidationError } from '../../../src/errors/ValidationError.js';

describe('ValidationError', () => {
  it('creates error with message only', () => {
    const err = new ValidationError('validation failed');
    expect(err.message).toBe('validation failed');
    expect(err.code).toBe('ERR_VALIDATION');
    expect(err.errors).toBeUndefined();
    expect(err.context).toBeUndefined();
  });

  it('accepts a single string error and wraps in array', () => {
    const err = new ValidationError('bad input', 'field is required');
    expect(err.errors).toEqual(['field is required']);
    expect(err.context).toEqual({ errors: ['field is required'] });
  });

  it('accepts an array of error strings', () => {
    const err = new ValidationError('multiple issues', ['too short', 'invalid chars']);
    expect(err.errors).toEqual(['too short', 'invalid chars']);
    expect(err.context).toEqual({ errors: ['too short', 'invalid chars'] });
  });

  it('merges custom context with errors', () => {
    const err = new ValidationError('failed', 'bad', { field: 'email' });
    expect(err.context).toEqual({ field: 'email', errors: ['bad'] });
  });

  it('sets context to undefined when no errors and no context', () => {
    const err = new ValidationError('failed');
    expect(err.context).toBeUndefined();
  });

  it('sets context with only custom context (no errors)', () => {
    const err = new ValidationError('failed', undefined, { source: 'schema' });
    expect(err.context).toEqual({ source: 'schema' });
    expect(err.errors).toBeUndefined();
  });

  it('is instanceof Error', () => {
    const err = new ValidationError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ValidationError');
  });
});
