import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';

const mockGenerate = vi.hoisted(() =>
  vi.fn(async () => ({ musicCode: '$0 s0 ~ :seq(1,2)', visualCode: 'osc(10).rotate(0.5)' })),
);

vi.mock('../../../src/musicToVisual/generateMusicToVisual.js', () => ({
  generateMusicToVisual: mockGenerate,
}));

const { runOrganismMode } = await import('../../../src/core/OrganismLoop.js');

describe('OrganismLoop LiminalFS integration', () => {
  let projectRoot: string;
  let galleryDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-organism-test-'));
    galleryDir = mkdtempSync(join(tmpdir(), 'liminal-organism-gallery-'));
    originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    mockGenerate.mockResolvedValue({
      musicCode: '$0 s0 ~ :seq(1,2)',
      visualCode: 'osc(10).rotate(0.5)',
    });
  });

  afterEach(() => {
    mockGenerate.mockClear();
    process.cwd = originalCwd;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(galleryDir, { recursive: true, force: true });
  });

  it('writes organism artifact and gallery refs to LiminalFS', async () => {
    const fs = LiminalFS.open(projectRoot);

    const result = await runOrganismMode(
      'strudel + hydra organism',
      {
        maxIterations: 1,
        galleryDir,
        project: 'organism-project',
      } as any,
      Date.now(),
      fs,
    );

    expect(result.iterations).toBe(1);
    expect(result.completed).toBe(true);

    // Verify gallery refs were written
    const versionRef = fs.readRef('gallery/organism-project/v1');
    const latestRef = fs.readRef('gallery/organism-project/latest');
    expect(versionRef).not.toBeNull();
    expect(latestRef).not.toBeNull();
    expect(versionRef?.kind).toBe('organism');
    expect(versionRef?.uri).toBe(latestRef?.uri);

    // Verify artifact content is JSON with musicCode + visualCode
    const content = fs.readArtifact(versionRef!);
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!.toString('utf-8'));
    expect(parsed.type).toBe('organism');
    expect(parsed.musicCode).toBe('$0 s0 ~ :seq(1,2)');
    expect(parsed.visualCode).toBe('osc(10).rotate(0.5)');

    // Verify run record exists in EventStore
    const eventStore = fs.getProjectStore().getEventStore();
    const runs = eventStore.queryEvents({ type: 'run_record', limit: 10 });
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0].payload.status).toBe('completed');
    expect(runs[0].payload.project).toBe('organism-project');
    expect(runs[0].payload.metadata.mode).toBe('organism');

    fs.close();
  });

  it('falls back to plain gallery save when LiminalFS is not provided', async () => {
    const result = await runOrganismMode(
      'strudel + hydra organism',
      {
        maxIterations: 1,
        galleryDir,
        project: 'organism-project',
      } as any,
      Date.now(),
    );

    expect(result.iterations).toBe(1);
    expect(result.completed).toBe(true);

    // No LiminalFS means no refs
    const fs = LiminalFS.open(projectRoot);
    expect(fs.readRef('gallery/organism-project/v1')).toBeNull();
    fs.close();
  });
});
