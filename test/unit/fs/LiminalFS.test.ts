import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';

describe('LiminalFS', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-fs-test-'));
    liminalFs = LiminalFS.open(tempDir);
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('open — creates .liminal/ dir and project.liminal SQLite DB', () => {
    expect(existsSync(join(tempDir, '.liminal'))).toBe(true);
    expect(existsSync(join(tempDir, '.liminal', 'project.liminal'))).toBe(true);
  });

  it('open — creates .liminal/objects/ dir', () => {
    expect(existsSync(join(tempDir, '.liminal', 'objects'))).toBe(true);
  });

  it('writeArtifact — stores content and returns ref with liminal://artifact/ URI', () => {
    const ref = liminalFs.writeArtifact({
      kind: 'generated-code',
      content: 'console.log("hello")',
      filename: 'test.js',
    });

    expect(ref.uri).toMatch(/^liminal:\/\/artifact\/[a-f0-9]{64}$/);
    expect(ref.kind).toBe('generated-code');
    expect(ref.hash).toHaveLength(64);
  });

  it('writeArtifact — same content written twice returns same hash (dedup)', () => {
    const input = {
      kind: 'generated-code' as const,
      content: 'same content',
      filename: 'same.js',
    };

    const ref1 = liminalFs.writeArtifact(input);
    const ref2 = liminalFs.writeArtifact(input);

    expect(ref1.hash).toBe(ref2.hash);
  });

  it('writeArtifact — metadata is recorded in event payload', () => {
    const metadata = { author: 'test', version: 1 };
    liminalFs.writeArtifact({
      kind: 'seed',
      content: 'seed content',
      filename: 'seed.txt',
      metadata,
    });

    const eventStore = liminalFs.getProjectStore().getEventStore();
    const events = eventStore.queryEvents({ type: 'config_change', limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].payload.action).toBe('artifact_write');
    expect(events[0].payload.metadata).toEqual(metadata);
  });

  it('readArtifact — returns original Buffer content', () => {
    const content = Buffer.from('binary data');
    const ref = liminalFs.writeArtifact({
      kind: 'asset',
      content,
      filename: 'data.bin',
    });

    const result = liminalFs.readArtifact(ref);
    expect(result).toEqual(content);
  });

  it('readArtifact — returns null for non-existent hash', () => {
    const result = liminalFs.readArtifact({
      uri: 'liminal://artifact/0000000000000000000000000000000000000000000000000000000000000000',
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      kind: 'asset',
    });

    expect(result).toBeNull();
  });

  it('recordRun — appends run_record event to EventStore', () => {
    liminalFs.recordRun({
      runId: 'run-123',
      prompt: 'test prompt',
      status: 'started',
    });

    const eventStore = liminalFs.getProjectStore().getEventStore();
    const events = eventStore.queryEvents({ type: 'run_record', limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('run_record');
  });

  it('recordRun — event payload matches input record fields', () => {
    const record = {
      runId: 'run-456',
      prompt: 'generate a circle',
      project: 'my-project',
      status: 'completed' as const,
      artifacts: [{ uri: 'liminal://artifact/abc', kind: 'generated-code' as const }],
      metadata: { score: 0.9 },
    };

    liminalFs.recordRun(record);

    const eventStore = liminalFs.getProjectStore().getEventStore();
    const events = eventStore.queryEvents({ type: 'run_record', limit: 1 });
    expect(events[0].payload.runId).toBe(record.runId);
    expect(events[0].payload.prompt).toBe(record.prompt);
    expect(events[0].payload.project).toBe(record.project);
    expect(events[0].payload.status).toBe(record.status);
    expect(events[0].payload.artifacts).toEqual(record.artifacts);
    expect(events[0].payload.metadata).toEqual(record.metadata);
  });

  it('getProjectRoot — returns the projectRoot passed to open()', () => {
    expect(liminalFs.getProjectRoot()).toBe(tempDir);
  });

  it('getProjectStore — returns the underlying ProjectStore instance', () => {
    const store = liminalFs.getProjectStore();
    expect(store).not.toBeNull();
    expect(typeof store.getEventStore).toBe('function');
  });

  it('close — does not throw', () => {
    expect(() => liminalFs.close()).not.toThrow();
  });

  it('writeRef — writes a ref and the file exists at .liminal/refs/<name>.json', () => {
    const ref = {
      uri: 'liminal://artifact/abc123',
      hash: 'abc123',
      kind: 'generated-code' as const,
    };
    liminalFs.writeRef('latest', ref);

    expect(existsSync(join(tempDir, '.liminal', 'refs', 'latest.json'))).toBe(true);
  });

  it('writeRef — can read the ref back with matching uri, hash, kind', () => {
    const ref = {
      uri: 'liminal://artifact/def456',
      hash: 'def456',
      kind: 'seed' as const,
      path: '/some/path',
    };
    liminalFs.writeRef('best-seed', ref);

    const result = liminalFs.readRef('best-seed');
    expect(result).toEqual(ref);
  });

  it('writeRef — throws on .. in name', () => {
    expect(() =>
      liminalFs.writeRef('../escape', { uri: 'liminal://artifact/x', kind: 'asset' }),
    ).toThrow('path traversal');
  });

  it('writeRef — throws on absolute path in name', () => {
    expect(() =>
      liminalFs.writeRef('/etc/passwd', { uri: 'liminal://artifact/x', kind: 'asset' }),
    ).toThrow('absolute paths');
  });

  it('writeRef — supports namespaced names with / (e.g., gallery/latest)', () => {
    const ref = {
      uri: 'liminal://artifact/gal123',
      hash: 'gal123',
      kind: 'gallery-version' as const,
    };
    liminalFs.writeRef('gallery/latest', ref);

    expect(existsSync(join(tempDir, '.liminal', 'refs', 'gallery', 'latest.json'))).toBe(true);
    expect(liminalFs.readRef('gallery/latest')).toEqual(ref);
  });

  it('writeRef — overwrites existing ref with same name', () => {
    liminalFs.writeRef('overwrite', { uri: 'liminal://artifact/v1', kind: 'asset' });
    liminalFs.writeRef('overwrite', { uri: 'liminal://artifact/v2', kind: 'asset' });

    const result = liminalFs.readRef('overwrite');
    expect(result?.uri).toBe('liminal://artifact/v2');
  });

  it('readRef — returns null for non-existent ref', () => {
    expect(liminalFs.readRef('does-not-exist')).toBeNull();
  });

  it('writeManifest — writes a manifest and the file exists at .liminal/manifests/<name>.json', () => {
    liminalFs.writeManifest('project', { name: 'Test', version: '1.0.0' });

    expect(existsSync(join(tempDir, '.liminal', 'manifests', 'project.json'))).toBe(true);
  });

  it('writeManifest — can read the manifest back with matching data', () => {
    const data = { name: 'MyProject', tags: ['creative', 'generative'] };
    liminalFs.writeManifest('tags', data);

    const result = liminalFs.readManifest('tags');
    expect(result).toEqual(data);
  });

  it('writeManifest — throws on .. in name', () => {
    expect(() => liminalFs.writeManifest('../escape', { data: 1 })).toThrow('path traversal');
  });

  it('writeManifest — throws on absolute path in name', () => {
    expect(() => liminalFs.writeManifest('/root', { data: 1 })).toThrow('absolute paths');
  });

  it('readManifest — returns null for non-existent manifest', () => {
    expect(liminalFs.readManifest('missing')).toBeNull();
  });
});
