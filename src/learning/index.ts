/**
 * Learning module - Persistent quality archive with few-shot prompting
 */

export { ArchiveLearning } from './ArchiveLearning.js';
export type { ArchiveConfig, ArchivedItem } from './ArchiveLearning.js';

export { QualityArchive } from './QualityArchive.js';
export type {
  ArchiveQueryOptions,
  ArchiveEntry,
  QualityArchiveConfig,
} from './QualityArchive.js';

export { PreferenceEventLogger } from './PreferenceEventLogger.js';

// Phase 15 — Taste Learning
export { PreferenceDatasetBuilder } from './PreferenceDatasetBuilder.js';
export type { PreferencePair, PreferenceDataset, PreferenceDatasetBuilderConfig } from './PreferenceDatasetBuilder.js';
export { TasteModelTrainer } from './TasteModelTrainer.js';
export type { TasteModelWeights, TasteModelTrainerConfig } from './TasteModelTrainer.js';
export { TasteModelRuntime } from './TasteModelRuntime.js';
export type { RankedCandidate } from './TasteModelRuntime.js';
export { TasteModelEvaluator } from './TasteModelEvaluator.js';
export type { TasteEvaluationResult, TasteModelEvaluatorConfig } from './TasteModelEvaluator.js';
export { ReplayBiasPolicy } from './ReplayBiasPolicy.js';
export type { ReplayBiasConfig } from './ReplayBiasPolicy.js';
