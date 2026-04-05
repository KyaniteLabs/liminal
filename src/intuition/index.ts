/**
 * @module intuition — Intuition system for Liminal
 *
 * Provides compressed-experience-based quality signals:
 * - ThompsonSampler: Generic parameterized Thompson Sampling for any decision point
 * - DomainPrototype: Running quality centroids per creative domain
 * - IntuitionStrategy: ScoringStrategy plugin that adds 'intuition' dimension
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
