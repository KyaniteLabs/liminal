/**
 * SECURITY NOTICE: All API keys in this file are FAKE test values.
 * They are intentionally invalid and used for testing only.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
/**
 * Integration tests for GUI backend config API.
 * GET /api/config returns effective + loop + creative + galleryPath + userConfig.
 * POST /api/config persists and GET returns the saved shape.
 * Uses real temp dir for config path; starts server on random port and uses fetch.
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import http from 'http';

const TEST_DIR = path.join(os.tmpdir(), `atelier-gui-config-${Date.now()}`);
const TEST_CONFIG_PATH = path.join(TEST_DIR, 'config.json');

describe('GUI config API', () => {
  /** @type {import('http').Server} */
  let server;
  /** @type {number} */
  let port;

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    process.env.LIMINAL_CONFIG_PATH = TEST_CONFIG_PATH;
    // Unset LLM env so saved file config is used
    delete process.env.ATELIER_LLM_PROVIDER;
    delete process.env.ATELIER_LLM_MODEL;
    delete process.env.ATELIER_LLM_BASE_URL;
    delete process.env.ATELIER_LLM_API_KEY;
    const { createApp } = await import('../../gui/server.js');
    const app = createApp(TEST_CONFIG_PATH);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, () => resolve()));
    const a = server.address();
    port = typeof a === 'object' && a && 'port' in a ? a.port : 0;
    expect(port).toBeGreaterThan(0);
  }, 30000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    delete process.env.LIMINAL_CONFIG_PATH;
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    try {
      await fs.unlink(TEST_CONFIG_PATH);
    } catch (_) {}
  });

  async function get(pathname) {
    const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  async function post(pathname, data) {
    const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }

  describe('GET /api/config', () => {
    it('returns effective config, loop options, min quality, gallery path, and userConfig', async () => {
      const body = await get('/api/config');
      expect(body).toHaveProperty('effective');
      expect(body.effective).toMatchObject({
        provider: expect.any(String),
        model: expect.any(String),
      });
      expect(body.effective).toHaveProperty('baseUrl');
      expect(body.effective).toHaveProperty('apiKeyStored');
      expect(body).toHaveProperty('loop');
      expect(body.loop).toMatchObject({
        maxIterations: expect.any(Number),
        timeoutMinutes: expect.any(Number),
      });
      expect(body).toHaveProperty('creative');
      expect(body.creative).toMatchObject({ minQualityScore: expect.any(Number) });
      expect(body).toHaveProperty('galleryPath');
      expect(typeof body.galleryPath).toBe('string');
      expect(body).toHaveProperty('userConfig');
    });

    it('returns saved values after POST', async () => {
      await post('/api/config', {
        defaultProvider: 'ollama',
        providers: {
          ollama: { baseUrl: 'http://localhost:11434/v1', model: 'codellama', apiKey: 'secret' },
        },
        loop: { maxIterations: 5, timeoutMinutes: 10 },
        creative: { minQualityScore: 0.8 },
        galleryPath: 'my-gallery',
      });

      const res = await get('/api/config');
      // effective may be overridden by project config (config/atelier.json); assert saved userConfig and loop/gallery
      expect(res.userConfig).not.toBeNull();
      expect(res.userConfig.defaultProvider).toBe('ollama');
      expect(res.userConfig.providers.ollama.model).toBe('codellama');
      expect(res.userConfig.providers.ollama.baseUrl).toBe('http://localhost:11434/v1');
      expect(res.userConfig.providers.ollama.apiKeyStored).toBe(true);
      expect(res.loop.maxIterations).toBe(5);
      expect(res.loop.timeoutMinutes).toBe(10);
      expect(res.creative.minQualityScore).toBe(0.8);
      expect(res.galleryPath).toBe('my-gallery');
      expect(res.effective).toMatchObject({ provider: expect.any(String), model: expect.any(String) });
    });
  });

  describe('POST /api/config', () => {
    it('persists config to file and GET returns same values', async () => {
      const payload = {
        defaultProvider: 'lmstudio',
        providers: {
          lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model', apiKey: 'key' },
        },
        loop: { maxIterations: 15, timeoutMinutes: 20 },
        creative: { minQualityScore: 0.6 },
        galleryPath: 'gallery',
      };
      await post('/api/config', payload);

      const raw = await fs.readFile(TEST_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.defaultProvider).toBe('lmstudio');
      expect(parsed.providers.lmstudio.model).toBe('local-model');
      expect(parsed.loop.maxIterations).toBe(15);
      expect(parsed.creative.minQualityScore).toBe(0.6);
      expect(parsed.galleryPath).toBe('gallery');
    });
  });
});
