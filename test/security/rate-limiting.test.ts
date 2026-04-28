import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import {
  getLimiterForEndpoint,
} from '../../src/security/RateLimiter.js';

describe('Rate Limiting', () => {
  let server: PreviewServer;
  const TEST_PORT = 3460;

  beforeAll(async () => {
    server = new PreviewServer();
    await server.start(TEST_PORT);
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should include rate limit headers', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/gallery`);
    expect(response.headers.get('ratelimit-limit')).toBeTruthy();
    expect(response.headers.get('ratelimit-remaining')).toBeTruthy();
  });

  it('should return 429 after too many requests', async () => {
    // Make many requests quickly
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(fetch(`http://localhost:${TEST_PORT}/api/gallery`));
    }
    const responses = await Promise.all(promises);

    // At least one should be rate limited
    const hasRateLimited = responses.some((r) => r.status === 429);
    expect(hasRateLimited).toBe(true);
  });

  it('should include retry-after header on 429 responses', async () => {
    // Make many requests to trigger rate limit
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(fetch(`http://localhost:${TEST_PORT}/api/gallery`));
    }
    const responses = await Promise.all(promises);

    // Find a rate limited response
    const rateLimitedResponse = responses.find((r) => r.status === 429);
    if (rateLimitedResponse) {
      expect(rateLimitedResponse.headers.get('retry-after')).toBeTruthy();
      const body = await rateLimitedResponse.json();
      expect(body.error).toBe('Too many requests');
      expect(body.retryAfter).toBeTruthy();
    }
  });

  it('should return JSON error on rate limit exceeded', async () => {
    // Make many requests to trigger rate limit
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(fetch(`http://localhost:${TEST_PORT}/api/gallery`));
    }
    const responses = await Promise.all(promises);

    // Find a rate limited response
    const rateLimitedResponse = responses.find((r) => r.status === 429);
    expect(rateLimitedResponse).toBeTruthy();

    if (rateLimitedResponse) {
      const body = await rateLimitedResponse.json();
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('retryAfter');
      expect(body.error.toLowerCase()).toMatch(/rate|too many/);
    }
  });
});

describe('Rate Limiter Configuration', () => {
  it('should return export limiter for /api/export endpoint', () => {
    const limiter = getLimiterForEndpoint('/api/export');
    expect(limiter).not.toBeNull();
    expect(typeof limiter).toBe('function');
  });

  it('should return sandbox limiter for /api/sandbox endpoint', () => {
    const limiter = getLimiterForEndpoint('/api/sandbox');
    expect(limiter).not.toBeNull();
    expect(typeof limiter).toBe('function');
  });

  it('should return standard limiter for other endpoints', () => {
    const limiter = getLimiterForEndpoint('/api/gallery');
    expect(limiter).not.toBeNull();
    expect(typeof limiter).toBe('function');
  });

  it('should return standard limiter for unknown endpoints', () => {
    const limiter = getLimiterForEndpoint('/api/unknown');
    expect(limiter).not.toBeNull();
    expect(typeof limiter).toBe('function');
  });

  it('should apply different limiters for different endpoints', () => {
    const exportLimiter = getLimiterForEndpoint('/api/export');
    const sandboxLimiter = getLimiterForEndpoint('/api/sandbox');
    const standardLimiter = getLimiterForEndpoint('/api/gallery');
    
    // Each endpoint should have a limiter
    expect(exportLimiter).not.toBeNull();
    expect(sandboxLimiter).not.toBeNull();
    expect(standardLimiter).not.toBeNull();
    
    // They should be different middleware functions
    expect(exportLimiter).not.toBe(standardLimiter);
  });
});
