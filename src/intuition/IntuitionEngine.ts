/**
 * IntuitionEngine — Unified capstone that composes all intuition signals.
 *
 * This is the single entry point for the intuition system. It composes
 * signals from:
 *
 *   1. **ThompsonSampler** — Which model/strategy works best (confidence scores)
 *   2. **DomainPrototype** — How close is this output to known-good patterns
 *   3. **CreativeWorldModel** — Predicted quality from code behavior
 *   4. **ProceduralTier** — Cached automatic decisions (skip evaluation when confident)
 *   5. **ForgettingCurve** — Decay/retention across all stores
 *   6. **MemoryBudget** — Enforce budget limits
 *
 * The engine produces a composite IntuitionSignal (0-1) that augments
 * (NOT replaces) the existing analytical scoring pipeline.
 *
 * @module intuition/IntuitionEngine
 */

import { ThompsonSampler } from './ThompsonSampler.js';
import type { SamplerState } from './ThompsonSampler.js';
import { DomainPrototype } from './DomainPrototype.js';
import { IntuitionCache } from './IntuitionCache.js';
import type { SerializedCache } from './IntuitionCache.js';
import { MemoryConsolidator } from './MemoryConsolidator.js';
import type { ConsolidationEpisode, ConsolidationResult } from './MemoryConsolidator.js';
import { DreamEngine } from './DreamEngine.js';
import type { DreamJournalEntry } from './DreamEngine.js';
import { SleepScheduler } from './SleepScheduler.js';
import type { SleepDepth } from './SleepScheduler.js';
import { CreativeWorldModel } from './CreativeWorldModel.js';
import type { BehaviorVector, WorldModelState } from './CreativeWorldModel.js';
import { ForgettingCurve } from './ForgettingCurve.js';
import type { DecayableItem, DecaySummary } from './ForgettingCurve.js';
import { MemoryBudget } from './MemoryBudget.js';
import type { MemoryHealthReport } from './MemoryBudget.js';
import { ProceduralTier } from './ProceduralTier.js';
import type { ProceduralTierState } from './ProceduralTier.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single signal contributing to the composite intuition score. */
export interface IntuitionSignal {
  /** Signal name (e.g., 'thompson_confidence', 'prototype_distance') */
  name: string;
  /** Signal value (0-1) */
  value: number;
  /** Why this signal has this value */
  reason: string;
  /** Signal weight in composite (0-1) */
  weight: number;
}

/** The composite intuition assessment. */
export interface IntuitionAssessment {
  /** Composite score (0-1) */
  score: number;
  /** Overall confidence in the assessment */
  confidence: number;
  /** Individual signals that contributed */
  signals: IntuitionSignal[];
  /** Recommended model (from Thompson/ProceduralTier) */
  recommendedModel: string | null;
  /** Recommended strategy */
  recommendedStrategy: string | null;
  /** Whether a procedural shortcut was used */
  usedProceduralShortcut: boolean;
  /** Human-readable explanation */
  explanation: string;
}

/** Configuration for the IntuitionEngine. */
export interface IntuitionEngineConfig {
  /** Weight for Thompson confidence signal. Default: 0.3 */
  thompsonWeight?: number;
  /** Weight for prototype distance signal. Default: 0.25 */
  prototypeWeight?: number;
  /** Weight for world model prediction signal. Default: 0.25 */
  worldModelWeight?: number;
  /** Weight for novelty signal. Default: 0.2 */
  noveltyWeight?: number;
  /** Minimum confidence for procedural shortcut. Default: 0.8 */
  proceduralShortcutThreshold?: number;
  /** Whether dreaming is enabled. Default: true */
  dreamingEnabled?: boolean;
  /** Domains to explore in dreams. Default: ['p5'] */
  dreamDomains?: string[];
}

/** Engine health report. */
export interface IntuitionHealthReport {
  /** Thompson sampler arm count */
  thompsonArms: number;
  /** Prototype domain count */
  prototypeDomains: number;
  /** Cache entry count */
  cacheEntries: number;
  /** Consolidator pattern count */
  consolidatedPatterns: number;
  /** World model observation count */
  worldModelObservations: number;
  /** Procedural routine count */
  proceduralRoutines: number;
  /** Memory budget health */
  budgetHealth: MemoryHealthReport | null;
  /** Decay summary */
  decaySummary: DecaySummary | null;
}

/** Serialized engine state. */
export interface IntuitionEngineState {
  version: number;
  thompson: SamplerState;
  cache: SerializedCache;
  consolidator: ReturnType<MemoryConsolidator['serialize']>;
  worldModel: WorldModelState;
  proceduralTier: ProceduralTierState;
  dreamJournal: DreamJournalEntry[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// IntuitionEngine
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<IntuitionEngineConfig> = {
  thompsonWeight: 0.3,
  prototypeWeight: 0.25,
  worldModelWeight: 0.25,
  noveltyWeight: 0.2,
  proceduralShortcutThreshold: 0.8,
  dreamingEnabled: true,
  dreamDomains: ['p5'],
};

export class IntuitionEngine {
  // Core components
  private readonly modelSampler: ThompsonSampler<string>;
  private readonly strategySampler: ThompsonSampler<string>;
  private readonly prototype: DomainPrototype;
  private readonly cache: IntuitionCache;
  private readonly consolidator: MemoryConsolidator;
  private readonly worldModel: CreativeWorldModel;
  private readonly dreamEngine: DreamEngine;
  private readonly sleepScheduler: SleepScheduler;
  private readonly forgettingCurve: ForgettingCurve;
  private readonly memoryBudget: MemoryBudget;
  private readonly proceduralTier: ProceduralTier;

  private readonly config: Required<IntuitionEngineConfig>;

  constructor(config?: IntuitionEngineConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize core components
    this.modelSampler = new ThompsonSampler<string>({
      minPulls: 3,
      successThreshold: 0.7,
      maxArms: 50,
    });
    this.strategySampler = new ThompsonSampler<string>({
      minPulls: 3,
      successThreshold: 0.7,
      maxArms: 20,
    });
    this.prototype = new DomainPrototype();
    this.cache = new IntuitionCache({ maxSize: 500, ttlMs: 60 * 60 * 1000 });
    this.worldModel = new CreativeWorldModel({ minObservations: 3, kNeighbors: 5 });

    this.consolidator = new MemoryConsolidator(
      { modelSampler: this.modelSampler, strategySampler: this.strategySampler, prototype: this.prototype },
      { maxPatterns: 200, retentionStability: 10, maxAgeDays: 90 },
    );

    this.forgettingCurve = new ForgettingCurve({ stability: 10, pruneThreshold: 0.05 });
    this.memoryBudget = new MemoryBudget(this.forgettingCurve, { verbose: true });

    this.proceduralTier = new ProceduralTier(
      { modelSampler: this.modelSampler, strategySampler: this.strategySampler, prototype: this.prototype, worldModel: this.worldModel },
      { maxRoutines: 50 },
    );

    this.dreamEngine = new DreamEngine(
      {
        modelSampler: this.modelSampler,
        strategySampler: this.strategySampler,
        prototype: this.prototype,
        cache: this.cache,
        consolidator: this.consolidator,
      },
      { domains: this.config.dreamDomains },
    );

    this.sleepScheduler = new SleepScheduler();

    // Register stores with memory budget
    this.registerStores();
  }

  // ---------------------------------------------------------------------------
  // Primary API: Assess
  // ---------------------------------------------------------------------------

  /**
   * Assess an output using the full intuition pipeline.
   *
   * This is the main entry point called by the scoring engine.
   * Returns a composite IntuitionAssessment with score, signals,
   * and recommendations.
   */
  assess(
    output: string,
    domain: string,
    previousOutputs: string[] = [],
    embedding?: number[],
  ): IntuitionAssessment {
    const signals: IntuitionSignal[] = [];

    // Signal 1: Check procedural shortcut first
    const shortcut = this.proceduralTier.lookup(domain);
    if (shortcut && shortcut.confidence === 'high') {
      signals.push({
        name: 'procedural_shortcut',
        value: shortcut.expectedQuality,
        reason: `Procedural routine for ${domain}: model=${shortcut.model}, strategy=${shortcut.strategy}, confidence=${shortcut.confidence}`,
        weight: 1.0,
      });

      const assessment: IntuitionAssessment = {
        score: shortcut.expectedQuality,
        confidence: 0.95,
        signals,
        recommendedModel: shortcut.model,
        recommendedStrategy: shortcut.strategy,
        usedProceduralShortcut: true,
        explanation: `Procedural shortcut: ${domain} + ${shortcut.model} + ${shortcut.strategy} (confidence: ${shortcut.confidence}, quality: ${shortcut.expectedQuality.toFixed(2)})`,
      };

      Logger.info('IntuitionEngine', `Procedural shortcut used for ${domain}: ${shortcut.model}/${shortcut.strategy}`);
      return assessment;
    }

    // Signal 2: Thompson confidence
    const selectedModel = this.modelSampler.select();
    const modelConfidence = selectedModel ? this.modelSampler.getConfidence(selectedModel) : 0;
    signals.push({
      name: 'thompson_confidence',
      value: modelConfidence,
      reason: selectedModel
        ? `Thompson selected ${selectedModel} with confidence ${modelConfidence.toFixed(2)}`
        : 'No model has enough pulls for Thompson selection',
      weight: this.config.thompsonWeight,
    });

    // Signal 3: Prototype distance
    let prototypeValue = 0.5;
    if (embedding && this.prototype.isReady(domain, 3)) {
      const distance = this.prototype.distanceToCentroid(domain, embedding);
      prototypeValue = this.prototype.predictQuality(domain, embedding);
      signals.push({
        name: 'prototype_distance',
        value: prototypeValue,
        reason: `Distance to ${domain} centroid: ${distance.toFixed(3)}, predicted quality: ${prototypeValue.toFixed(2)}`,
        weight: this.config.prototypeWeight,
      });
    } else {
      signals.push({
        name: 'prototype_distance',
        value: 0.5,
        reason: 'No prototype data for domain (neutral default)',
        weight: this.config.prototypeWeight,
      });
    }

    // Signal 4: World model prediction
    let worldModelValue = 0.5;
    const behavior = CreativeWorldModel.extractBehavior(output, domain);
    if (this.worldModel.isReady(domain)) {
      const prediction = this.worldModel.predict(behavior);
      if (prediction) {
        worldModelValue = prediction.predicted;
        signals.push({
          name: 'world_model_prediction',
          value: worldModelValue,
          reason: `K-NN prediction: ${worldModelValue.toFixed(2)} (confidence: ${prediction.confidence.toFixed(2)}, ${prediction.neighborCount} neighbors)`,
          weight: this.config.worldModelWeight,
        });
      }
    } else {
      signals.push({
        name: 'world_model_prediction',
        value: 0.5,
        reason: 'World model not ready for domain (neutral default)',
        weight: this.config.worldModelWeight,
      });
    }

    // Signal 5: Novelty
    let noveltyValue = 1.0;
    if (previousOutputs.length > 0) {
      const outputTokens = new Set(output.toLowerCase().split(/\s+/));
      const maxSimilarity = Math.max(
        ...previousOutputs.map(prev => {
          const prevTokens = new Set(prev.toLowerCase().split(/\s+/));
          const intersection = new Set([...outputTokens].filter(t => prevTokens.has(t)));
          const union = new Set([...outputTokens, ...prevTokens]);
          return union.size > 0 ? intersection.size / union.size : 0;
        }),
      );
      noveltyValue = 1 - maxSimilarity;
    }
    signals.push({
      name: 'novelty',
      value: noveltyValue,
      reason: previousOutputs.length === 0
        ? 'No previous outputs (max novelty)'
        : `Novelty: ${noveltyValue.toFixed(2)} vs ${previousOutputs.length} previous outputs`,
      weight: this.config.noveltyWeight,
    });

    // Compute composite score
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
    const score = totalWeight > 0 ? Math.min(1, Math.max(0, weightedSum / totalWeight)) : 0.5;

    // Select best model/strategy
    const recommendedModel = selectedModel;
    const recommendedStrategy = this.strategySampler.select();

    const confidence = this.computeOverallConfidence(signals);

    const explanation = this.buildExplanation(domain, score, confidence, recommendedModel, recommendedStrategy, signals);

    return {
      score,
      confidence,
      signals,
      recommendedModel,
      recommendedStrategy,
      usedProceduralShortcut: false,
      explanation,
    };
  }

  // ---------------------------------------------------------------------------
  // Learning API
  // ---------------------------------------------------------------------------

  /**
   * Record an outcome — update all learning subsystems.
   * Call this after an output has been evaluated.
   */
  recordOutcome(
    output: string,
    domain: string,
    qualityScore: number,
    model?: string,
    strategy?: string,
    embedding?: number[],
  ): void {
    // Update Thompson samplers
    if (model) this.modelSampler.update(model, qualityScore);
    if (strategy) this.strategySampler.update(strategy, qualityScore);

    // Update world model
    const behavior = CreativeWorldModel.extractBehavior(output, domain);
    this.worldModel.record(behavior, qualityScore);

    // Update prototype from high-quality outputs
    if (embedding && qualityScore >= 0.7) {
      this.prototype.addExample(domain, embedding, qualityScore);
    }

    // Record in cache
    this.cache.set(domain, output, {
      score: qualityScore,
      confidence: this.modelSampler.getConfidence(model ?? ''),
      signals: [{ name: 'quality', value: qualityScore, reason: `Actual quality score: ${qualityScore.toFixed(2)}` }],
      recommendation: `domain: ${domain} | model: ${model ?? 'unknown'} | strategy: ${strategy ?? 'unknown'}`,
    }, embedding);

    // Record activity for sleep scheduler
    this.sleepScheduler.recordActivity('generation');

    // Record application for procedural tier
    if (model && strategy) {
      const routineKey = `${domain}:${model}:${strategy}`;
      this.proceduralTier.recordApplication(routineKey, qualityScore >= 0.7);
    }
  }

  /**
   * Consolidate raw episodes into compressed patterns.
   * Call periodically (e.g., at session end or during dreams).
   */
  consolidate(episodes: ConsolidationEpisode[]): ConsolidationResult {
    // Run consolidation
    const result = this.consolidator.consolidate(episodes);

    // Promote deserving patterns to procedural routines
    const patterns = this.consolidator.getAllPatterns();
    this.proceduralTier.evaluateAndPromote(patterns);

    // Enforce memory budgets
    this.memoryBudget.enforce();

    return result;
  }

  // ---------------------------------------------------------------------------
  // Dream API
  // ---------------------------------------------------------------------------

  /**
   * Run a dream cycle (if the sleep scheduler says it's time).
   * Returns the dream journal entry, or null if not time to dream.
   */
  async dream(): Promise<DreamJournalEntry | null> {
    if (!this.config.dreamingEnabled) return null;

    const depth = this.sleepScheduler.shouldDream();
    if (!depth) return null;

    Logger.info('IntuitionEngine', `Starting ${depth} dream cycle`);
    const entry = await this.dreamEngine.dream(depth);
    this.sleepScheduler.markDreamCompleted();

    // After dreaming, run consolidation and promotion
    const patterns = this.consolidator.getAllPatterns();
    this.proceduralTier.evaluateAndPromote(patterns);
    this.memoryBudget.enforce();

    return entry;
  }

  /**
   * Force a dream cycle regardless of sleep state.
   */
  async forceDream(depth: SleepDepth = 'micro'): Promise<DreamJournalEntry> {
    const entry = await this.dreamEngine.dream(depth);
    this.sleepScheduler.markDreamCompleted();

    const patterns = this.consolidator.getAllPatterns();
    this.proceduralTier.evaluateAndPromote(patterns);
    this.memoryBudget.enforce();

    return entry;
  }

  // ---------------------------------------------------------------------------
  // Component accessors
  // ---------------------------------------------------------------------------

  getModelSampler(): ThompsonSampler<string> { return this.modelSampler; }
  getStrategySampler(): ThompsonSampler<string> { return this.strategySampler; }
  getPrototype(): DomainPrototype { return this.prototype; }
  getCache(): IntuitionCache { return this.cache; }
  getConsolidator(): MemoryConsolidator { return this.consolidator; }
  getWorldModel(): CreativeWorldModel { return this.worldModel; }
  getDreamEngine(): DreamEngine { return this.dreamEngine; }
  getSleepScheduler(): SleepScheduler { return this.sleepScheduler; }
  getForgettingCurve(): ForgettingCurve { return this.forgettingCurve; }
  getMemoryBudget(): MemoryBudget { return this.memoryBudget; }
  getProceduralTier(): ProceduralTier { return this.proceduralTier; }

  // ---------------------------------------------------------------------------
  // Health & diagnostics
  // ---------------------------------------------------------------------------

  /**
   * Get a comprehensive health report for all subsystems.
   */
  getHealthReport(): IntuitionHealthReport {
    const allItems: DecayableItem[] = [
      ...Array.from(this.cache.getDomainEntries('p5')).map(e => ({
        lastUpdated: new Date(e.createdAt).toISOString(),
        quality: e.assessment.score,
      })),
    ];

    return {
      thompsonArms: this.modelSampler.totalPulls,
      prototypeDomains: this.prototype.domainCount,
      cacheEntries: this.cache.getStats().size,
      consolidatedPatterns: this.consolidator.patternCount,
      worldModelObservations: this.worldModel.getObservationCount(),
      proceduralRoutines: this.proceduralTier.routineCount,
      budgetHealth: this.memoryBudget.getHealthReport(),
      decaySummary: this.forgettingCurve.summarize(allItems),
    };
  }

  /**
   * Get a human-readable summary of the engine state.
   */
  getSummary(): string {
    const health = this.getHealthReport();
    return [
      `Intuition Engine Summary:`,
      `  Thompson arms: ${health.thompsonArms} pulls across models`,
      `  Prototypes: ${health.prototypeDomains} domains`,
      `  Cache: ${health.cacheEntries} entries (${this.cache.getStats().hitRate.toFixed(1)}% hit rate)`,
      `  Patterns: ${health.consolidatedPatterns} consolidated`,
      `  World model: ${health.worldModelObservations} observations`,
      `  Procedural: ${health.proceduralRoutines} routines`,
      `  Best model: ${this.modelSampler.bestByMean() ?? 'undetermined'}`,
      `  Best strategy: ${this.strategySampler.bestByMean() ?? 'undetermined'}`,
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Serialize all engine state for persistence.
   */
  serialize(): IntuitionEngineState {
    return {
      version: 1,
      thompson: this.modelSampler.serialize(),
      cache: this.cache.serialize(),
      consolidator: this.consolidator.serialize(),
      worldModel: this.worldModel.serialize(),
      proceduralTier: this.proceduralTier.serialize(),
      dreamJournal: this.dreamEngine.getJournal(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Load engine state from persistence.
   */
  deserialize(state: IntuitionEngineState): void {
    this.modelSampler.deserialize(state.thompson);
    this.cache.deserialize(state.cache);
    this.consolidator.deserialize(state.consolidator);
    this.worldModel.deserialize(state.worldModel);
    this.proceduralTier.deserialize(state.proceduralTier);
    Logger.info('IntuitionEngine', `Loaded engine state from ${state.updatedAt}`);
  }

  /**
   * Reset all engine state.
   */
  reset(): void {
    this.modelSampler.reset();
    this.strategySampler.reset();
    this.prototype.reset();
    this.cache.reset();
    this.consolidator.reset();
    this.worldModel.reset();
    this.proceduralTier.reset();
    this.dreamEngine.reset();
    this.sleepScheduler.reset();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private registerStores(): void {
    // Register cache as a prunable store
    this.memoryBudget.registerStore('cache', {
      getSize: () => this.cache.getStats().size,
      getItems: () => this.cache.getDomainEntries('p5').map(e => ({
        lastUpdated: new Date(e.createdAt).toISOString(),
        quality: e.assessment.score,
      })),
      prune: (count: number) => {
        const entries = this.cache.getDomainEntries('p5');
        // Sort by quality ascending, prune lowest
        entries.sort((a, b) => a.assessment.score - b.assessment.score);
        let pruned = 0;
        for (let i = 0; i < count && i < entries.length; i++) {
          if (this.cache.delete(entries[i].domain, entries[i].key)) pruned++;
        }
        return pruned;
      },
    }, { maxSize: 500 });

    // Register consolidator patterns as a prunable store
    this.memoryBudget.registerStore('patterns', {
      getSize: () => this.consolidator.patternCount,
      getItems: () => this.consolidator.getAllPatterns().map(p => ({
        lastUpdated: p.lastUpdated,
        quality: p.avgQuality,
      })),
      prune: (_count: number) => 0, // Consolidator handles its own pruning
    }, { maxSize: 200 });

    // Register procedural routines as a prunable store
    this.memoryBudget.registerStore('routines', {
      getSize: () => this.proceduralTier.routineCount,
      getItems: () => this.proceduralTier.getAllRoutines().map(r => ({
        lastUpdated: r.lastApplied,
        quality: r.expectedQuality,
        reinforcementCount: r.totalApplications,
      })),
      prune: (_count: number) => 0, // ProceduralTier handles its own pruning
    }, { maxSize: 50 });
  }

  private computeOverallConfidence(signals: IntuitionSignal[]): number {
    if (signals.length === 0) return 0;
    const avgValue = signals.reduce((sum, s) => sum + s.value, 0) / signals.length;
    const countFactor = Math.min(1, this.modelSampler.totalPulls / 20);
    return avgValue * 0.7 + countFactor * 0.3;
  }

  private buildExplanation(
    domain: string,
    score: number,
    confidence: number,
    model: string | null,
    strategy: string | null,
    signals: IntuitionSignal[],
  ): string {
    const signalSummary = signals
      .map(s => `${s.name}=${s.value.toFixed(2)}`)
      .join(', ');

    return [
      `Intuition: domain=${domain}, score=${score.toFixed(2)}, confidence=${confidence.toFixed(2)}`,
      `  model=${model ?? 'undetermined'}, strategy=${strategy ?? 'undetermined'}`,
      `  signals: [${signalSummary}]`,
    ].join('\n');
  }
}
