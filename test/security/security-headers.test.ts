import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import http from 'http';

describe('Security Headers', () => {
  let server: PreviewServer;
  let httpServer: http.Server;
  const TEST_PORT = 3461;

  beforeAll(async () => {
    server = new PreviewServer();
    await server.start(TEST_PORT);
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should include Content-Security-Policy header', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });

  it('should include X-Frame-Options: DENY header', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('should include X-Content-Type-Options: nosniff header', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('should include Strict-Transport-Security header', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    expect(response.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('should remove X-Powered-By header', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/`);
    expect(response.headers.get('x-powered-by')).toBeFalsy();
  });
});
