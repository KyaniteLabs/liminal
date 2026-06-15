import { describe, expect, it, beforeEach } from 'vitest';
import { QualityArchive, type ArchiveEntry } from '../../../src/learning/QualityArchive';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * H1 — archive admission must not persist a fabricated-confidence fallback score
 * as a real exemplar. When the evaluator is OFFLINE the keyword/regex fallback
 * readily produces 0.65–0.8 with confidence 0; that score must be REJECTED even
 * though it clears the 0.65 quality bar. Honest provenance (confidence > 0 and a
 * non-degraded failureClass) is the second gate, in addition to the score.
 */
function entry(overrides: Partial<ArchiveEntry>): ArchiveEntry {
  return {
    id: `e_${Math.random().toString(36).slice(2)}`,
    domain: 'p5',
    prompt: 'prompt',
    output: `output ${Math.random()}`,
    qualityScore: 0.7,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('QualityArchive.add — confidence/failureClass honesty gate (H1)', () => {
  let archive: QualityArchive;
  let path: string;

  beforeEach(() => {
    path = join(mkdtempSync(join(tmpdir(), 'qa-honesty-')), 'archive.json');
    archive = new QualityArchive({ path });
  });

  it('rejects a zero-confidence offline-fallback entry even at score 0.7', async () => {
    await archive.add(entry({ id: 'fab', qualityScore: 0.7, confidence: 0, failureClass: 'other' as never }));
    expect(archive.getById('fab')).toBeUndefined();
    expect(archive.getAll('p5')).toHaveLength(0);
  });

  it('rejects a scorer-degraded entry even at score 0.78', async () => {
    await archive.add(entry({ id: 'deg', qualityScore: 0.78, confidence: 0, failureClass: 'scorer' }));
    expect(archive.getById('deg')).toBeUndefined();
  });

  it('admits an honest entry (confidence > 0, failureClass none) and persists provenance on the entry', async () => {
    await archive.add(entry({ id: 'real', qualityScore: 0.7, confidence: 0.9, failureClass: 'none' }));
    const stored = archive.getById('real');
    expect(stored?.qualityScore).toBe(0.7);
    expect(stored?.confidence).toBe(0.9);
    expect(stored?.failureClass).toBe('none');
  });

  it('admits a render-measured entry (deterministic real signal)', async () => {
    await archive.add(entry({ id: 'rnd', qualityScore: 0.72, confidence: 1, failureClass: 'render' }));
    expect(archive.getById('rnd')?.qualityScore).toBe(0.72);
  });

  it('admits a legacy entry with no provenance fields (back-compat, absence = trusted)', async () => {
    await archive.add(entry({ id: 'legacy', qualityScore: 0.7 }));
    expect(archive.getById('legacy')?.qualityScore).toBe(0.7);
  });

  it('a rejected dishonest entry is not persisted across reload', async () => {
    await archive.add(entry({ id: 'fab2', qualityScore: 0.75, confidence: 0, failureClass: 'infra' }));
    const fresh = new QualityArchive({ path });
    await fresh.load();
    expect(fresh.getById('fab2')).toBeUndefined();
  });
});
