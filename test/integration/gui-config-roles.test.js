import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';

const realFetch = globalThis.__liminalNativeFetch || globalThis.fetch.bind(globalThis);

async function startServer(app) {
  return await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('failed to bind server'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
    server.on('error', reject);
  });
}

async function stopServer(server) {
  if (!server) return;
  // Broad-suite load can leave keep-alive sockets open long enough to flake teardown.
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  });
}

async function postJson(url, body) {
  const res = await realFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe('GUI role config API', () => {
  let tmpDir;
  let configPath;
  let server;
  let baseUrl;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-gui-roles-'));
    configPath = path.join(tmpDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({
      defaultProvider: 'ollama',
      providers: {
        ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
      },
      roles: {
        evaluator: {
          provider: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: 'google/gemini-2.5-flash',
          apiKey: 'old-vision-key',
        },
      },
    }, null, 2));

    const { createApp } = await import('../../gui/server.js');
    const started = await startServer(createApp(configPath));
    server = started.server;
    baseUrl = started.baseUrl;
  }, 30000);

  afterEach(async () => {
    await stopServer(server);
    server = undefined;
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }, 30000);

  it('does not carry a stored evaluator key across provider changes', async () => {
    const response = await postJson(`${baseUrl}/api/config`, {
      defaultProvider: 'ollama',
      providers: {
        ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
      },
      roles: {
        evaluator: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o',
          apiKey: '(stored)',
        },
      },
    });

    expect(response.status).toBe(200);
    const saved = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.roles.evaluator.provider).toBe('openai');
    expect(saved.roles.evaluator.apiKey).toBeUndefined();
  });
});
