/**
 * Compost Mill — barrel exports.
 */

// Types
export type {
  CompostConfig,
  DigestSchedule,
  LLMProviderConfig,
  FragmentLayer,
  FragmentMetadata,
  CompostFragment,
  FragmentScore,
  Seed,
  SoupState,
  CollisionResult,
  RawByteData,
  ExtractionResult,
  DigestStats,
  DigestResult,
  MillStatus,
  CollisionPair,
} from './types.js';

// Defaults
export { DEFAULT_CONFIG, mergeConfig } from './defaults.js';


// Core
export { CompostHeap } from './CompostHeap.js';
export { CompostShredder } from './CompostShredder.js';
export { FragmentScorer } from './FragmentScorer.js';
export { CollisionEngine } from './CollisionEngine.js';
export { SeedBank, type EmbeddedSeed } from './SeedBank.js';
export { DigestGenerator } from './DigestGenerator.js';
export { CompostMill } from './CompostMill.js';
export { CompostSoup } from './CompostSoup.js';
export { SoupStateManager } from './SoupStateManager.js';

// Extraction
export { MetadataExtractor } from './MetadataExtractor.js';
export { RawByteProcessor } from './RawByteProcessor.js';
export { SemanticExtractor, type LLMClientLike } from './SemanticExtractor.js';

// Monitoring
export { HeapMonitor } from './HeapMonitor.js';
export { DigestScheduler } from './DigestScheduler.js';

// Event-sourced history (SQLite)
export { EventStore } from './EventStore.js';
export type {
  EventType,
  CompostEvent,
  Snapshot,
  Branch,
  UndoResult,
  TimelineEntry,
  EventStoreConfig,
} from './EventStore.js';
export { AssetStore, type StoredAsset } from './AssetStore.js';
export { ProjectStore } from './ProjectStore.js';
export type { ProjectStoreConfig, ProjectInitResult, FormattedTimeline } from './ProjectStore.js';

// CLI
export { parseArgs, execute } from './cli.js';
export type { CLIAction } from './cli.js';

// Model Router
export {
  ModelRouter,
  sampleBeta,
  type Task,
  type TaskType,
  type ModelResponse,
  type ModelPerformanceRecord,
  type BetaDistribution,
  type BanditArm,
  type ThompsonConfig,
} from './ModelRouter.js';

// Phase 15 — Motif indexing & rehydration
export { MotifIndexer } from './MotifIndexer.js';
export type { MotifIndexerConfig, MotifIndexResult, MotifEntry } from './MotifIndexer.js';
export { CompostRehydrator } from './CompostRehydrator.js';
export type { CompostRehydratorConfig, RehydratedCandidate } from './CompostRehydrator.js';

// Integration bridges
export { FragmentArchiveBridge } from './integration/FragmentArchiveBridge.js';
export { SwarmBridge } from './integration/SwarmBridge.js';
