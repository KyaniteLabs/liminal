import { describe, it, expect } from 'vitest';
import { ExportError } from '../../../src/errors/ExportError.js';
import { SecurityError } from '../../../src/errors/ExportError.js';

describe('ExportError', () => {
  it('creates with message only', () => {
    const err = new ExportError('export failed');
    expect(err.message).toBe('export failed');
    expect(err.code).toBe('ERR_EXPORT');
    expect(err.path).toBeUndefined();
    expect(err.format).toBeUndefined();
    expect(err.retryable).toBe(false);
  });

  it('creates with path and format options', () => {
    const err = new ExportError('bad export', { path: '/out.html', format: 'html' });
    expect(err.path).toBe('/out.html');
    expect(err.format).toBe('html');
    expect(err.context?.path).toBe('/out.html');
    expect(err.context?.format).toBe('html');
  });

  it('creates with cause (Error instance)', () => {
    const cause = new Error('disk full');
    const err = new ExportError('export failed', { cause });
    expect(err.cause).toBe(cause);
    expect(err.context?.causeMessage).toBe('disk full');
  });

  it('skips causeMessage when cause is not an Error', () => {
    const err = new ExportError('export failed', { cause: 'string' as any });
    expect(err.cause).toBeUndefined();
    expect(err.context?.causeMessage).toBeUndefined();
  });

  it('omits path/format from context when not provided', () => {
    const err = new ExportError('export failed', {});
    expect(err.context).toEqual({});
  });
});

describe('SecurityError', () => {
  it('creates with message only', () => {
    const err = new SecurityError('security violation');
    expect(err.message).toBe('security violation');
    expect(err.code).toBe('ERR_SECURITY');
    expect(err.path).toBeUndefined();
    expect(err.reason).toBeUndefined();
  });

  it('creates with path and reason options', () => {
    const err = new SecurityError('path traversal', { path: '/etc/passwd', reason: 'traversal detected' });
    expect(err.path).toBe('/etc/passwd');
    expect(err.reason).toBe('traversal detected');
    expect(err.context?.path).toBe('/etc/passwd');
    expect(err.context?.reason).toBe('traversal detected');
  });

  it('creates with cause (Error instance)', () => {
    const cause = new Error('validation failed');
    const err = new SecurityError('security error', { cause });
    expect(err.cause).toBe(cause);
    expect(err.context?.causeMessage).toBe('validation failed');
  });

  it('skips causeMessage when cause is not an Error', () => {
    const err = new SecurityError('security error', { cause: 42 as any });
    expect(err.cause).toBeUndefined();
    expect(err.context?.causeMessage).toBeUndefined();
  });
});
