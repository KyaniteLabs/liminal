import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SinterFS } from '../../../src/fs/SinterFS.js';
import { resolveSinterProjectRoot } from '../../../src/fs/projectRoot.js';
import { ArchiveEntriesFSAdapter } from '../../../src/fs/adapters/ArchiveEntries.js';
import { TasteLearningService } from '../../../src/learning/TasteLearningService.js';
import type { ArchiveEntry } from '../../../src/emergence/types.js';

function makeEntry(id: string, orderChaos: number, qualityScore: number): ArchiveEntry {
  return {
    id,
    artifactRef: { kind: 'generated-code', uri: `sinter://artifact/${id}`, hash: id },
    descriptor: {
      values: [
        { axis: 'order-chaos', value: orderChaos },
        { axis: 'sparse-dense', value: 1 - orderChaos },
      ],
      source: 'test',
      extractedAt: '2026-01-01T00:00:00.000Z',
    },
    lineage: {
      artifactId: id,
      parentIds: [],
      provenance: 'fresh-generation',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    qualityScore,
    signals: {
      novelty: 0.5,
      structure: 0.5,
      temporalRichness: 0.5,
      perturbationResilience: 0.5,
      fertility: 0.5,
      aesthetic: 0.5,
    },
    archivedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TasteLearningService', () => {
  let tmpRoot: string;
  let savedRoot: string | undefined;
  let sinterFs: SinterFS;

  beforeEach(() => {
    savedRoot = process.env.SINTER_PROJECT_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), 'taste-learning-service-test-'));
    process.env.SINTER_PROJECT_ROOT = tmpRoot;
    sinterFs = SinterFS.open(resolveSinterProjectRoot());
  });

  afterEach(() => {
    sinterFs.close();
    if (savedRoot !== undefined) process.env.SINTER_PROJECT_ROOT = savedRoot;
    else delete process.env.SINTER_PROJECT_ROOT;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('records a preference event in project-local preferences and SinterFS refs', async () => {
    const service = new TasteLearningService(sinterFs);

    const result = await service.recordPreference({
      action: 'pin',
      artifactId: 'artifact-a',
      sessionId: 'session-a',
    });

    expect(result.persisted).toBe(true);
    expect(result.record).toMatchObject({
      action: 'pin',
      artifactId: 'artifact-a',
      sessionId: 'session-a',
    });

    const preferenceDir = join(tmpRoot, '.sinter', 'preferences');
    expect(existsSync(preferenceDir)).toBe(true);
    expect(readdirSync(preferenceDir).filter(file => file.endsWith('.json'))).toHaveLength(1);
    expect(sinterFs.listRefs('preference').some(ref => ref.includes('artifact-a/pin'))).toBe(true);
  });

  it('trains and reloads latest taste weights from persisted archive plus preference events', async () => {
    const archive = new ArchiveEntriesFSAdapter(sinterFs);
    archive.writeArchiveEntry(makeEntry('liked', 0.9, 0.8));
    archive.writeArchiveEntry(makeEntry('rejected', 0.1, 0.4));

    const service = new TasteLearningService(sinterFs);
    await service.recordPreference({ action: 'pin', artifactId: 'liked', sessionId: 'session-a' });
    await service.recordPreference({ action: 'reject', artifactId: 'rejected', sessionId: 'session-a' });

    const summary = await service.trainFromProject();

    expect(summary).toMatchObject({
      archiveEntryCount: 2,
      preferenceEventCount: 2,
      persisted: true,
    });
    expect(summary.pairCount).toBeGreaterThan(0);
    expect(summary.weights?.pairCount).toBe(summary.pairCount);
    expect(sinterFs.readRef('taste/model/latest')).toMatchObject({ kind: 'taste-model' });

    const loaded = service.loadLatestModel();
    expect(loaded).toMatchObject({
      pairCount: summary.pairCount,
      trainingAgreement: summary.weights?.trainingAgreement,
    });
  });
});
