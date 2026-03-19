/**
 * Tests for LLM error hierarchy.
 */
import { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from '../../../src/llm/LLMClient.js';

describe('LLMError hierarchy', () => {
  it('LLMError has correct properties', () => {
    const err = new LLMError('test error', 'inception', 500, true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.message).toBe('test error');
    expect(err.provider).toBe('inception');
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('LLMError');
  });

  it('LLMError defaults retryable to false', () => {
    const err = new LLMError('test', 'openai');
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBeUndefined();
  });

  it('LLMTimeoutError is retryable', () => {
    const err = new LLMTimeoutError('anthropic');
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(LLMTimeoutError);
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe('anthropic');
    expect(err.name).toBe('LLMTimeoutError');
  });

  it('LLMRateLimitError is retryable with 429 status', () => {
    const err = new LLMRateLimitError('openai', 30);
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(LLMRateLimitError);
    expect(err.retryable).toBe(true);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.name).toBe('LLMRateLimitError');
  });

  it('LLMAuthError is not retryable', () => {
    const err = new LLMAuthError('anthropic');
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(LLMAuthError);
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('LLMAuthError');
  });
});
