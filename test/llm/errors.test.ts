import { describe, it, expect } from 'vitest';
import { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from '../../src/llm/errors.js';

describe('LLM Errors', () => {
  describe('LLMError', () => {
    it('should create base error with provider', () => {
      const error = new LLMError('Something went wrong', 'test-provider');
      
      expect(error.message).toBe('Something went wrong');
      expect(error.provider).toBe('test-provider');
      expect(error.name).toBe('LLMError');
      expect(error.retryable).toBe(false);
    });

    it('should create error with status code and retryable flag', () => {
      const error = new LLMError('Server error', 'openai', 500, true);
      
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });
  });

  describe('LLMTimeoutError', () => {
    it('should create timeout error for provider', () => {
      const error = new LLMTimeoutError('ollama');
      
      expect(error.message).toBe('Timeout calling ollama API');
      expect(error.provider).toBe('ollama');
      expect(error.name).toBe('LLMTimeoutError');
      expect(error.retryable).toBe(true);
    });
  });

  describe('LLMRateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new LLMRateLimitError('openai');
      
      expect(error.message).toBe('Rate limited by openai API');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(error.retryAfterSeconds).toBeUndefined();
    });

    it('should include retry after seconds when provided', () => {
      const error = new LLMRateLimitError('anthropic', 60);
      
      expect(error.retryAfterSeconds).toBe(60);
    });
  });

  describe('LLMAuthError', () => {
    it('should create auth error for provider', () => {
      const error = new LLMAuthError('openai');
      
      expect(error.message).toBe('Authentication failed for openai');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Error inheritance', () => {
    it('all errors should be instances of LLMError', () => {
      expect(new LLMTimeoutError('test')).toBeInstanceOf(LLMError);
      expect(new LLMRateLimitError('test')).toBeInstanceOf(LLMError);
      expect(new LLMAuthError('test')).toBeInstanceOf(LLMError);
    });

    it('all errors should be instances of Error', () => {
      expect(new LLMError('test', 'provider')).toBeInstanceOf(Error);
      expect(new LLMTimeoutError('test')).toBeInstanceOf(Error);
      expect(new LLMRateLimitError('test')).toBeInstanceOf(Error);
      expect(new LLMAuthError('test')).toBeInstanceOf(Error);
    });
  });
});
