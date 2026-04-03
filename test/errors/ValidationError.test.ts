import { describe, it, expect } from 'vitest';
import { ValidationError } from '../../src/errors/ValidationError';
import { LiminalError } from '../../src/errors/base';

describe('ValidationError', () => {
  it('should create a ValidationError with message and code', () => {
    const error = new ValidationError('Validation failed');

    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('ERR_VALIDATION');
    expect(error.name).toBe('ValidationError');
  });

  it('should create a ValidationError with validation errors array', () => {
    const errors = ['Missing semicolon', 'Undefined variable'];
    const error = new ValidationError('Code validation failed', errors);

    expect(error.message).toBe('Code validation failed');
    expect(error.errors).toEqual(errors);
    expect(error.context).toEqual({ errors });
  });

  it('should be an instance of LiminalError and Error', () => {
    const error = new ValidationError('Test');

    expect(error).toBeInstanceOf(LiminalError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should handle single error string', () => {
    const error = new ValidationError('Single error', 'One issue found');

    expect(error.errors).toEqual(['One issue found']);
  });

  it('should handle additional context with errors', () => {
    const errors = ['Error 1'];
    const error = new ValidationError('Failed', errors, { source: 'test.ts' });

    expect(error.errors).toEqual(errors);
    expect(error.context).toEqual({ errors, source: 'test.ts' });
  });

  it('should format errors in message when provided', () => {
    const errors = ['Error A', 'Error B'];
    const error = new ValidationError('Validation failed', errors);

    expect(error.message).toContain('Validation failed');
  });
});
