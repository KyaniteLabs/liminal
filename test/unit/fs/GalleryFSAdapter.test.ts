import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Gallery } from '../../../src/gallery/Gallery.js';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { GalleryFSAdapter } from '../../../src/fs/adapters/GalleryFSAdapter.js';

describe('GalleryFSAdapter', () => {
  let galleryDir: string;
  let projectRoot: string;
  let gallery: Gallery;
  let fs: LiminalFS;
  let adapter: GalleryFSAdapter;

  beforeEach(() => {
    galleryDir = mkdtempSync(join(tmpdir(), 'liminal-gallery-test-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-fs-test-'));
    gallery = new Gallery(galleryDir);
    fs = LiminalFS.open(projectRoot);
    adapter = new GalleryFSAdapter(gallery, fs);
  });

  afterEach(() => {
    fs.close();
    rmSync(galleryDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('saveGalleryVersion — calls original Gallery (v1.js file exists in gallery dir)', async () => {
    await adapter.saveGalleryVersion('my-project', 1, 'console.log(1)');

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
  });

  it('saveGalleryVersion — returns LiminalObjectRef with liminal://artifact/ URI', async () => {
    const ref = await adapter.saveGalleryVersion('my-project', 1, 'console.log(1)');

    expect(ref.uri).toMatch(/^liminal:\/\/artifact\/[a-f0-9]{64}$/);
    expect(ref.kind).toBe('gallery-version');
    expect(ref.hash).toHaveLength(64);
  });

  it('saveGalleryVersion — artifact content matches original code', async () => {
    const code = 'const x = 42;';
    const ref = await adapter.saveGalleryVersion('my-project', 1, code);

    const content = fs.readArtifact(ref);
    expect(content?.toString('utf-8')).toBe(code);
  });

  it('saveGalleryVersion — writes ref at gallery/{project}/v{N}', async () => {
    const ref = await adapter.saveGalleryVersion('my-project', 1, 'console.log(1)');

    const readBack = fs.readRef('gallery/my-project/v1');
    expect(readBack).toEqual(ref);
  });

  it('saveGalleryVersion — writes ref at gallery/{project}/latest', async () => {
    const ref = await adapter.saveGalleryVersion('my-project', 1, 'console.log(1)');

    const latest = fs.readRef('gallery/my-project/latest');
    expect(latest).toEqual(ref);
  });

  it('saveGalleryVersion — latest ref updates when saving v2 after v1', async () => {
    const ref1 = await adapter.saveGalleryVersion('my-project', 1, 'console.log(1)');
    const ref2 = await adapter.saveGalleryVersion('my-project', 2, 'console.log(2)');

    const latest = fs.readRef('gallery/my-project/latest');
    expect(latest).toEqual(ref2);
    expect(latest).not.toEqual(ref1);
  });

  it('saveGalleryVersion — same code deduplicates (same hash for same content)', async () => {
    const code = 'const same = true;';
    const ref1 = await adapter.saveGalleryVersion('project-a', 1, code);
    const ref2 = await adapter.saveGalleryVersion('project-b', 1, code);

    expect(ref1.hash).toBe(ref2.hash);
  });

  it('getGallery — returns the original Gallery instance', () => {
    expect(adapter.getGallery()).toBe(gallery);
  });
});
