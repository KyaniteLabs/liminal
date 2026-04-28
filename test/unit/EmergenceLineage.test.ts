import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LineageTracker } from '../../src/emergence/LineageTracker.js';
import { PreferenceEventLogger } from '../../src/learning/PreferenceEventLogger.js';

// ── LineageTracker ──

describe('LineageTracker', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `liminal-test-lineage-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('records a fresh-generation lineage entry', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const record = await tracker.record({
      provenance: 'fresh-generation',
      seed: 'test-seed-123',
    });

    expect(record.artifactId).toBeTruthy();
    expect(record.provenance).toBe('fresh-generation');
    expect(record.parentIds).toEqual([]);
    expect(record.seed).toBe('test-seed-123');
    expect(record.createdAt).toBeTruthy();
  });

  it('records a remix with parent IDs', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const parent = await tracker.record({ provenance: 'fresh-generation' });
    const child = await tracker.record({
      provenance: 'remix',
      parentIds: [parent.artifactId],
      runParams: { temperature: 0.8 },
    });

    expect(child.parentIds).toEqual([parent.artifactId]);
    expect(child.provenance).toBe('remix');
    expect(child.params).toEqual({ temperature: 0.8 });
  });

  it('retrieves a record by artifact ID', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const record = await tracker.record({ provenance: 'fresh-generation', artifactId: 'lookup-test' });
    const retrieved = await tracker.get('lookup-test');

    expect(retrieved!.artifactId).toBe('lookup-test');
  });

  it('traverses ancestry chain', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const root = await tracker.record({ provenance: 'fresh-generation', artifactId: 'root' });
    const mid = await tracker.record({ provenance: 'remix', parentIds: [root.artifactId], artifactId: 'mid' });
    await tracker.record({ provenance: 'branch', parentIds: [mid.artifactId], artifactId: 'leaf' });

    const ancestry = await tracker.getAncestry('leaf');
    const ids = ancestry.map(r => r.artifactId);
    expect(ids).toContain('leaf');
    expect(ids).toContain('mid');
    expect(ids).toContain('root');
  });

  it('computes lineage depth', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const root = await tracker.record({ provenance: 'fresh-generation', artifactId: 'depth-root' });
    const child = await tracker.record({ provenance: 'remix', parentIds: [root.artifactId], artifactId: 'depth-child' });
    const grandchild = await tracker.record({ provenance: 'mutation', parentIds: [child.artifactId], artifactId: 'depth-grandchild' });

    expect(await tracker.getDepth('depth-root')).toBe(0);
    expect(await tracker.getDepth('depth-child')).toBe(1);
    expect(await tracker.getDepth('depth-grandchild')).toBe(2);
  });

  it('finds descendants', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    const root = await tracker.record({ provenance: 'fresh-generation', artifactId: 'desc-root' });
    await tracker.record({ provenance: 'remix', parentIds: [root.artifactId], artifactId: 'desc-child-a' });
    await tracker.record({ provenance: 'branch', parentIds: [root.artifactId], artifactId: 'desc-child-b' });

    const descendants = await tracker.getDescendants('desc-root');
    const ids = descendants.map(d => d.artifactId);
    expect(ids).toContain('desc-child-a');
    expect(ids).toContain('desc-child-b');
    expect(ids).not.toContain('desc-root');
  });

  it('reports stats', async () => {
    const tracker = new LineageTracker({ lineageDir: tmpDir });
    await tracker.record({ provenance: 'fresh-generation' });
    await tracker.record({ provenance: 'remix', parentIds: ['some-id'] });

    const stats = await tracker.getStats();
    expect(stats.totalRecords).toBe(2);
    expect(stats.byProvenance['fresh-generation']).toBe(1);
    expect(stats.byProvenance['remix']).toBe(1);
    expect(stats.rootCount).toBe(1);
  });

  it('persists and reloads records', async () => {
    const dir = join(tmpDir, 'persist');
    const tracker1 = new LineageTracker({ lineageDir: dir });
    await tracker1.record({ provenance: 'fresh-generation', artifactId: 'persist-test' });

    const tracker2 = new LineageTracker({ lineageDir: dir });
    const record = await tracker2.get('persist-test');

    expect(record!.artifactId).toBe('persist-test');
  });
});

// ── PreferenceEventLogger ──

describe('PreferenceEventLogger', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `liminal-test-pref-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('logs a pin event', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    const record = await logger.log({ action: 'pin', artifactId: 'art-1' });

    expect(record.action).toBe('pin');
    expect(record.artifactId).toBe('art-1');
    expect(record.capturedAt).toBeTruthy();
  });

  it('logs a pairwise comparison', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    const record = await logger.log({
      action: 'pairwise-a',
      artifactId: 'art-a',
      comparedTo: 'art-b',
      sessionId: 'sess-1',
    });

    expect(record.action).toBe('pairwise-a');
    expect(record.comparedTo).toBe('art-b');
    expect(record.sessionId).toBe('sess-1');
  });

  it('filters events by action type', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    await logger.log({ action: 'pin', artifactId: 'a' });
    await logger.log({ action: 'favorite', artifactId: 'b' });
    await logger.log({ action: 'less-like-this', artifactId: 'c' });

    const pins = await logger.getEvents({ action: 'pin' });
    expect(pins).toHaveLength(1);
    expect(pins[0].artifactId).toBe('a');
  });

  it('filters events by session', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    await logger.log({ action: 'pin', artifactId: 'a', sessionId: 's1' });
    await logger.log({ action: 'pin', artifactId: 'b', sessionId: 's2' });

    const s1Events = await logger.getEvents({ sessionId: 's1' });
    expect(s1Events).toHaveLength(1);
    expect(s1Events[0].artifactId).toBe('a');
  });

  it('computes preference counts correctly', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    await logger.log({ action: 'pin', artifactId: 'a' });
    await logger.log({ action: 'pin', artifactId: 'a' });
    await logger.log({ action: 'less-like-this', artifactId: 'b' });

    const counts = await logger.getPreferenceCounts();
    expect(counts.get('a')).toEqual({ positive: 2, negative: 0 });
    expect(counts.get('b')).toEqual({ positive: 0, negative: 1 });
  });

  it('exports dataset with pairwise and feedback', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    await logger.log({ action: 'pairwise-a', artifactId: 'winner', comparedTo: 'loser' });
    await logger.log({ action: 'pin', artifactId: 'pinned' });
    await logger.log({ action: 'reject', artifactId: 'bad' });

    const dataset = await logger.exportDataset();
    expect(dataset.totalEvents).toBe(3);
    expect(dataset.pairwiseComparisons).toHaveLength(1);
    expect(dataset.pairwiseComparisons[0]).toEqual({ winner: 'winner', loser: 'loser' });
    expect(dataset.positiveFeedback).toHaveLength(1);
    expect(dataset.negativeFeedback).toHaveLength(1);
  });

  it('reports stats', async () => {
    const logger = new PreferenceEventLogger({ prefDir: tmpDir });
    await logger.log({ action: 'pin', artifactId: 'a' });
    await logger.log({ action: 'favorite', artifactId: 'a' });
    await logger.log({ action: 'pairwise-a', artifactId: 'b', comparedTo: 'c' });

    const stats = await logger.getStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.uniqueArtifacts).toBeGreaterThanOrEqual(2); // a, b at minimum (pairwise loser counted separately)
    expect(stats.pairwiseCount).toBe(1);
  });
});
