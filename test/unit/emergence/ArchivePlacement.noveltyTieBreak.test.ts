import { describe, expect, it } from 'vitest';
import { ArchivePlacement } from '../../../src/emergence/ArchivePlacement';
import type {
  BehaviorDescriptor,
  EmergenceSignals,
  LineageRecord,
} from '../../../src/emergence/types';
import type { SinterObjectRef } from '../../../src/fs/types';

/**
 * B18 — the "quality-diversity" archive must let emergence/novelty influence what
 * is kept, not gate purely on qualityScore. A novel-but-slightly-lower-quality work
 * should earn a near-elite slot it would otherwise lose to a stale, low-novelty
 * occupant. This proves emergence is a real admission signal, not a discarded one.
 */
function descriptor(): BehaviorDescriptor {
  // All candidates share a cell so the tie-break path is exercised.
  return {
    values: [
      { axis: 'order-chaos', value: 0.55 },
      { axis: 'sparse-dense', value: 0.55 },
    ],
    source: 'test',
    extractedAt: new Date().toISOString(),
  };
}

function lineage(id: string): LineageRecord {
  return {
    artifactId: id,
    parentIds: [],
    provenance: 'fresh-generation',
    createdAt: new Date().toISOString(),
  };
}

function ref(id: string): SinterObjectRef {
  return { uri: `sinter://artifact/${id}`, kind: 'generated-code' };
}

function signals(novelty: number): EmergenceSignals {
  return {
    novelty,
    structure: 0.5,
    temporalRichness: 0.5,
    perturbationResilience: 0.5,
    fertility: 0.5,
    aesthetic: 0.5,
  };
}

function place(
  archive: ArchivePlacement,
  id: string,
  qualityScore: number,
  novelty: number,
) {
  return archive.place({
    artifactRef: ref(id),
    descriptor: descriptor(),
    lineage: lineage(id),
    qualityScore,
    signals: signals(novelty),
  });
}

describe('ArchivePlacement novelty tie-break (B18)', () => {
  it('admits a more-novel candidate that ties on quality with the lowest near-elite', () => {
    // nearEliteCapacity 2: fill the cell's elite + 2 near-elites with stale (low-novelty) work.
    const archive = new ArchivePlacement({ nearEliteCapacity: 2 });
    place(archive, 'elite', 0.9, 0.1);
    place(archive, 'stale-a', 0.8, 0.1);
    place(archive, 'stale-b', 0.7, 0.1); // weakest near-elite: q=0.7, novelty=0.1

    // Candidate ties on quality (0.7) but is far more novel. Pure-quality gate would
    // REJECT it (strictly-greater requirement); novelty tie-break must admit it.
    const result = place(archive, 'novel', 0.7, 0.95);

    expect(result.accepted).toBe(true);
    expect(result.outcome).toBe('near-elite');
    expect(result.displaced?.id).toBe(ref('stale-b').uri);

    const cell = archive.getCell(result.cellId)!;
    const ids = cell.nearElites.map((e) => e.id);
    expect(ids).toContain(ref('novel').uri);
    expect(ids).not.toContain(ref('stale-b').uri);
  });

  it('does NOT admit a more-novel candidate that is well below the quality margin', () => {
    const archive = new ArchivePlacement({ nearEliteCapacity: 2 });
    place(archive, 'elite', 0.9, 0.1);
    place(archive, 'stale-a', 0.85, 0.1);
    place(archive, 'stale-b', 0.8, 0.1); // weakest near-elite q=0.8

    // Very novel but quality 0.5 is far below the weakest near-elite (0.8) — beyond margin.
    const result = place(archive, 'lowq-novel', 0.5, 0.99);
    expect(result.accepted).toBe(false);
    expect(result.outcome).toBe('rejected');
  });

  it('does NOT admit a quality-tied candidate that is not more novel (no free pass)', () => {
    const archive = new ArchivePlacement({ nearEliteCapacity: 2 });
    place(archive, 'elite', 0.9, 0.5);
    place(archive, 'stale-a', 0.8, 0.5);
    place(archive, 'stale-b', 0.7, 0.5);

    // Ties on quality (0.7) and same novelty (0.5) — no diversity gain, must reject.
    const result = place(archive, 'dup', 0.7, 0.5);
    expect(result.accepted).toBe(false);
    expect(result.outcome).toBe('rejected');
  });
});
