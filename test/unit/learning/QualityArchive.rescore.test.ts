import { describe, expect, it, beforeEach } from 'vitest';
import { QualityArchive } from '../../../src/learning/QualityArchive';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

function entry(id: string, domain: string, qualityScore: number) {
  return {
    id,
    domain,
    prompt: `prompt for ${id}`,
    output: `output ${id}`,
    qualityScore,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

describe('QualityArchive.rescoreEntry', () => {
  let archive: QualityArchive;
  let path: string;

  beforeEach(async () => {
    path = join(mkdtempSync(join(tmpdir(), 'qa-rescore-')), 'archive.json');
    archive = new QualityArchive({ path });
    await archive.add(entry('a1', 'p5', 0.95));
    await archive.add(entry('a2', 'p5', 0.85));
    await archive.add(entry('a3', 'p5', 0.75));
  });

  it('updates the score, keeps prior in metadata, and re-sorts the bucket', async () => {
    const ok = await archive.rescoreEntry('a1', 0.78, 'banded-judge 2026-06-12');
    expect(ok).toBe(true);
    const all = archive.getAll('p5');
    expect(all.map((e) => e.id)).toEqual(['a2', 'a1', 'a3']); // 0.85, 0.78, 0.75
  });

  it('orders by fresh score after rescore', async () => {
    await archive.rescoreEntry('a1', 0.7, 'test');
    expect(archive.getAll('p5').map((e) => e.qualityScore)).toEqual([0.85, 0.75, 0.7]);
  });

  it('records provenance and prior score', async () => {
    await archive.rescoreEntry('a2', 0.6, 'banded-judge');
    const e = archive.getById('a2');
    expect(e?.qualityScore).toBe(0.6);
    const rescore = e?.metadata.rescore as { priorScore: number; provenance: string };
    expect(rescore.priorScore).toBe(0.85);
    expect(rescore.provenance).toBe('banded-judge');
  });

  it('persists across reload', async () => {
    await archive.rescoreEntry('a3', 0.5, 'test');
    const fresh = new QualityArchive({ path });
    await fresh.load();
    expect(fresh.getById('a3')?.qualityScore).toBe(0.5);
  });

  it('clamps out-of-range scores and returns false for unknown ids', async () => {
    await archive.rescoreEntry('a1', 1.7, 'test');
    expect(archive.getById('a1')?.qualityScore).toBe(1);
    expect(await archive.rescoreEntry('nope', 0.5, 'test')).toBe(false);
  });
});
