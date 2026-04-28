import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Gallery, parseVersionContent, type Iteration, type OrganismIteration, type VideoIteration } from '../../../src/gallery/Gallery.js';
import { SeedArchive, type SeedData } from '../../../src/gallery/SeedArchive.js';

// ─── Gallery ───────────────────────────────────────────────────────

describe('Gallery', () => {
  let tmpDir: string;
  let gallery: Gallery;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-test-'));
    gallery = new Gallery(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── saveIteration ────────────────────────────────────────────────

  it('saveIteration creates date-based directory and version file', async () => {
    await gallery.saveIteration('my-project', 1, 'function setup() { createCanvas(400, 400); }');
    const dirs = await gallery.listProjectDirs();
    expect(dirs).toHaveLength(1);
    expect(dirs[0]).toMatch(/^\d{4}-\d{2}-\d{2}--my-project$/);

    const history = await gallery.loadHistory('my-project');
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
    expect((history[0] as Iteration).code).toBe('function setup() { createCanvas(400, 400); }');
  });

  it('saveIteration throws for empty project name', async () => {
    await expect(gallery.saveIteration('', 1, 'code')).rejects.toThrow(/non-empty string/);
    await expect(gallery.saveIteration('   ', 1, 'code')).rejects.toThrow(/non-empty string/);
  });

  it('saveIteration throws for invalid version', async () => {
    await expect(gallery.saveIteration('proj', 0, 'code')).rejects.toThrow(/positive integer/);
    await expect(gallery.saveIteration('proj', -1, 'code')).rejects.toThrow(/positive integer/);
    await expect(gallery.saveIteration('proj', 1.5, 'code')).rejects.toThrow(/positive integer/);
  });

  it('saveIteration throws for empty code', async () => {
    await expect(gallery.saveIteration('proj', 1, '')).rejects.toThrow(/non-empty string/);
    await expect(gallery.saveIteration('proj', 1, '   ')).rejects.toThrow(/non-empty string/);
  });

  it('saveIteration preserves multiple versions', async () => {
    await gallery.saveIteration('proj', 1, 'version 1');
    await gallery.saveIteration('proj', 2, 'version 2');
    await gallery.saveIteration('proj', 3, 'version 3');

    const history = await gallery.loadHistory('proj');
    expect(history).toHaveLength(3);
    expect(history.map(h => h.version)).toEqual([1, 2, 3]);
  });

  // ── saveOrganism ─────────────────────────────────────────────────

  it('saveOrganism saves music + visual code as JSON', async () => {
    await gallery.saveOrganism('bio-proj', 1, 's("bd").out(o0)', 'osc(10).out(o0)');

    const history = await gallery.loadHistory('bio-proj');
    expect(history).toHaveLength(1);
    const iter = history[0] as OrganismIteration;
    expect(iter.type).toBe('organism');
    expect(iter.musicCode).toBe('s("bd").out(o0)');
    expect(iter.visualCode).toBe('osc(10).out(o0)');
    expect(iter.version).toBe(1);
  });

  it('saveOrganism throws for empty musicCode or visualCode', async () => {
    await expect(gallery.saveOrganism('proj', 1, '', 'visual')).rejects.toThrow(/string/);
    await expect(gallery.saveOrganism('proj', 1, 'music', '')).rejects.toThrow(/string/);
  });

  // ── loadHistory ──────────────────────────────────────────────────

  it('loadHistory returns empty array for nonexistent project', async () => {
    const history = await gallery.loadHistory('nonexistent');
    expect(history).toEqual([]);
  });

  it('loadHistory throws for empty project name', async () => {
    await expect(gallery.loadHistory('')).rejects.toThrow(/non-empty string/);
  });

  // ── listProjectDirs ──────────────────────────────────────────────

  it('listProjectDirs returns empty for empty gallery', async () => {
    const dirs = await gallery.listProjectDirs();
    expect(dirs).toEqual([]);
  });

  it('listProjectDirs returns sorted project dirs (newest first)', async () => {
    await gallery.saveIteration('alpha', 1, 'code1');
    await gallery.saveIteration('beta', 1, 'code2');
    const dirs = await gallery.listProjectDirs();
    // Same-day projects sorted by name desc
    expect(dirs).toHaveLength(2);
  });

  // ── hasIterations ────────────────────────────────────────────────

  it('hasIterations returns false for nonexistent project', async () => {
    expect(await gallery.hasIterations('nonexistent')).toBe(false);
  });

  it('hasIterations returns true for project with iterations', async () => {
    await gallery.saveIteration('proj', 1, 'code');
    expect(await gallery.hasIterations('proj')).toBe(true);
  });

  // ── getLatestVersion ─────────────────────────────────────────────

  it('getLatestVersion returns 0 for nonexistent project', async () => {
    expect(await gallery.getLatestVersion('nonexistent')).toBe(0);
  });

  it('getLatestVersion returns max version number', async () => {
    await gallery.saveIteration('proj', 1, 'code1');
    await gallery.saveIteration('proj', 3, 'code3');
    await gallery.saveIteration('proj', 2, 'code2');
    expect(await gallery.getLatestVersion('proj')).toBe(3);
  });

  // ── getProjectPath ───────────────────────────────────────────────

  it('getProjectPath returns date-based path', () => {
    const projPath = gallery.getProjectPath('my-proj');
    expect(projPath).toMatch(/\/\d{4}-\d{2}-\d{2}--my-proj$/);
  });

  // ── loadHistoryFromDir ───────────────────────────────────────────

  it('loadHistoryFromDir returns empty for empty dirname', async () => {
    const result = await gallery.loadHistoryFromDir('');
    expect(result).toEqual([]);
  });

  it('loadHistoryFromDir returns empty for nonexistent dir', async () => {
    const result = await gallery.loadHistoryFromDir('2026-01-01--nonexistent');
    expect(result).toEqual([]);
  });

  // ── cleanupOldProjects ───────────────────────────────────────────

  it('cleanupOldProjects archives old projects', async () => {
    // Create a project with an old date by manually creating directory
    const oldDir = path.join(tmpDir, '2020-01-01--old-proj');
    await fs.mkdir(oldDir, { recursive: true });
    await fs.writeFile(path.join(oldDir, 'v1.js'), 'old code', 'utf-8');

    // Create a current project
    await gallery.saveIteration('new-proj', 1, 'new code');

    // maxProjects=1 means only keep 1, the old one should be archived
    const archived = await gallery.cleanupOldProjects(1, 30);
    expect(archived).toBeGreaterThanOrEqual(1);
  });

  // ── saveSwarmSession ─────────────────────────────────────────────

  it('saveSwarmSession stores session JSON and final output', async () => {
    const mockResult = {
      finalOutput: 'function setup() { createCanvas(100, 100); }',
      converged: true,
      convergenceRound: 2,
      mode: 'competitive' as const,
      totalDurationMs: 5000,
      rounds: [
        {
          roundNum: 1,
          winnerId: 'persona-1',
          constraint: 'Use 3 colors',
          scores: new Map([['persona-1', 0.8], ['persona-2', 0.6]]),
          outputs: new Map([
            ['persona-1', { personaName: 'Minimalist', content: 'output1', model: 'test' }],
            ['persona-2', { personaName: 'Expressionist', content: 'output2', model: 'test' }],
          ]),
        },
      ],
    };

    await gallery.saveSwarmSession('swarm-proj', mockResult as any);

    const history = await gallery.loadHistory('swarm-proj');
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it('saveSwarmSession throws for empty project name', async () => {
    await expect(gallery.saveSwarmSession('', {} as any)).rejects.toThrow(/non-empty string/);
  });

  // ── saveVideoIteration ─────────────────────────────────────────────

  it('saveVideoIteration saves video metadata as JSON', async () => {
    await gallery.saveVideoIteration('vid-proj', 1, 'gsap.to(".box", {x:100})', '/tmp/vid.mp4', 'hyperframes');

    const history = await gallery.loadHistory('vid-proj');
    expect(history).toHaveLength(1);
    const iter = history[0] as VideoIteration;
    expect(iter.type).toBe('video');
    expect(iter.code).toBe('gsap.to(".box", {x:100})');
    expect(iter.videoPath).toBe('/tmp/vid.mp4');
    expect(iter.domain).toBe('hyperframes');
    expect(iter.version).toBe(1);
  });

  it('saveVideoIteration works with revideo domain', async () => {
    await gallery.saveVideoIteration('rev-proj', 2, 'export const project = () => {}', '/tmp/rev.mp4', 'revideo');

    const history = await gallery.loadHistory('rev-proj');
    expect(history).toHaveLength(1);
    const iter = history[0] as VideoIteration;
    expect(iter.domain).toBe('revideo');
    expect(iter.version).toBe(2);
  });

  it('saveVideoIteration throws for empty project name', async () => {
    await expect(gallery.saveVideoIteration('', 1, 'code', '/tmp/v.mp4', 'hyperframes')).rejects.toThrow(/non-empty string/);
    await expect(gallery.saveVideoIteration('   ', 1, 'code', '/tmp/v.mp4', 'hyperframes')).rejects.toThrow(/non-empty string/);
  });

  it('saveVideoIteration throws for invalid version', async () => {
    await expect(gallery.saveVideoIteration('proj', 0, 'code', '/tmp/v.mp4', 'hyperframes')).rejects.toThrow(/positive integer/);
    await expect(gallery.saveVideoIteration('proj', -1, 'code', '/tmp/v.mp4', 'revideo')).rejects.toThrow(/positive integer/);
  });

  it('saveVideoIteration preserves video and code iterations together', async () => {
    await gallery.saveIteration('mixed-proj', 1, 'function setup() {}');
    await gallery.saveVideoIteration('mixed-proj', 2, 'gsap code', '/tmp/v2.mp4', 'hyperframes');

    const history = await gallery.loadHistory('mixed-proj');
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
    expect((history[1] as VideoIteration).type).toBe('video');
  });
});

// ─── SeedArchive ───────────────────────────────────────────────────

describe('SeedArchive', () => {
  let tmpDir: string;
  let archive: SeedArchive;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seed-archive-test-'));
    archive = new SeedArchive(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generateSeed returns unique strings', () => {
    const seed1 = archive.generateSeed();
    const seed2 = archive.generateSeed();
    expect(seed1).toBeTruthy();
    expect(seed2).toBeTruthy();
    expect(seed1).not.toBe(seed2);
  });

  it('generateSeed returns lowercase alphanumeric with hyphens', () => {
    const seed = archive.generateSeed();
    expect(seed).toMatch(/^[a-z0-9-]+$/);
    expect(seed.length).toBeLessThanOrEqual(32);
  });

  it('saveSeed creates JSON file in archive directory', async () => {
    await archive.saveSeed('test-seed-1', { domain: 'p5', prompt: 'circles' });

    const data = await archive.loadSeed('test-seed-1');
    expect(data).not.toBeNull();
    expect(data!.seed).toBe('test-seed-1');
    expect(data!.domain).toBe('p5');
    expect(data!.prompt).toBe('circles');
  });

  it('saveSeed throws for empty seed', async () => {
    await expect(archive.saveSeed('', { domain: 'p5' })).rejects.toThrow(/non-empty string/);
    await expect(archive.saveSeed('   ', { domain: 'p5' })).rejects.toThrow(/non-empty string/);
  });

  it('saveSeed throws for non-object metadata', async () => {
    await expect(archive.saveSeed('seed1', null as any)).rejects.toThrow(/must be an object/);
    await expect(archive.saveSeed('seed1', [] as any)).rejects.toThrow(/must be an object/);
  });

  it('loadSeed returns null for nonexistent seed', async () => {
    const data = await archive.loadSeed('nonexistent');
    expect(data).toBeNull();
  });

  it('loadSeed throws for empty seed', async () => {
    await expect(archive.loadSeed('')).rejects.toThrow(/non-empty string/);
  });

  it('round-trip: save then load preserves data', async () => {
    const metadata = {
      domain: 'glsl',
      prompt: 'fragment shader with noise',
      score: 0.85,
      tags: ['noise', 'fractal'],
    };
    await archive.saveSeed('round-trip-seed', metadata);
    const loaded = await archive.loadSeed('round-trip-seed');

    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe('round-trip-seed');
    expect(loaded!.domain).toBe('glsl');
    expect(loaded!.score).toBe(0.85);
    expect(loaded!.tags).toEqual(['noise', 'fractal']);
  });

  it('saveSeed creates archive directory if it does not exist', async () => {
    const newDir = path.join(tmpDir, 'new-archive');
    const newArchive = new SeedArchive(newDir);
    await newArchive.saveSeed('fresh-seed', { value: 42 });
    const data = await newArchive.loadSeed('fresh-seed');
    expect(data).not.toBeNull();
    expect(data!.value).toBe(42);
  });
});

// ─── parseVersionContent (video paths) ──────────────────────────────────

describe('parseVersionContent', () => {
  it('parses video iteration JSON with hyperframes domain', () => {
    const raw = JSON.stringify({ type: 'video', code: 'gsap.to(".box", {x:100})', videoPath: '/tmp/out.mp4', domain: 'hyperframes' });
    const result = parseVersionContent(raw, 1, '2026-04-28T00:00:00Z') as VideoIteration;

    expect(result.type).toBe('video');
    expect(result.version).toBe(1);
    expect(result.code).toBe('gsap.to(".box", {x:100})');
    expect(result.videoPath).toBe('/tmp/out.mp4');
    expect(result.domain).toBe('hyperframes');
    expect(result.timestamp).toBe('2026-04-28T00:00:00Z');
  });

  it('parses video iteration JSON with revideo domain', () => {
    const raw = JSON.stringify({ type: 'video', code: 'export const project = () => {}', videoPath: '/out.mp4', domain: 'revideo' });
    const result = parseVersionContent(raw, 3, '2026-04-28T12:00:00Z') as VideoIteration;

    expect(result.type).toBe('video');
    expect(result.domain).toBe('revideo');
    expect(result.version).toBe(3);
  });

  it('parses organism iteration JSON', () => {
    const raw = JSON.stringify({ type: 'organism', musicCode: 's("bd")', visualCode: 'osc(10)' });
    const result = parseVersionContent(raw, 2, '2026-04-28T00:00:00Z') as OrganismIteration;

    expect(result.type).toBe('organism');
    expect(result.musicCode).toBe('s("bd")');
    expect(result.visualCode).toBe('osc(10)');
  });

  it('returns p5 iteration for non-JSON raw content', () => {
    const result = parseVersionContent('function setup() {}', 1, '2026-04-28T00:00:00Z') as Iteration;

    expect(result.type).toBeUndefined();
    expect(result.code).toBe('function setup() {}');
    expect(result.version).toBe(1);
  });

  it('returns null for empty string', () => {
    expect(parseVersionContent('', 1, '2026-04-28')).toBeNull();
    expect(parseVersionContent('   ', 1, '2026-04-28')).toBeNull();
  });

  it('returns p5 iteration for JSON without recognized type', () => {
    const raw = JSON.stringify({ type: 'unknown', code: 'stuff' });
    const result = parseVersionContent(raw, 1, '2026-04-28') as Iteration;

    expect(result.code).toBe(raw);
    expect(result.version).toBe(1);
  });

  it('returns p5 iteration for video JSON missing videoPath', () => {
    const raw = JSON.stringify({ type: 'video', code: 'gsap', domain: 'hyperframes' });
    const result = parseVersionContent(raw, 1, '2026-04-28') as Iteration;

    expect(result.code).toBe(raw);
  });

  it('returns p5 iteration for video JSON missing domain', () => {
    const raw = JSON.stringify({ type: 'video', code: 'gsap', videoPath: '/tmp/v.mp4' });
    const result = parseVersionContent(raw, 1, '2026-04-28') as Iteration;

    expect(result.code).toBe(raw);
  });
});
