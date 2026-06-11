// @ts-expect-error — plain .mjs helper shared by quality render scripts.
import { findRevideoArtifact, looksLikeRevideoArtifact, revideoRenderReadiness } from '../../../scripts/quality/revideo-render.mjs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('revideo quality-render helper', () => {
  it('finds the fixed proof revideo artifact without guessing other domains', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'p5.js'), 'function setup() {}');
    writeFileSync(join(dir, 'revideo.tsx'), revideoScene());

    expect(findRevideoArtifact(dir)).toBe(join(dir, 'revideo.tsx'));
  });

  it('detects Revideo source by file type and scene imports', () => {
    expect(looksLikeRevideoArtifact(revideoScene(), 'v3.tsx')).toBe(true);
    expect(looksLikeRevideoArtifact('function setup() { createCanvas(100, 100); }', 'v3.js')).toBe(false);
  });

  it('reports readiness as an explicit ok/reason contract', () => {
    const readiness = revideoRenderReadiness();

    expect(typeof readiness.ok).toBe('boolean');
    expect(readiness.reason).toMatch(/ready|not installed|ffmpeg|dist render helper/);
  });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'revideo-render-helper-'));
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function revideoScene(): string {
  return "import { makeScene2D } from '@revideo/2d';\nexport default makeScene2D(function* (view) { view.fill('#000'); });";
}
