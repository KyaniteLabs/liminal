import { describe, it, expect } from 'vitest';
import { GenerationError } from '../../../src/errors/GenerationError.js';

describe('GenerationError', () => {
  it('creates error with message only', () => {
    const err = new GenerationError('generation failed');
    expect(err.message).toBe('generation failed');
    expect(err.code).toBe('ERR_GENERATION');
    expect(err.domain).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err.retryable).toBe(false);
    expect(err.context).toBeUndefined();
  });

  it('stores domain when provided', () => {
    const err = new GenerationError('failed', 'hydra');
    expect(err.domain).toBe('hydra');
    expect(err.context).toEqual({ domain: 'hydra' });
  });

  it('stores cause when provided', () => {
    const cause = new Error('timeout');
    const err = new GenerationError('failed', undefined, undefined, cause);
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ cause: 'timeout' });
  });

  it('stores both domain and cause', () => {
    const cause = new Error('network');
    const err = new GenerationError('failed', 'p5', { attempts: 3 }, cause);
    expect(err.domain).toBe('p5');
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ attempts: 3, domain: 'p5', cause: 'network' });
  });

  it('merges custom context with domain and cause', () => {
    const err = new GenerationError('failed', 'glsl', { model: 'glm-4' });
    expect(err.context).toEqual({ model: 'glm-4', domain: 'glsl' });
  });

  it('omits context when no domain, cause, or extras', () => {
    const err = new GenerationError('failed');
    expect(err.context).toBeUndefined();
  });

  it('is instanceof Error', () => {
    const err = new GenerationError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('GenerationError');
  });
});
