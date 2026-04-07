/**
 * Network availability check for tests that depend on external CDN resources.
 *
 * Browser-based tests (Renderer, SandboxRunner, HeadlessRenderer) load p5.js
 * and other assets from public CDNs. In sandboxed/offline environments those
 * requests hang indefinitely, causing tests to fail via timeout rather than
 * skip gracefully.
 *
 * Usage (top-level await in ESM test files):
 *   import { isCdnAvailable } from '../helpers/networkCheck.js';
 *   const cdnAvailable = await isCdnAvailable();
 *   describe.skipIf(process.env.CI || !cdnAvailable)('...', () => { ... });
 */

import net from 'node:net';

const CDN_HOST = 'cdnjs.cloudflare.com';
const CDN_PORT = 443;
const TIMEOUT_MS = 2000;

/**
 * Check whether the p5.js CDN is reachable via TCP.
 * Uses a raw socket so it doesn't hang waiting for TLS or HTTP.
 * Resolves to false on timeout or any network error.
 */
export function isCdnAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, TIMEOUT_MS);

    socket.connect(CDN_PORT, CDN_HOST, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}
