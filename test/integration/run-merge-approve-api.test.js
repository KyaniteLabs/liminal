import { describe, it, expect, beforeAll, afterAll } from 'vitest';
/**
 * Integration tests for Run (organism mode), Merge, Approve, and Propose-mutate APIs.
 * Wave 1: POST /api/run with mode=organism; POST /api/merge; POST /api/approve; POST /api/propose-mutate.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import http from 'http';
import { LLMClient } from '../../src/llm/LLMClient.js';

const realFetch = globalThis.__liminalNativeFetch || globalThis.fetch.bind(globalThis);

function skipIfNoLLM() {
  if (!LLMClient.isConfigured()) {
    console.log('[SKIP] LLM not configured — skipping organism API test');
    return true;
  }
  return false;
}

const TEST_DIR = path.join(os.tmpdir(), `atelier-run-merge-${Date.now()}`);
const TEST_CONFIG_PATH = path.join(TEST_DIR, 'config.json');
const TEST_GALLERY = path.join(TEST_DIR, 'gallery');

describe('Run / Merge / Approve / Propose-mutate API', () => {
  /** @type {import('http').Server} */
  let server;
  /** @type {number} */
  let port;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(TEST_GALLERY, { recursive: true });
    await fs.writeFile(
      TEST_CONFIG_PATH,
      JSON.stringify({ defaultProvider: 'lmstudio', providers: {}, galleryPath: TEST_GALLERY }, null, 2)
    );
    process.env.LIMINAL_CONFIG_PATH = TEST_CONFIG_PATH;
    const { createApp } = await import('../../gui/server.js');
    const app = createApp(TEST_CONFIG_PATH, 0);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, () => resolve()));
    const a = server.address();
    port = typeof a === 'object' && a && 'port' in a ? a.port : 0;
    expect(port).toBeGreaterThan(0);
  }, 60000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    delete process.env.LIMINAL_CONFIG_PATH;
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  async function post(pathname, data) {
    const res = await realFetch(`http://127.0.0.1:${port}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    return { status: res.status, body };
  }

  async function get(pathname) {
    const res = await realFetch(`http://127.0.0.1:${port}${pathname}`, {
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  describe('POST /api/run with mode=organism (W1-R)', () => {
    it('accepts mode=organism and traits, returns 200, gallery has organism iterations', async () => {
      if (skipIfNoLLM()) return;
      const projectName = `organism-${Date.now()}`;
      const { status, body } = await post('/api/run', {
        prompt: 'ambient glitch',
        mode: 'organism',
        project: projectName,
        maxIterations: 2,
        traits: { bpm: 100, palette: 'warm' },
      });

      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.result).not.toBeNull();
      expect(body.projectDirName).toContain(projectName);

      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;
      const iterations = await get(`/api/gallery/${encodeURIComponent(dirName)}`);
      expect(iterations.iterations).not.toBeNull();
      expect(iterations.iterations.length).toBeGreaterThanOrEqual(1);
      const first = iterations.iterations[0];
      expect(first.type).toBe('organism');
      expect(first.musicCode).not.toBeNull();
      expect(first.visualCode).not.toBeNull();
    });
  });

  describe('POST /api/merge (W1-M)', () => {
    it('returns 200 with proposed musicCode/visualCode when merging two organism versions', async () => {
      if (skipIfNoLLM()) return;
      const projectName = `merge-test-${Date.now()}`;
      await post('/api/run', {
        prompt: 'ambient',
        mode: 'organism',
        project: projectName,
        maxIterations: 2,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;

      const { status, body } = await post('/api/merge', {
        project: projectName,
        dirName,
        versionA: 1,
        versionB: 2,
      });

      expect(status).toBe(200);
      expect(body.proposed).not.toBeNull();
      expect(body.proposed.musicCode).not.toBeNull();
      expect(body.proposed.visualCode).not.toBeNull();
    });
  });

  describe('POST /api/approve (W1-A)', () => {
    it('saves proposed as next version and returns 200', async () => {
      if (skipIfNoLLM()) return;
      const projectName = `approve-test-${Date.now()}`;
      await post('/api/run', {
        prompt: 'reactive',
        mode: 'organism',
        project: projectName,
        maxIterations: 1,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;
      const proposed = {
        type: 'organism',
        musicCode: 'setcps(1)\nn("c4").sound("sine")',
        visualCode: 'osc(0.2).out();',
      };

      const { status } = await post('/api/approve', {
        project: projectName,
        dirName,
        proposed,
      });

      expect(status).toBe(200);
      const iterations = await get(`/api/gallery/${encodeURIComponent(dirName)}`);
      expect(iterations.iterations.length).toBe(2);
      expect(iterations.iterations[1].type).toBe('organism');
      expect(iterations.iterations[1].musicCode).toContain('c4');
    });
  });

  describe('POST /api/propose-mutate (W1-PT)', () => {
    it('with traits only returns proposed organism with updated BPM/palette (no LLM)', async () => {
      if (skipIfNoLLM()) return;
      const projectName = `mutate-traits-${Date.now()}`;
      await post('/api/run', {
        prompt: 'ambient',
        mode: 'organism',
        project: projectName,
        maxIterations: 1,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;

      const { status, body } = await post('/api/propose-mutate', {
        dirName,
        version: 1,
        traits: { bpm: 88, palette: 'mono' },
      });

      expect(status).toBe(200);
      expect(body.proposed).not.toBeNull();
      expect(body.proposed.musicCode).not.toBeNull();
      expect(body.proposed.visualCode).not.toBeNull();
    });
  });
});
