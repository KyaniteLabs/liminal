/**
 * ProceduralTier — L2→L1 compression: patterns combination → automatic routine.
 *
 * When a Thompson sampler has high confidence in a domain:model:strategy combination,
 * and the world model predicts high quality for that domain, we can produce a
 * **procedural routine**: a pre-wired decision shortcut that skips
 * evaluation entirely.
 *
 * The hierarchy:
 *   L3 (Episodic) → specific outcomes → MemoryConsolidator → L2 (Semantic)
 *   L2 (Semantic) → repeated success → ProceduralTier → L1 (Procedural)
 *   L1 (Procedural) → automatic decisions → IntuitionEngine
 *
 * The "bicycle" of the the system: you no longer consciously think about
 * the balance — you just ride. ProceduralTier detects when
 * this is possible and creates the shortcut that can be applied
 * without evaluation.
 *
 * @module intuition/ProceduralTier
 */

import { ThompsonSampler } from './ThompsonSampler.js';
import { DomainPrototype } from './DomainPrototype.js';
import { CreativeWorldModel } from './CreativeWorldModel.js';
import type { BehaviorVector } from './CreativeWorldModel.js';
import type { ConsolidatedPattern } from './MemoryConsolidator.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Confidence level for a procedural routine. */
export type RoutineConfidence = 'high' | 'medium' | 'low';

/** A procedural routine — pre-wired decision shortcut. */
export interface ProceduralRoutine {
  /** Unique key (domain:model:strategy) */
  key: string;
  /** Domain */
  domain: string;
  /** Recommended model */
  model: string;
  /** Recommended strategy */
  strategy: string;
  /** Confidence level */
  confidence: RoutineConfidence;
  /** Expected quality (0-1) */
  expectedQuality: number;
  /** Number of times this routine was successfully applied */
  successCount: number;
  /** Total applications count */
  totalApplications: number;
  /** Last applied timestamp */
  lastApplied: string;
  /** Created from pattern */
  sourcePatternKey: string;
}

/** Configuration for ProceduralTier. */
export interface ProceduralTierConfig {
  /** Thompson confidence threshold for "high" confidence. Default: 0.8 */
  highConfidenceThreshold?: number;
  /** Thompson confidence threshold for"medium" confidence. Default: 0.6 */
  mediumConfidenceThreshold?: number;
  /** Minimum pattern episode count to promote to procedural. Default: 10 */
  minEpisodeCount?: number;
  /** Minimum world model prediction for promote. Default: 0.7 */
  minPredictionQuality?: number;
  /** Minimum success rate (successes/applications). Default: 0.8 */
  minSuccessRate?: number;
  /** Maximum routines to maintain. Default: 50 */
  maxRoutines?: number;
}

/** Tier promotion result. */
export interface PromotionResult {
  /** Routines promoted in this pass */
  promoted: Array<{ pattern: ConsolidatedPattern; routine: ProceduralRoutine }>;
  /** Routines demoted (confidence dropped) */
  demoted: string[];
  /** Total routines after promotion */
  totalRoutines: number;
}

/** Serialized procedural tier state. */
export interface ProceduralTierState {
  version: number;
  routines: ProceduralRoutine[];
  config: ProceduralTierConfig;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// ProceduralTier
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<ProceduralTierConfig> = {
  highConfidenceThreshold: 0.8,
  mediumConfidenceThreshold: 0.6,
  minEpisodeCount: 10,
  minPredictionQuality: 0.7,
  minSuccessRate: 0.8,
  maxRoutines: 50,
};

export class ProceduralTier {
  private routines = new Map<string, ProceduralRoutine>();
  private readonly config: Required<ProceduralTierConfig>;
  private readonly modelSampler: ThompsonSampler<string>;
  private readonly _strategySampler: ThompsonSampler<string>;
  private readonly _prototype: DomainPrototype;
  private readonly worldModel?: CreativeWorldModel;

  constructor(
    deps: {
      modelSampler: ThompsonSampler<string>;
      strategySampler: ThompsonSampler<string>;
      prototype: DomainPrototype;
      worldModel?: CreativeWorldModel;
    },
    config?: ProceduralTierConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelSampler = deps.modelSampler;
    this._strategySampler = deps.strategySampler;
    this._prototype = deps.prototype;
    this.worldModel = deps.worldModel;
  }

  // ---------------------------------------------------------------------------
  // Routine evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluate patterns from MemoryConsolidator and promote deserving
   * ones to procedural routines.
   *
   * A pattern is promoted when:
   *   1. Thompson confidence >= highConfidenceThreshold for its model
   *   2. Pattern episode count >= minEpisodeCount
   *   3. World model predicts quality >= minPredictionQuality (if available)
   *   4. Success rate >= minSuccessRate
   *
   * @returns Promotion result with newly promoted and demoted routines
   */
  evaluateAndPromote(patterns: ConsolidatedPattern[]): PromotionResult {
    const promoted: Array<{ pattern: ConsolidatedPattern; routine: ProceduralRoutine }> = [];
    const demoted: string[] = [];

    // Phase 1: Evaluate each pattern for promotion eligibility
    for (const pattern of patterns) {
      // Skip domain-level patterns (no model/strategy)
      if (!pattern.model || !pattern.strategy) continue;

      const key = pattern.key;

      // Check Thompson confidence for model
      const modelConfidence = this.modelSampler.getConfidence(pattern.model);
      if (modelConfidence < this.config.mediumConfidenceThreshold) continue;

      // Check episode count
      if (pattern.episodeCount < this.config.minEpisodeCount) continue;

      // Check world model prediction (if available)
      if (this.worldModel) {
        const prediction = this.worldModel.predict(
          this.makeBehaviorVector(pattern),
        );
        if (prediction && prediction.predicted < this.config.minPredictionQuality) continue;
      }

      // Check success rate
      const successRate = pattern.alpha / (pattern.alpha + pattern.beta);
      if (successRate < this.config.minSuccessRate) continue;

      // Check strategy confidence via Thompson sampling
      if (pattern.strategy) {
        const strategyConfidence = this._strategySampler.getConfidence(pattern.strategy);
        if (strategyConfidence < this.config.mediumConfidenceThreshold) continue;
      }

      // Check domain prototype similarity (how close to known-good centroid)
      if (pattern.domain) {
        const centroid = this._prototype.getCentroid(pattern.domain);
        if (centroid && centroid.exampleCount > 0 && pattern.avgQuality < centroid.avgQuality * 0.5) continue;
      }

      // Pattern qualifies! Determine confidence level
      const confidence: RoutineConfidence = modelConfidence >= this.config.highConfidenceThreshold
        ? 'high'
        : 'medium';

      const existing = this.routines.get(key);
      if (existing) {
        // Update existing routine
        existing.confidence = confidence;
        existing.expectedQuality = pattern.avgQuality;
        existing.successCount++;
        existing.totalApplications++;
        existing.lastApplied = new Date().toISOString();
      } else {
        // Create new routine
        const routine: ProceduralRoutine = {
          key,
          domain: pattern.domain,
          model: pattern.model,
          strategy: pattern.strategy,
          confidence,
          expectedQuality: pattern.avgQuality,
          successCount: 1,
          totalApplications: 1,
          lastApplied: new Date().toISOString(),
          sourcePatternKey: pattern.key,
        };
        this.routines.set(key, routine);
        promoted.push({ pattern, routine });
      }
    }

    // Phase 2: Check for demotions (routines whose patterns have degraded)
    for (const [key, routine] of this.routines) {
      if (routine.confidence === 'low' ||
          (routine.successCount / routine.totalApplications < this.config.minSuccessRate)) {
        demoted.push(key);
      }
    }

    // Phase 3: Enforce routine budget
    if (this.routines.size > this.config.maxRoutines) {
      // Remove lowest-confidence routines
      const sorted = Array.from(this.routines.entries())
        .sort(([, a], [, b]) => this.routineValue(a) - this.routineValue(b));

      const excess = this.routines.size - this.config.maxRoutines;
      for (let i = 0; i < excess; i++) {
        demoted.push(sorted[i][0]);
      }
    }

    // Remove demoted routines
    for (const key of demoted) {
      this.routines.delete(key);
    }

    Logger.info('ProceduralTier',
      `Promotion pass: ${promoted.length} promoted, ${demoted.length} demoted, ${this.routines.size} total`);

    return { promoted, demoted, totalRoutines: this.routines.size };
  }

  /**
   * Look up the best routine for a domain.
   * Returns the highest-confidence routine, or null.
   */
  lookup(domain: string): ProceduralRoutine | null {
    // Find the best routine matching this domain
    let best: ProceduralRoutine | null = null;
    for (const routine of this.routines.values()) {
      if (routine.domain !== domain) continue;
      if (!best || this.routineValue(routine) > this.routineValue(best)) {
        best = routine;
      }
    }
    return best;
  }

  /**
   * Apply a routine: record success or failure.
   * Call after using a routine's recommendation.
   */
  recordApplication(key: string, success: boolean): void {
    const routine = this.routines.get(key);
    if (!routine) return;

    routine.totalApplications++;
    if (success) {
      routine.successCount++;
    }
    routine.lastApplied = new Date().toISOString();

    // Check for demotion
    const successRate = routine.successCount / routine.totalApplications;
    if (successRate < this.config.minSuccessRate * 0.5) { // 50% tolerance
      routine.confidence = 'low';
    }
  }

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  /** Get a specific routine. */
  getRoutine(key: string): ProceduralRoutine | null {
    return this.routines.get(key) ?? null;
  }

  /** Get all routines for a domain. */
  getDomainRoutines(domain: string): ProceduralRoutine[] {
    const results: ProceduralRoutine[] = [];
    for (const routine of this.routines.values()) {
      if (routine.domain === domain) results.push(routine);
    }
    return results;
  }

  /** Get all routines. */
  getAllRoutines(): ProceduralRoutine[] {
    return Array.from(this.routines.values());
  }

  /** Number of active routines. */
  get routineCount(): number {
    return this.routines.size;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Serialize for persistence. */
  serialize(): ProceduralTierState {
    return {
      version: 1,
      routines: Array.from(this.routines.values()),
      config: this.config,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Load from persisted state. */
  deserialize(state: ProceduralTierState): void {
    this.routines.clear();
    for (const r of state.routines) {
      this.routines.set(r.key, r);
    }
    Logger.info('ProceduralTier', `Loaded ${this.routines.size} routines`);
  }

  /** Reset all state. */
  reset(): void {
    this.routines.clear();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Compute composite value of a routine.
   */
  private routineValue(routine: ProceduralRoutine): number {
    const confidenceMultiplier = routine.confidence === 'high' ? 1.0
      : routine.confidence === 'medium' ? 0.6 : 0.3;
    const successRate = routine.totalApplications > 0
      ? routine.successCount / routine.totalApplications : 0;
    return routine.expectedQuality * confidenceMultiplier * successRate;
  }

  /**
   * Create a behavior vector from a consolidated pattern.
   */
  private makeBehaviorVector(pattern: ConsolidatedPattern): BehaviorVector {
    return {
      domain: pattern.domain,
      lineCount: 50, // Default estimate
      techniqueDiversity: 3,
      hasInteraction: 1,
      hasColor: 1,
      hasLoops: 1,
      hasFunctions: 0,
      hasClasses: 0,
      commentDensity: 0.1,
    };
  }
}
