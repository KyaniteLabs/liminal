import { describe, it, expect } from 'vitest';
import { GenerationError } from '../../src/errors/GenerationError';
import { SinterError } from '../../src/errors/base';

describe('GenerationError', () => {
  it('should create a GenerationError with message and code', () => {
    const error = new GenerationError('Generation failed');

    expect(error.message).toBe('Generation failed');
    expect(error.code).toBe('ERR_GENERATION');
    expect(error.name).toBe('GenerationError');
  });

  it('should create a GenerationError with domain', () => {
    const error = new GenerationError('P5 generation failed', 'p5');

    expect(error.message).toBe('P5 generation failed');
    expect(error.domain).toBe('p5');
    expect(error.context).toEqual({ domain: 'p5' });
  });

  it('should create a GenerationError with domain and context', () => {
    const error = new GenerationError('Failed', 'glsl', { prompt: 'test' });

    expect(error.domain).toBe('glsl');
    expect(error.context).toEqual({ domain: 'glsl', prompt: 'test' });
  });

  it('should be an instance of SinterError and Error', () => {
    const error = new GenerationError('Test');

    expect(error).toBeInstanceOf(SinterError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GenerationError);
  });

  it('should work without domain (undefined)', () => {
    const error = new GenerationError('Simple error');

    expect(error.domain).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('should include cause in context if provided', () => {
    const cause = new Error('Original error');
    const error = new GenerationError('Failed', 'p5', {}, cause);

    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ domain: 'p5', cause: 'Original error' });
  });
});
