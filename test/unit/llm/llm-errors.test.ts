import { describe, it, expect } from 'vitest';
/**
 * Tests for LLM error hierarchy.
 */
import { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from '../../../src/llm/LLMClient.js';
import { LLMGenerationError } from '../../../src/errors/LLMGenerationError.js';
import { extractLLMErrorProvenance } from '../../../src/llm/ErrorProvenance.js';
import { sanitizeLLMEndpoint } from '../../../src/llm/errors.js';

describe('LLMError hierarchy', () => {
  it('LLMError has correct properties', () => {
    const err = new LLMError('test error', 'lmstudio', 500, true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.message).toBe('test error');
    expect(err.provider).toBe('lmstudio');
    expect(err.statusCode).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('LLMError');
  });

  it('LLMError defaults retryable to false', () => {
    const err = new LLMError('test', 'openai');
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBeUndefined();
  });


  it('LLMError stores upstream provenance details', () => {
    const err = new LLMError('server rejected request', 'openai', 429, true, {
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      responseBody: 'rate limit',
    });

    expect(err.model).toBe('gpt-5.4-mini');
    expect(err.endpoint).toContain('/chat/completions');
    expect(err.responseBody).toBe('rate limit');
  });

  it('extracts provenance through LLMGenerationError cause chains', () => {
    const cause = new LLMError('OpenAI API error 429: rate limit', 'openai', 429, true, {
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      responseBody: 'rate limit',
    });
    const wrapped = new LLMGenerationError('LLM generation failed: OpenAI API error 429: rate limit', {
      cause,
      model: 'gpt-5.4-mini',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      statusCode: 429,
      retryable: true,
      responseBody: 'rate limit',
    });

    expect(extractLLMErrorProvenance(wrapped)).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      statusCode: 429,
      retryable: true,
      responseBody: 'rate limit',
    });
  });


  it('redacts secret query values from endpoint provenance', () => {
    expect(sanitizeLLMEndpoint('https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=secret-token&foo=bar'))
      .toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=[REDACTED]&foo=bar');
  });

  it('LLMTimeoutError is retryable', () => {
    const err = new LLMTimeoutError('lmstudio');
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(LLMTimeoutError);
    expect(err.retryable).toBe(true);
    expect(err.provider).toBe('lmstudio');
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
    const err = new LLMAuthError('minimax');
    expect(err).toBeInstanceOf(LLMError);
    expect(err).toBeInstanceOf(LLMAuthError);
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('LLMAuthError');
  });
});
