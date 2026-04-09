import { describe, it, expect } from 'vitest';
/**
 * timeoutFetch tests
 */

import {
  timeoutFetch,
  FetchTimeoutError,
  FetchHttpError,
  type TimeoutFetchOptions,
} from '../../../src/utils/timeoutFetch.js';

describe('timeoutFetch', () => {
  describe('exports', () => {
    it('exports timeoutFetch function', () => {
      expect(typeof timeoutFetch).toBe('function');
    });

    it('exports FetchTimeoutError class', () => {
      expect(typeof FetchTimeoutError).toBe('function');
      const err = new FetchTimeoutError('http://test.com', 5000);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('FetchTimeoutError');
      expect(err.message).toContain('http://test.com');
      expect(err.message).toContain('5000ms');
    });

    it('exports FetchHttpError class', () => {
      expect(typeof FetchHttpError).toBe('function');
      const err = new FetchHttpError(404, 'Not Found', 'http://test.com');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('FetchHttpError');
      expect(err.status).toBe(404);
      expect(err.statusText).toBe('Not Found');
      expect(err.message).toContain('HTTP 404');
    });
  });

  describe('TimeoutFetchOptions interface', () => {
    it('accepts timeout option', () => {
      const opts: TimeoutFetchOptions = { timeout: 5000, method: 'GET' };
      expect(opts.timeout).toBe(5000);
      expect(opts.method).toBe('GET');
    });

    it('has optional timeout with default handled by function', () => {
      const opts: TimeoutFetchOptions = {};
      expect(opts.timeout).toBeUndefined();
    });
  });
});
