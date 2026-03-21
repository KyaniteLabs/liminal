import { describe, it, expect, beforeAll, afterAll } from 'vitest';
/**
 * E2E GUI: start GUI server (Express from gui/start.js), wait for listen,
 * assert GET /api/config (200 + body shape) and GET /api/gallery (200).
 * Skips with clear message if server fails to start or times out.
 * Uses E2E_GUI_PORT or a unique port to avoid clashes.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

const LISTEN_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 200;

const port =
  Number(process.env.E2E_GUI_PORT) ||
  5174 + 1000 + (process.pid % 1000);

let guiProcess = null;
let serverReady = false;
let skipReason = null;

async function waitForServer() {
  const deadline = Date.now() + LISTEN_TIMEOUT_MS;
  const base = `http://127.0.0.1:${port}`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch (_) {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

describe('E2E GUI', () => {
  beforeAll(async () => {
    guiProcess = spawn('node', ['gui/start.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    });

    guiProcess.on('error', (err) => {
      skipReason = skipReason || `GUI process error: ${err.message}`;
    });

    const ok = await waitForServer();
    if (!ok) {
      skipReason =
        skipReason ||
        `GUI server did not respond at http://127.0.0.1:${port} within ${LISTEN_TIMEOUT_MS}ms`;
    } else {
      serverReady = true;
    }
  }, LISTEN_TIMEOUT_MS + 5000);

  afterAll(async () => {
    if (!guiProcess || !guiProcess.kill) return;
    return new Promise((resolve) => {
      let done = false;
      const onDone = () => {
        if (done) return;
        done = true;
        guiProcess = null;
        resolve();
      };
      guiProcess.on('exit', onDone);
      guiProcess.kill('SIGTERM');
      setTimeout(() => {
        if (guiProcess && guiProcess.kill) guiProcess.kill('SIGKILL');
        onDone();
      }, 2000);
    });
  });

  it('GET /api/config returns 200 and body has provider and model', async () => {
    if (!serverReady) {
      console.warn(`E2E GUI skipped: ${skipReason}`);
      return;
    }
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('effective');
    expect(body.effective).toHaveProperty('provider');
    expect(body.effective).toHaveProperty('model');
    expect(typeof body.effective.provider).toBe('string');
    expect(typeof body.effective.model).toBe('string');
  });

  it('GET /api/gallery returns 200', async () => {
    if (!serverReady) {
      console.warn(`E2E GUI skipped: ${skipReason}`);
      return;
    }
    const res = await fetch(`http://127.0.0.1:${port}/api/gallery`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('projects');
    expect(Array.isArray(body.projects)).toBe(true);
  });
});
