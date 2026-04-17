import { describe, it, expect } from 'vitest';
import { formatError, formatErrorWithFallback } from '../../../src/utils/errors.js';

describe('formatError', () => {
  it('formats Error instances', () => {
    const result = formatError('Ctx', new Error('boom'));
    expect(result).toBe('Ctx: boom');
  });

  it('formats string errors', () => {
    expect(formatError('Test', 'raw string')).toBe('Test: raw string');
  });

  it('formats number errors', () => {
    expect(formatError('Code', 404)).toBe('Code: 404');
  });

  it('formats null/undefined errors', () => {
    expect(formatError('X', null)).toBe('X: null');
    expect(formatError('Y', undefined)).toBe('Y: undefined');
  });
});

describe('formatErrorWithFallback', () => {
  it('formats Error instances', () => {
    expect(formatErrorWithFallback('Ctx', new Error('fail'))).toBe('Ctx: fail');
  });

  it('uses default fallback for non-Error values', () => {
    expect(formatErrorWithFallback('Ctx', null)).toBe('Ctx: Unknown error');
    expect(formatErrorWithFallback('Ctx', undefined)).toBe('Ctx: Unknown error');
    expect(formatErrorWithFallback('Ctx', 'string')).toBe('Ctx: Unknown error');
  });

  it('uses custom fallback', () => {
    expect(formatErrorWithFallback('Ctx', null, 'Custom fallback')).toBe('Ctx: Custom fallback');
  });
});
