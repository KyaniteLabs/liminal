import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SeedArchive } from '../../../src/gallery/SeedArchive.js';
import { SinterFS } from '../../../src/fs/SinterFS.js';
import { SeedFSAdapter } from '../../../src/fs/adapters/SeedFSAdapter.js';

describe('SeedFSAdapter', () => {
  let archiveDir: string;
  let projectRoot: string;
  let archive: SeedArchive;
  let fs: SinterFS;
  let adapter: SeedFSAdapter;

  beforeEach(() => {
    archiveDir = mkdtempSync(join(tmpdir(), 'liminal-seed-test-'));
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-fs-test-'));
    archive = new SeedArchive(archiveDir);
    fs = SinterFS.open(projectRoot);
    adapter = new SeedFSAdapter(archive, fs);
  });

  afterEach(() => {
    fs.close();
    rmSync(archiveDir, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('saveSeed — calls original SeedArchive ({seed}.json file exists in archive dir)', async () => {
    await adapter.saveSeed('seed-abc', { score: 0.8 });

    const seedData = await archive.loadSeed('seed-abc');
    expect(seedData).not.toBeNull();
    expect(seedData?.seed).toBe('seed-abc');
  });

  it('saveSeed — returns SinterObjectRef with liminal://artifact/ URI', async () => {
    const ref = await adapter.saveSeed('seed-xyz', {});

    expect(ref.uri).toMatch(/^liminal:\/\/artifact\/[a-f0-9]{64}$/);
    expect(ref.kind).toBe('seed');
    expect(ref.hash).toHaveLength(64);
  });

  it('saveSeed — artifact content contains the seed string', async () => {
    const ref = await adapter.saveSeed('seed-content', {});

    const content = fs.readArtifact(ref);
    expect(content?.toString('utf-8')).toContain('seed-content');
  });

  it('saveSeed — writes ref at seed/{seedId}', async () => {
    const ref = await adapter.saveSeed('seed-ref', {});

    const readBack = fs.readRef('seed/seed-ref');
    expect(readBack).toEqual(ref);
  });

  it('saveSeed — ref can be read back via fs.readRef()', async () => {
    const ref = await adapter.saveSeed('seed-roundtrip', { tag: 'test' });

    const readBack = fs.readRef('seed/seed-roundtrip');
    expect(readBack?.uri).toBe(ref.uri);
    expect(readBack?.hash).toBe(ref.hash);
    expect(readBack?.kind).toBe('seed');
  });

  it('saveSeed — preserves metadata in artifact content', async () => {
    const metadata = { tag: 'generative', score: 0.95 };
    const ref = await adapter.saveSeed('seed-meta', metadata);

    const content = fs.readArtifact(ref);
    const parsed = JSON.parse(content?.toString('utf-8') ?? '{}');
    expect(parsed.seed).toBe('seed-meta');
    expect(parsed.tag).toBe('generative');
    expect(parsed.score).toBe(0.95);
  });

  it('getArchive — returns the original SeedArchive instance', () => {
    expect(adapter.getArchive()).toBe(archive);
  });
});
