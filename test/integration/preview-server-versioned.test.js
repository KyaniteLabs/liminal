import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * PreviewServer versioned preview tests - GET /preview?version=N
 * Selection change updates preview URL / content (server side).
 */

import { PreviewServer } from '../../src/render/PreviewServer.js';

describe('PreviewServer versioned preview', () => {
  let previewServer;
  let TEST_PORT;

  beforeEach(() => {
    previewServer = new PreviewServer();
  });

  afterEach(async () => {
    if (previewServer) {
      try {
        await previewServer.stop();
      } catch (_) {}
    }
  });

  async function startPreviewServer() {
    await previewServer.start(0);
    TEST_PORT = previewServer.getPort();
    expect(TEST_PORT).toBeGreaterThan(0);
  }

  it('should serve GET /preview?version=N with code set for that version', async () => {
    await startPreviewServer();
    previewServer.setVersionCode(1, 'createCanvas(100, 100);');
    previewServer.setVersionCode(2, 'createCanvas(200, 200);');

    const res1 = await fetch(`http://localhost:${TEST_PORT}/preview?version=1`);
    expect(res1.status).toBe(200);
    const html1 = await res1.text();
    expect(html1).toContain('createCanvas(100, 100);');
    expect(html1).not.toContain('createCanvas(200, 200);');

    const res2 = await fetch(`http://localhost:${TEST_PORT}/preview?version=2`);
    expect(res2.status).toBe(200);
    const html2 = await res2.text();
    expect(html2).toContain('createCanvas(200, 200);');
    expect(html2).not.toContain('createCanvas(100, 100);');
  });

  it('should support setAllVersions to set multiple iterations at once', async () => {
    await startPreviewServer();
    previewServer.setAllVersions([
      { version: 1, code: 'code_v1', timestamp: '' },
      { version: 2, code: 'code_v2', timestamp: '' },
      { version: 3, code: 'code_v3', timestamp: '' },
    ]);

    const r1 = await fetch(`http://localhost:${TEST_PORT}/preview?version=1`);
    expect((await r1.text())).toContain('code_v1');
    const r2 = await fetch(`http://localhost:${TEST_PORT}/preview?version=2`);
    expect((await r2.text())).toContain('code_v2');
    const r3 = await fetch(`http://localhost:${TEST_PORT}/preview?version=3`);
    expect((await r3.text())).toContain('code_v3');
  });

  it('should return 400 or empty sketch when version param missing', async () => {
    await startPreviewServer();
    previewServer.setVersionCode(1, 'x');

    const res = await fetch(`http://localhost:${TEST_PORT}/preview`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('p5');
  });

  it('should serve HTML with p5 CDN for valid version', async () => {
    await startPreviewServer();
    previewServer.setVersionCode(3, 'function setup() { createCanvas(400, 400); }');

    const res = await fetch(`http://localhost:${TEST_PORT}/preview?version=3`);
    const html = await res.text();
    expect(html).toContain('p5.min.js');
    expect(html).toContain('createCanvas(400, 400)');
  });

  it('should serve GUI at /gui when run from project root', async () => {
    await startPreviewServer();
    const res = await fetch(`http://localhost:${TEST_PORT}/gui`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // GUI serves gui/index.html (Config app); static HTML has title and root div, not "preview"/"Code"
    expect(html).toContain('Liminal');
    expect(html).toContain('root');
    expect(html).toMatch(/<title>.*<\/title>/);
  });
});
