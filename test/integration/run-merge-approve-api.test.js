import { describe, it, expect, beforeAll, afterAll } from 'vitest';
/**
 * Integration tests for Run (organism mode), Merge, Approve, and Propose-mutate APIs.
 * Wave 1: POST /api/run with mode=organism; POST /api/merge; POST /api/approve; POST /api/propose-mutate.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import http from 'http';

const realFetch = globalThis.__liminalNativeFetch || globalThis.fetch.bind(globalThis);

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

  async function forbidExternalFetches(action) {
    const originalFetch = globalThis.fetch;
    const externalUrls = [];
    globalThis.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = String(rawUrl);
      if (url.startsWith(`http://127.0.0.1:${port}`)) {
        return originalFetch(input, init);
      }
      externalUrls.push(url || '<unknown>');
      throw new Error(`External fetch is forbidden in this deterministic API path: ${url}`);
    };
    try {
      const result = await action();
      return { result, externalUrls };
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  describe('POST /api/run with mode=organism (W1-R)', () => {
    it('accepts mode=organism and traits, returns 200, gallery has organism iterations', async () => {
      const projectName = `organism-${Date.now()}`;
      const { status, body } = await post('/api/run', {
        prompt: 'ambient glitch',
        mode: 'organism',
        project: projectName,
        maxIterations: 2,
        traits: { bpm: 100, palette: 'warm' },
        useLLM: false,
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
      const projectName = `merge-test-${Date.now()}`;
      await post('/api/run', {
        prompt: 'ambient',
        mode: 'organism',
        project: projectName,
        maxIterations: 2,
        useLLM: false,
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
      const projectName = `approve-test-${Date.now()}`;
      await post('/api/run', {
        prompt: 'reactive',
        mode: 'organism',
        project: projectName,
        maxIterations: 1,
        useLLM: false,
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
      const projectName = `mutate-traits-${Date.now()}`;
      await post('/api/run', {
        prompt: 'ambient',
        mode: 'organism',
        project: projectName,
        maxIterations: 1,
        useLLM: false,
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;

      const { result, externalUrls } = await forbidExternalFetches(() => post('/api/propose-mutate', {
          dirName,
          version: 1,
          traits: { bpm: 88, palette: 'mono' },
        })
      );
      const { status, body } = result;

      expect(externalUrls).toEqual([]);
      expect(status).toBe(200);
      expect(body.proposed).not.toBeNull();
      expect(body.proposed.musicCode).toContain('setcps');
      expect(body.proposed.musicCode).toContain(String(88 / 60));
      expect(body.proposed.visualCode).toContain('palette: mono');
    });

    it('with traits only does not require a prior LLM-generated run', async () => {
      const projectName = `mutate-fixture-${Date.now()}`;
      const dateStr = new Date().toISOString().split('T')[0];
      const dirName = `${dateStr}--${projectName}`;
      const projectDir = path.join(TEST_GALLERY, dirName);
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'v1.js'), JSON.stringify({
        type: 'organism',
        musicCode: 'setcps(1)\nn("c4").sound("sine")',
        visualCode: 'osc(0.2).out();',
      }));

      const { result, externalUrls } = await forbidExternalFetches(() => post('/api/propose-mutate', {
          dirName,
          version: 1,
          traits: { bpm: 72, palette: 'amber' },
        })
      );
      const { status, body } = result;

      expect(externalUrls).toEqual([]);
      expect(status).toBe(200);
      expect(body.proposed).toMatchObject({
        type: 'organism',
      });
      expect(body.proposed.musicCode).toContain(String(72 / 60));
      expect(body.proposed.visualCode).toContain('palette: amber');
    });
  });
});
