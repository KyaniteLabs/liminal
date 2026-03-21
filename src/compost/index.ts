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
  SemanticInput,
  CollisionPair,
  DigestInputs,
} from './types.js';

// Defaults
export { DEFAULT_CONFIG, mergeConfig } from './defaults.js';
export type { UserCompostConfig } from './defaults.js';

// Core
export { CompostHeap } from './CompostHeap.js';
export { CompostShredder } from './CompostShredder.js';
export { FragmentScorer } from './FragmentScorer.js';
export { CollisionEngine } from './CollisionEngine.js';
export { SeedBank } from './SeedBank.js';
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

// CLI
export { parseArgs, execute } from './cli.js';
export type { CLIAction } from './cli.js';

// Integration bridges
export { FragmentArchiveBridge } from './integration/FragmentArchiveBridge.js';
export { SwarmBridge } from './integration/SwarmBridge.js';
