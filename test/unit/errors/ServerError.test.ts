import { describe, it, expect } from 'vitest';
import { ServerError } from '../../../src/errors/ServerError.js';

describe('ServerError', () => {
  it('creates error with message only', () => {
    const err = new ServerError('server crashed');
    expect(err.message).toBe('server crashed');
    expect(err.code).toBe('ERR_SERVER');
    expect(err.port).toBeUndefined();
    expect(err.endpoint).toBeUndefined();
  });

  it('stores port when provided', () => {
    const err = new ServerError('bind failed', { port: 3000 });
    expect(err.port).toBe(3000);
    expect(err.context).toEqual({ port: 3000 });
  });

  it('stores endpoint when provided', () => {
    const err = new ServerError('not found', { endpoint: '/api/health' });
    expect(err.endpoint).toBe('/api/health');
    expect(err.context).toEqual({ endpoint: '/api/health' });
  });

  it('stores both port and endpoint', () => {
    const err = new ServerError('fail', { port: 8080, endpoint: '/ws' });
    expect(err.port).toBe(8080);
    expect(err.endpoint).toBe('/ws');
    expect(err.context).toEqual({ port: 8080, endpoint: '/ws' });
  });

  it('passes Error cause with causeMessage', () => {
    const cause = new Error('EADDRINUSE');
    const err = new ServerError('bind failed', { cause });
    expect(err.cause).toBe(cause);
    expect(err.context).toEqual({ causeMessage: 'EADDRINUSE' });
  });

  it('is instanceof Error', () => {
    expect(new ServerError('test')).toBeInstanceOf(Error);
  });
});
