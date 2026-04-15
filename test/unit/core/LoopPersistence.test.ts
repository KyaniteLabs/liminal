import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Gallery } from '../../../src/gallery/Gallery.js';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { LoopPersistence } from '../../../src/core/LoopPersistence.js';

describe('LoopPersistence', () => {
  let galleryDir: string;
  let projectRoot: string;
  let gallery: Gallery;
  let fs: LiminalFS;

  beforeEach(() => {
    galleryDir = mkdtempSync(join(tmpdir(), 'liminal-gallery-test-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-fs-test-'));
    gallery = new Gallery(galleryDir);
    fs = LiminalFS.open(projectRoot);
  });

  afterEach(() => {
    fs.close();
    rmSync(galleryDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('saveIteration with LiminalFS — writes artifact AND gallery file', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, 'const x = 1;');

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(existsSync(join(projectRoot, '.liminal', 'objects'))).toBe(true);
  });

  it('saveIteration with LiminalFS — writes refs at gallery/{project}/v{N} and gallery/{project}/latest', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, 'const x = 1;');

    const versionRef = fs.readRef('gallery/my-project/v1');
    const latestRef = fs.readRef('gallery/my-project/latest');
    expect(versionRef).not.toBeNull();
    expect(latestRef).not.toBeNull();
    expect(versionRef?.uri).toBe(latestRef?.uri);
  });

  it('saveIteration with LiminalFS — artifact content matches code', async () => {
    const code = 'function draw() { circle(50, 50, 20); }';
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, code);

    const ref = fs.readRef('gallery/my-project/v1')!;
    const content = fs.readArtifact(ref);
    expect(content?.toString('utf-8')).toBe(code);
  });

  it('saveIteration without LiminalFS — works exactly as before (backward compat)', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any);
    await persistence.saveIteration(1, 'const x = 1;');

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(fs.readRef('gallery/my-project/v1')).toBeNull();
  });

  it('saveIteration LiminalFS error — Gallery still succeeds when LiminalFS throws', async () => {
    const brokenFs = {
      writeArtifact: () => {
        throw new Error('disk full');
      },
      writeRef: () => {
        throw new Error('disk full');
      },
    } as unknown as LiminalFS;

    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, brokenFs);
    await expect(persistence.saveIteration(1, 'const x = 1;')).resolves.not.toThrow();

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
  });

  it('saveMergeStep with LiminalFS — writes artifact for merged code at iteration+1', async () => {
    const { ContextAccumulation } = await import('../../../src/core/ContextAccumulation.js');

    await ContextAccumulation.runWithContext(async () => {
      const persistence = new LoopPersistence(
        gallery,
        { project: 'my-project', mergeEveryN: 2 } as any,
        fs,
      );

      await persistence.saveIteration(1, 'const a = 1;');
      await persistence.saveIteration(2, 'const b = 2;');

      // Populate ContextAccumulation so merge step has history to work with
      ContextAccumulation.save({ iteration: 1, code: 'const a = 1;', prompt: '', usedPrompt: '', evaluation: { score: 0.5, issues: [] }, timestamp: '' });
      ContextAccumulation.save({ iteration: 2, code: 'const b = 2;', prompt: '', usedPrompt: '', evaluation: { score: 0.6, issues: [] }, timestamp: '' });

      await persistence.saveMergeStep(2);

      const ref = fs.readRef('gallery/my-project/v3');
      expect(ref).not.toBeNull();
      expect(ref?.kind).toBe('gallery-version');
    });
  });
});
