import { join } from 'node:path';
import { ArchiveEntriesFSAdapter } from '../fs/adapters/ArchiveEntries.js';
import { PreferenceEventsFSAdapter } from '../fs/adapters/PreferenceEvents.js';
import type { SinterFS } from '../fs/SinterFS.js';
import type { ArchiveEntry, PreferenceAction, PreferenceRecord } from '../emergence/types.js';
import type { SinterObjectRef } from '../fs/types.js';
import { PreferenceDatasetBuilder } from './PreferenceDatasetBuilder.js';
import { PreferenceEventLogger } from './PreferenceEventLogger.js';
import { TasteModelTrainer, type TasteModelWeights } from './TasteModelTrainer.js';

export interface TasteLearningRecordResult {
  record: PreferenceRecord;
  persisted: boolean;
  ref: SinterObjectRef;
}

export interface TasteTrainingSummary {
  archiveEntryCount: number;
  preferenceEventCount: number;
  pairCount: number;
  persisted: boolean;
  reason?: string;
  weights?: TasteModelWeights;
  ref?: SinterObjectRef;
}

export interface TasteLearningServiceConfig {
  prefDir?: string;
}

const MODEL_REF_NAME = 'taste/model/latest';

export class TasteLearningService {
  private readonly sinterFs: SinterFS;
  private readonly logger: PreferenceEventLogger;
  private readonly preferenceAdapter: PreferenceEventsFSAdapter;
  private readonly archiveAdapter: ArchiveEntriesFSAdapter;

  constructor(sinterFs: SinterFS, config: TasteLearningServiceConfig = {}) {
    this.sinterFs = sinterFs;
    this.logger = new PreferenceEventLogger({
      prefDir: config.prefDir ?? TasteLearningService.preferenceDirForProject(sinterFs),
    });
    this.preferenceAdapter = new PreferenceEventsFSAdapter(sinterFs);
    this.archiveAdapter = new ArchiveEntriesFSAdapter(sinterFs);
  }

  static preferenceDirForProject(sinterFs: SinterFS): string {
    return join(sinterFs.getProjectRoot(), '.sinter', 'preferences');
  }

  async recordPreference(params: {
    action: PreferenceAction;
    artifactId: string;
    comparedTo?: string;
    sessionId?: string;
  }): Promise<TasteLearningRecordResult> {
    const record = await this.logger.log(params);
    const ref = this.preferenceAdapter.writePreferenceEvent(record);
    return { record, ref, persisted: true };
  }

  async trainFromProject(): Promise<TasteTrainingSummary> {
    const archiveEntries = this.archiveAdapter.readAllArchiveEntries();
    const preferenceEvents = await this.logger.getEvents();
    const trainingEntries = this.attachPreferences(archiveEntries, preferenceEvents);
    const dataset = new PreferenceDatasetBuilder().build(trainingEntries);

    if (archiveEntries.length === 0) {
      return {
        archiveEntryCount: 0,
        preferenceEventCount: preferenceEvents.length,
        pairCount: 0,
        persisted: false,
        reason: 'no archive entries',
      };
    }

    if (dataset.pairs.length === 0) {
      return {
        archiveEntryCount: archiveEntries.length,
        preferenceEventCount: preferenceEvents.length,
        pairCount: 0,
        persisted: false,
        reason: 'no usable preference pairs',
      };
    }

    const weights = new TasteModelTrainer().train(dataset.pairs);
    const ref = this.persistModel(weights);
    return {
      archiveEntryCount: archiveEntries.length,
      preferenceEventCount: preferenceEvents.length,
      pairCount: dataset.pairs.length,
      persisted: true,
      weights,
      ref,
    };
  }

  loadLatestModel(): TasteModelWeights | null {
    const ref = this.sinterFs.readRef(MODEL_REF_NAME);
    if (!ref) return null;

    try {
      const content = this.sinterFs.readArtifact(ref);
      if (!content) return null;
      const parsed = JSON.parse(content.toString('utf-8')) as TasteModelWeights;
      return this.isTasteModelWeights(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private attachPreferences(
    entries: ArchiveEntry[],
    preferences: PreferenceRecord[],
  ): ArchiveEntry[] {
    const latestByArtifact = new Map<string, PreferenceRecord>();
    for (const record of preferences) {
      const prior = latestByArtifact.get(record.artifactId);
      if (!prior || new Date(record.capturedAt).getTime() >= new Date(prior.capturedAt).getTime()) {
        latestByArtifact.set(record.artifactId, record);
      }
    }

    return entries.map(entry => {
      const preference = latestByArtifact.get(entry.id);
      return preference ? { ...entry, preference } : entry;
    });
  }

  private persistModel(weights: TasteModelWeights): SinterObjectRef {
    const ref = this.sinterFs.writeArtifact({
      kind: 'taste-model',
      content: JSON.stringify(weights, null, 2),
      filename: 'taste-model-latest.json',
      metadata: {
        pairCount: weights.pairCount,
        trainingAgreement: weights.trainingAgreement,
        trainedAt: weights.trainedAt,
      },
    });
    this.sinterFs.writeRef(MODEL_REF_NAME, ref);
    return ref;
  }

  private isTasteModelWeights(value: unknown): value is TasteModelWeights {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<TasteModelWeights>;
    return Array.isArray(candidate.axisWeights)
      && typeof candidate.qualityWeight === 'number'
      && typeof candidate.trainedAt === 'string'
      && typeof candidate.pairCount === 'number'
      && typeof candidate.trainingAgreement === 'number';
  }
}
