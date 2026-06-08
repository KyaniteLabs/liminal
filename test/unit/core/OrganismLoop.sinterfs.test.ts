import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SinterFS } from '../../../src/fs/SinterFS.js';

const validMusicCode = `$: s("bd hh*2").gain(0.8).room(0.2)
$: s("cp").rarely(x => x.rev()).gain(0.6)
$: note("c3 eb3 g3 bb3").s("sawtooth").slow(2).gain(0.5)
bpm(120)`;

const validVisualCode = `osc(10, 0.1, 0.8)
  .color(1, 0.2, 0.5)
  .rotate(() => time * 0.1)
  .modulate(noise(3))
  .out(o0)
shape(4, 0.5)
  .repeat(3, 3)
  .out(o1)
render()`;

const mockGenerate = vi.hoisted(() => vi.fn());

vi.mock('../../../src/musicToVisual/generateMusicToVisual.js', () => ({
  generateMusicToVisual: mockGenerate,
}));

const { runOrganismMode } = await import('../../../src/core/OrganismLoop.js');

describe('OrganismLoop SinterFS integration', () => {
  let projectRoot: string;
  let galleryDir: string;
  let originalCwd: typeof process.cwd;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'sinter-organism-test-'));
    galleryDir = mkdtempSync(join(tmpdir(), 'sinter-organism-gallery-'));
    originalCwd = process.cwd;
    process.cwd = () => projectRoot;

    mockGenerate.mockResolvedValue({
      musicCode: validMusicCode,
      visualCode: validVisualCode,
    });
  });

  afterEach(() => {
    mockGenerate.mockClear();
    process.cwd = originalCwd;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(galleryDir, { recursive: true, force: true });
  });

  it('writes organism artifact and gallery refs to SinterFS', async () => {
    const fs = SinterFS.open(projectRoot);

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
    expect(parsed.musicCode).toBe(validMusicCode);
    expect(parsed.visualCode).toBe(validVisualCode);

    // Verify run record exists in EventStore
    const eventStore = fs.getProjectStore().getEventStore();
    const runs = eventStore.queryEvents({ type: 'run_record', limit: 10 });
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0].payload.status).toBe('completed');
    expect(runs[0].payload.project).toBe('organism-project');
    expect(runs[0].payload.metadata.mode).toBe('organism');

    fs.close();
  });

  it('falls back to plain gallery save when SinterFS is not provided', async () => {
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

    // No SinterFS means no refs
    const fs = SinterFS.open(projectRoot);
    expect(fs.readRef('gallery/organism-project/v1')).toBeNull();
    fs.close();
  });
});
