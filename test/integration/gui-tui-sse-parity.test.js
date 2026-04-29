import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
    server.on('error', reject);
  });
}

function readOneSseBlock(port, sessionId, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = fetch(`http://127.0.0.1:${port}/api/tui/session/${sessionId}/events`, {
      headers: { Accept: 'text/event-stream', ...headers },
    });
    req.then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const timeout = setTimeout(() => reject(new Error('timed out waiting for SSE block')), 3000);
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          const eventBlock = blocks.find((block) => block.includes('data:'));
          if (eventBlock) {
            clearTimeout(timeout);
            await reader.cancel();
            resolve(eventBlock);
            return;
          }
        }
        clearTimeout(timeout);
        await reader.cancel();
        resolve(buffer);
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    }).catch(reject);
  });
}

describe('GUI TUI SSE parity', () => {
  let server;
  let port;
  let configPath;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-gui-sse-'));
    configPath = path.join(tmpDir, 'config.json');
    process.env.LIMINAL_CONFIG_PATH = configPath;
    const { createApp } = await import('../../gui/server.js');
    const app = createApp(configPath);
    const started = await startServer(app);
    server = started.server;
    port = started.port;
  }, 30_000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    delete process.env.LIMINAL_CONFIG_PATH;
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('streams TUI bridge events with event ids and Last-Event-ID replay semantics', async () => {
    const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
    const session = await createRes.json();

    await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/cancel`, { method: 'POST' });

    const first = await readOneSseBlock(port, session.sessionId);
    expect(first).toContain('id: 1');
    expect(first).toContain('data:');
    expect(first).toContain('Generation stopped by operator');

    const resumed = await readOneSseBlock(port, session.sessionId, { 'Last-Event-ID': '1' });
    expect(resumed).toContain('id: 2');
    expect(resumed).not.toContain('id: 1');
  });
});
