import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';

describe('CSRF Protection', () => {
  let server: PreviewServer;
  const TEST_PORT = 3459;
  let csrfToken: string;
  let cookieHeader: string;

  beforeAll(async () => {
    server = new PreviewServer();
    await server.start(TEST_PORT);
    // Get CSRF token and cookie
    const resp = await fetch(`http://localhost:${TEST_PORT}/api/csrf-token`);
    const data = await resp.json();
    csrfToken = data.csrfToken;
    // Extract cookie from response
    const cookies = resp.headers.get('set-cookie');
    if (cookies) {
      cookieHeader = cookies.split(';')[0];
    }
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should reject POST without CSRF token', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'test', format: 'js' }),
    });
    expect(response.status).toBe(403);
  });

  it('should accept POST with valid CSRF token and cookie', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ code: 'test', format: 'js' }),
    });
    // May fail for other reasons but not 403
    expect(response.status).not.toBe(403);
  });

  it('should reject POST with valid token but without cookie', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        // No Cookie header
      },
      body: JSON.stringify({ code: 'test', format: 'js' }),
    });
    // Without the cookie, CSRF validation should fail
    expect(response.status).toBe(403);
  });

  it('should provide CSRF token endpoint', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/api/csrf-token`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.csrfToken).toBeTruthy();
  });
});
