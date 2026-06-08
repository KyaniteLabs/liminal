import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Gallery } from '../../../src/gallery/Gallery.js';
import { SinterFS } from '../../../src/fs/SinterFS.js';
import { LoopPersistence } from '../../../src/core/LoopPersistence.js';

describe('LoopPersistence', () => {
  let galleryDir: string;
  let projectRoot: string;
  let gallery: Gallery;
  let fs: SinterFS;

  beforeEach(() => {
    galleryDir = mkdtempSync(join(tmpdir(), 'sinter-gallery-test-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'sinter-fs-test-'));
    gallery = new Gallery(galleryDir);
    fs = SinterFS.open(projectRoot);
  });

  const galleryVersionPath = (project: string, version: number): string => {
    const dateStr = new Date().toISOString().split('T')[0];
    return join(galleryDir, `${dateStr}--${project}`, `v${version}.js`);
  };

  const validP5Code = `let particles = [];
function setup() {
  createCanvas(400, 400);
  colorMode(HSB, 360, 100, 100, 1);
  for (let i = 0; i < 40; i++) {
    particles.push({ x: random(width), y: random(height), hue: random(360), speed: random(0.5, 2) });
  }
}
function draw() {
  background(220, 20, 8, 0.15);
  for (const p of particles) {
    stroke(p.hue, 80, 95, 0.7);
    line(width / 2, height / 2, p.x, p.y);
    p.x = (p.x + cos(frameCount * 0.01 + p.speed) + width) % width;
    p.y = (p.y + sin(frameCount * 0.01 + p.speed) + height) % height;
  }
}`;

  afterEach(() => {
    fs.close();
    rmSync(galleryDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('saveIteration with SinterFS — writes artifact AND gallery file', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, 'const x = 1;');

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(existsSync(join(projectRoot, '.sinter', 'objects'))).toBe(true);
  });

  it('saveIteration with SinterFS — writes refs at gallery/{project}/v{N} and gallery/{project}/latest', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, 'const x = 1;');

    const versionRef = fs.readRef('gallery/my-project/v1');
    const latestRef = fs.readRef('gallery/my-project/latest');
    expect(versionRef).not.toBeNull();
    expect(latestRef).not.toBeNull();
    expect(versionRef?.uri).toBe(latestRef?.uri);
  });

  it('saveIteration with SinterFS — artifact content matches code', async () => {
    const code = 'function draw() { circle(50, 50, 20); }';
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, fs);
    await persistence.saveIteration(1, code);

    const ref = fs.readRef('gallery/my-project/v1')!;
    const content = fs.readArtifact(ref);
    expect(content?.toString('utf-8')).toBe(code);
  });

  it('saveIteration without SinterFS — works exactly as before (backward compat)', async () => {
    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any);
    await persistence.saveIteration(1, 'const x = 1;');

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(fs.readRef('gallery/my-project/v1')).toBeNull();
  });

  it('saveIteration rejects syntax-broken domain code before writing a gallery version', async () => {
    const persistence = new LoopPersistence(
      gallery,
      { project: 'my-project', mode: 'p5', collabDomain: 'p5', tolerateErrors: false } as any,
      fs,
    );
    const brokenCode = `function setup() {
  createCanvas(400, 400);
  colorMode(HSB, 360, 100, 100, 1);
  const broken = ;
}
function draw() {
  background(0);
  circle(width / 2, height / 2, 120);
}`;

    await expect(persistence.saveIteration(1, brokenCode)).rejects.toThrow(/invalid JavaScript syntax|Gallery version validation failed/);
    expect(existsSync(galleryVersionPath('my-project', 1))).toBe(false);
    expect(fs.readRef('gallery/my-project/v1')).toBeNull();
  });

  it('saveIteration rejects guaranteed runtime throws before writing a gallery version', async () => {
    const persistence = new LoopPersistence(
      gallery,
      { project: 'my-project', mode: 'p5', collabDomain: 'p5', tolerateErrors: false } as any,
      fs,
    );
    const throwingCode = validP5Code.replace(
      'background(220, 20, 8, 0.15);',
      'throw new Error("generated sketch exploded before drawing");\n  background(220, 20, 8, 0.15);',
    );

    await expect(persistence.saveIteration(1, throwingCode)).rejects.toThrow(/explicit throw|Gallery version validation failed/);
    expect(existsSync(galleryVersionPath('my-project', 1))).toBe(false);
    expect(fs.readRef('gallery/my-project/v1')).toBeNull();
  });

  it('saveIteration validates and persists valid domain code', async () => {
    const persistence = new LoopPersistence(
      gallery,
      { project: 'my-project', mode: 'p5', collabDomain: 'p5', tolerateErrors: false } as any,
      fs,
    );

    await persistence.saveIteration(1, validP5Code);

    expect(readFileSync(galleryVersionPath('my-project', 1), 'utf-8')).toBe(validP5Code);
    expect(fs.readRef('gallery/my-project/v1')).toMatchObject({ kind: 'gallery-version' });
  });

  it('saveIteration SinterFS error — Gallery still succeeds when SinterFS throws', async () => {
    const brokenFs = {
      writeArtifact: () => {
        throw new Error('disk full');
      },
      writeRef: () => {
        throw new Error('disk full');
      },
    } as unknown as SinterFS;

    const persistence = new LoopPersistence(gallery, { project: 'my-project' } as any, brokenFs);
    await expect(persistence.saveIteration(1, 'const x = 1;')).resolves.not.toThrow();

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
  });

  it('saveIteration with SinterFS propagates gallery write failures when tolerateErrors is false', async () => {
    const blockedRoot = mkdtempSync(join(tmpdir(), 'sinter-blocked-gallery-test-'));
    const blockedGalleryPath = join(blockedRoot, 'not-a-directory');
    writeFileSync(blockedGalleryPath, 'blocking file');

    const blockedGallery = new Gallery(blockedGalleryPath);
    const persistence = new LoopPersistence(
      blockedGallery,
      { project: 'my-project', tolerateErrors: false } as any,
      fs,
    );

    try {
      await expect(persistence.saveIteration(1, 'const x = 1;')).rejects.toThrow();
    } finally {
      rmSync(blockedRoot, { recursive: true, force: true });
    }
  });

  it('saveMergeStep with SinterFS — writes artifact for merged code at iteration+1', async () => {
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
      expect(ref).toMatchObject({ kind: 'gallery-version' });
    });
  });

  it('saveMergeStep rejects invalid merged code before writing iteration+1', async () => {
    const { ContextAccumulation } = await import('../../../src/core/ContextAccumulation.js');

    await ContextAccumulation.runWithContext(async () => {
      const persistence = new LoopPersistence(
        gallery,
        { project: 'my-project', mergeEveryN: 2, mode: 'p5', collabDomain: 'p5', tolerateErrors: false } as any,
        fs,
      );
      const setupSource = validP5Code;
      const throwingDraw = validP5Code.replace(
        'background(220, 20, 8, 0.15);',
        'throw new Error("merge output cannot render");\n  background(220, 20, 8, 0.15);',
      );

      ContextAccumulation.save({ iteration: 1, code: setupSource, prompt: '', usedPrompt: '', evaluation: { score: 0.5, issues: [] }, timestamp: '' });
      ContextAccumulation.save({ iteration: 2, code: throwingDraw, prompt: '', usedPrompt: '', evaluation: { score: 0.6, issues: [] }, timestamp: '' });

      await expect(persistence.saveMergeStep(2)).rejects.toThrow(/explicit throw|Gallery version validation failed/);
      expect(existsSync(galleryVersionPath('my-project', 3))).toBe(false);
      expect(fs.readRef('gallery/my-project/v3')).toBeNull();
    });
  });
});
