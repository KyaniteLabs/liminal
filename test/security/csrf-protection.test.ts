import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';

describe('CSRF Protection', () => {
  let server: PreviewServer;
  let baseUrl: string;
  let csrfToken: string;
  let cookieHeader: string;
  let previousNodeEnv: string | undefined;
  let previousCsrfSecret: string | undefined;

  beforeAll(async () => {
    previousNodeEnv = process.env.NODE_ENV;
    previousCsrfSecret = process.env.CSRF_SECRET;
    process.env.NODE_ENV = 'development';
    process.env.CSRF_SECRET = 'test-secret';

    server = new PreviewServer();
    await server.start(0);
    const port = server.getPort();
    if (!port) throw new Error('PreviewServer did not report a bound port');
    baseUrl = `http://127.0.0.1:${port}`;

    // Get CSRF token and cookie
    const resp = await fetch(`${baseUrl}/api/csrf-token`);
    const data = await resp.json();
    csrfToken = data.csrfToken;
    // Extract cookie from response
    const cookies = resp.headers.get('set-cookie');
    if (cookies) {
      cookieHeader = cookies.split(';')[0];
    }
    if (!cookieHeader) throw new Error('CSRF token endpoint did not set a cookie');
  });

  afterAll(async () => {
    await server.stop();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousCsrfSecret === undefined) delete process.env.CSRF_SECRET;
    else process.env.CSRF_SECRET = previousCsrfSecret;
  });

  it('should reject POST without CSRF token', async () => {
    const response = await fetch(`${baseUrl}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'test', format: 'js' }),
    });
    expect(response.status).toBe(403);
  });

  it('should accept POST with valid CSRF token and cookie', async () => {
    const response = await fetch(`${baseUrl}/api/export`, {
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
    const response = await fetch(`${baseUrl}/api/export`, {
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
    const response = await fetch(`${baseUrl}/api/csrf-token`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.csrfToken).toEqual(expect.stringMatching(/\S/));
  });
});
