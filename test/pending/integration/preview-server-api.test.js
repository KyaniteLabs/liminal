import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
/**
 * TDD: API tests for GET /api/gallery, GET /api/gallery/:project, POST /api/export
 * - Gallery load returns list of project dir names
 * - Export returns path (or content)
 */

import fs from 'fs/promises';
import path from 'path';
import { PreviewServer } from '../../src/render/PreviewServer.js';

describe('PreviewServer API', () => {
  let server;
  let testPort;
  const getTestPort = () => 3456 + Math.floor(Math.random() * 1000) + (process.pid % 100);

  const testGalleryDir = path.join(process.cwd(), 'test-api-gallery-temp');
  const testOutputDir = path.join(process.cwd(), 'test-api-export-temp');

  beforeAll(async () => {
    await fs.mkdir(testGalleryDir, { recursive: true });
    const projectDir = path.join(testGalleryDir, '2026-03-07--api-test-project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(path.join(projectDir, 'v1.js'), 'function setup() {} function draw() {}', 'utf-8');
    await fs.writeFile(path.join(projectDir, 'v2.js'), 'function setup() { createCanvas(400,400); } function draw() {}', 'utf-8');
    await fs.mkdir(testOutputDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testGalleryDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(testOutputDir, { recursive: true, force: true }).catch(() => {});
  });

  beforeEach(async () => {
    server = new PreviewServer({ galleryDir: testGalleryDir });
    // Retry with different ports to avoid EADDRINUSE flakiness
    for (let attempt = 0; attempt < 10; attempt++) {
      testPort = getTestPort();
      try {
        await server.start(testPort);
        return;
      } catch {
        // Port in use, try another
      }
    }
    throw new Error('Could not start test server after 10 attempts');
  });

  afterEach(async () => {
    if (server) await server.stop().catch(() => {});
  });

  describe('GET /api/gallery', () => {
    it('returns list of project directory names', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/gallery`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('projects');
      expect(Array.isArray(data.projects)).toBe(true);
      expect(data.projects).toContain('2026-03-07--api-test-project');
    });

    it('returns empty list when galleryDir not set', async () => {
      await server.stop();
      const port2 = getTestPort();
      server = new PreviewServer();
      await server.start(port2);
      const res = await fetch(`http://localhost:${port2}/api/gallery`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.projects).toEqual([]);
    });
  });

  describe('GET /api/gallery/:project', () => {
    it('returns iterations for a project dir', async () => {
      const projectId = encodeURIComponent('2026-03-07--api-test-project');
      const res = await fetch(`http://localhost:${testPort}/api/gallery/${projectId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('iterations');
      expect(Array.isArray(data.iterations)).toBe(true);
      expect(data.iterations.length).toBe(2);
      const versions = data.iterations.map(i => i.version).sort((a, b) => a - b);
      expect(versions).toEqual([1, 2]);
      expect(data.iterations[0]).toHaveProperty('code');
      expect(data.iterations[0]).toHaveProperty('timestamp');
    });

    it('returns empty iterations for unknown project', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/gallery/2026-03-07--nonexistent`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.iterations).toEqual([]);
    });
  });

  describe('POST /api/export', () => {
    const sampleCode = `function setup() {
  createCanvas(400, 400);
  background(220);
  particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({ x: random(width), y: random(height), speed: random(1, 3), size: random(5, 20), col: color(random(255), random(100, 200), random(255), 200) });
  }
}
function draw() {
  background(0, 25);
  for (let p of particles) {
    fill(p.col);
    noStroke();
    ellipse(p.x, p.y, p.size);
    p.x += random(-p.speed, p.speed);
    p.y += random(-p.speed, p.speed);
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
  }
}`;

    it('export html returns path', async () => {
      const outPath = path.join(testOutputDir, 'api-export.html');
      const res = await fetch(`http://localhost:${testPort}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sampleCode, format: 'html', outputPath: outPath })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('path');
      expect(data.path).toBe(outPath);
      const content = await fs.readFile(data.path, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain(sampleCode);
    });

    it('export js returns path', async () => {
      const outPath = path.join(testOutputDir, 'api-export.js');
      const res = await fetch(`http://localhost:${testPort}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sampleCode, format: 'js', outputPath: outPath })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.path).toBe(outPath);
      const content = await fs.readFile(data.path, 'utf-8');
      expect(content).toBe(sampleCode);
    });

    it('export zip returns path', async () => {
      const outPath = path.join(testOutputDir, 'api-export.zip');
      const res = await fetch(`http://localhost:${testPort}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: sampleCode,
          format: 'zip',
          outputPath: outPath,
          projectName: 'api-test',
          iterations: [
            { version: 1, code: 'code1', timestamp: new Date().toISOString() },
            { version: 2, code: sampleCode, timestamp: new Date().toISOString() }
          ]
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.path).toBe(outPath);
      const stat = await fs.stat(data.path);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('returns 400 when code missing for html', async () => {
      const res = await fetch(`http://localhost:${testPort}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'html', outputPath: path.join(testOutputDir, 'x.html') })
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/sandbox/run', () => {
    it('returns url for live view and preview serves that version', async () => {
      const code = 'function setup() { createCanvas(100,100); } function draw() {}';
      const res = await fetch(`http://localhost:${testPort}/api/sandbox/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, version: 1 })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('url');
      expect(data.url).toContain('/preview');
      expect(data.url).toContain('version=1');
      const previewRes = await fetch(`http://localhost:${testPort}${data.url}`);
      expect(previewRes.status).toBe(200);
      const html = await previewRes.text();
      expect(html).toContain(code);
    });
  });
});
