import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import { LiminalFS } from '../../src/fs/LiminalFS.js';

async function startOnEphemeralPort(server: PreviewServer): Promise<number> {
  await server.start(0);
  const port = server.getPort();
  if (!port) throw new Error('PreviewServer did not expose an ephemeral port');
  return port;
}

describe('PreviewServer LiminalFS endpoints', () => {
  let server: PreviewServer;
  let projectRoot: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-preview-test-'));
    originalCwd = process.cwd;
    process.cwd = () => projectRoot;
    server = new PreviewServer();
  });

  afterEach(async () => {
    try {
      await server.stop();
    } catch {
      // ignore
    }
    process.cwd = originalCwd;
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('GET /api/liminal/gallery/:project returns iterations from LiminalFS refs', async () => {
    const fs = LiminalFS.open(projectRoot);
    const ref1 = fs.writeArtifact({
      kind: 'gallery-version',
      content: 'function setup() {}',
      filename: 'v1.js',
      metadata: { project: 'demo', version: 1 },
    });
    fs.writeRef('gallery/demo/v1', ref1);
    const ref2 = fs.writeArtifact({
      kind: 'gallery-version',
      content: 'function draw() {}',
      filename: 'v2.js',
      metadata: { project: 'demo', version: 2 },
    });
    fs.writeRef('gallery/demo/v2', ref2);
    fs.close();

    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/demo`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iterations).toHaveLength(2);
    expect(body.iterations[0].version).toBe(1);
    expect(body.iterations[0].code).toBe('function setup() {}');
    expect(body.iterations[1].version).toBe(2);
    expect(body.iterations[1].code).toBe('function draw() {}');
  });

  it('GET /api/liminal/gallery/:project returns organism iterations', async () => {
    const fs = LiminalFS.open(projectRoot);
    const ref = fs.writeArtifact({
      kind: 'organism',
      content: JSON.stringify({ type: 'organism', musicCode: 'note("c3")', visualCode: 'osc(10)' }),
      filename: 'v1.js',
      metadata: { project: 'organism-demo', version: 1 },
    });
    fs.writeRef('gallery/organism-demo/v1', ref);
    fs.close();

    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/organism-demo`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iterations).toHaveLength(1);
    expect(body.iterations[0].version).toBe(1);
    expect(body.iterations[0].type).toBe('organism');
    expect(body.iterations[0].musicCode).toBe('note("c3")');
    expect(body.iterations[0].visualCode).toBe('osc(10)');
  });

  it('GET /api/liminal/gallery/:project/:version returns artifact content', async () => {
    const fs = LiminalFS.open(projectRoot);
    const ref = fs.writeArtifact({
      kind: 'gallery-version',
      content: 'ellipse(50, 50, 20, 20);',
      filename: 'v3.js',
      metadata: { project: 'demo', version: 3 },
    });
    fs.writeRef('gallery/demo/v3', ref);
    fs.close();

    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/demo/3`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ellipse(50, 50, 20, 20);');
  });

  it('GET /api/liminal/gallery/:project/:version returns 404 for missing version', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/demo/99`);
    expect(res.status).toBe(404);
  });

  // ── Security tests ──

  it('rejects path traversal in project name', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/..%2Fsecret`);
    expect(res.status).toBe(400);
  });

  it('rejects slash in project name', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/a%2Fb`);
    expect(res.status).toBe(400);
  });

  it('rejects non-numeric version', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/demo/abc`);
    expect(res.status).toBe(400);
  });

  it('rejects negative version', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/demo/-1`);
    expect(res.status).toBe(400);
  });

  it('returns empty iterations for nonexistent project', async () => {
    const port = await startOnEphemeralPort(server);

    const res = await fetch(`http://localhost:${port}/api/liminal/gallery/nonexistent`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.iterations).toEqual([]);
  });
});
