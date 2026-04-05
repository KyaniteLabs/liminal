/**
 * @module intuition — Intuition system for Liminal
 *
 * Provides compressed-experience-based quality signals:
 * - ThompsonSampler: Generic parameterized Thompson Sampling for any decision point
 * - DomainPrototype: Running quality centroids per creative domain
 * - IntuitionStrategy: ScoringStrategy plugin that adds 'intuition' dimension
 * - IntuitionCache: Fast lookup for previously computed intuition assessments
 * - MemoryConsolidator: Compresses raw episodes into semantic patterns (L3→L2)
 *
 * Usage:
 *   import { IntuitionStrategy, ThompsonSampler, DomainPrototype } from '../intuition/index.js';
 */

export { ThompsonSampler } from './ThompsonSampler.js';
export type { ThompsonConfig, ArmState, SamplerState } from './ThompsonSampler.js';

export { DomainPrototype } from './DomainPrototype.js';
export type { DomainCentroid, PrototypeStore } from './DomainPrototype.js';

export { IntuitionStrategy } from './IntuitionStrategy.js';
export type { IntuitionConfig, IntuitionSignal, IntuitionAssessment } from './IntuitionStrategy.js';

export { IntuitionCache } from './IntuitionCache.js';
export type { CacheEntry, IntuitionCacheConfig, CacheStats, SerializedCache } from './IntuitionCache.js';

export { MemoryConsolidator } from './MemoryConsolidator.js';
export type { ConsolidationEpisode, ConsolidatedPattern, ConsolidationResult, ConsolidatorConfig } from './MemoryConsolidator.js';

export { DreamEngine } from './DreamEngine.js';
export type { DreamConcept, DreamOutput, DreamJournalEntry, DreamEngineConfig } from './DreamEngine.js';

export { SleepScheduler } from './SleepScheduler.js';
export type { SleepDepth, SleepScheduleConfig, SleepState, ActivitySample } from './SleepScheduler.js';

export { CreativeWorldModel } from './CreativeWorldModel.js';
export type { BehaviorVector, WorldObservation, QualityPrediction, WorldModelConfig, WorldModelState } from './CreativeWorldModel.js';
