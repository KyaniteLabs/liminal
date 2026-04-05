/**
 * MemoryConsolidator — Compresses raw episodic data into reusable knowledge.
 *
 * Inspired by the brain's sleep consolidation: converts specific episodes
 * (L3 — "p5 output scored 0.85 on March 4th using qwen3") into compressed
 * semantic patterns (L2 — "p5 + qwen3 averages 0.82 over 47 samples").
 *
 * The consolidation pass:
 *   1. Scan raw episodes from HarnessMemory and QualityArchive
 *   2. Group by (domain, model, strategy) triplets
 *   3. Extract Thompson Beta(α,β) parameters from success/failure counts
 *   4. Update DomainPrototype centroids from high-quality examples
 *   5. Score strategy effectiveness per domain
 *   6. Apply Ebbinghaus retention decay to stale entries
 *   7. Budget-gated pruning to keep memory bounded
 *
 * @module intuition/MemoryConsolidator
 */

import { ThompsonSampler } from './ThompsonSampler.js';
import { DomainPrototype } from './DomainPrototype.js';
import { IntuitionCache } from './IntuitionCache.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A raw episode to consolidate — lightweight view of MemoryEpisode/ArchiveEntry. */
export interface ConsolidationEpisode {
  domain: string;
  output: string;
  qualityScore: number;
  /** Which model generated this (e.g., 'qwen3', 'local'). */
  model?: string;
  /** Which strategy was used (e.g., 'swarm', 'solo', 'deep'). */
  strategy?: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Optional embedding for prototype updates. */
  embedding?: number[];
}

/** Compressed pattern extracted from episodes. */
export interface ConsolidatedPattern {
  /** Grouping key: 'domain' | 'domain:model' | 'domain:model:strategy' */
  key: string;
  domain: string;
  model?: string;
  strategy?: string;
  /** Thompson Beta α (successes + 1) */
  alpha: number;
  /** Thompson Beta β (failures + 1) */
  beta: number;
  /** Number of episodes compressed */
  episodeCount: number;
  /** Average quality score */
  avgQuality: number;
  /** Quality variance (0 = all same, 1 = max spread) */
  qualityVariance: number;
  /** Best quality score seen */
  bestQuality: number;
  /** Worst quality score seen */
  worstQuality: number;
  /** Ebbinghaus retention score (0-1, decays over time) */
  retention: number;
  /** Last updated timestamp */
  lastUpdated: string;
  /** When this pattern was created */
  createdAt: string;
}

/** Result of a consolidation pass. */
export interface ConsolidationResult {
  /** Number of raw episodes processed */
  episodesProcessed: number;
  /** Number of patterns extracted */
  patternsCreated: number;
  /** Number of stale patterns pruned */
  patternsPruned: number;
  /** Number of prototype updates */
  prototypeUpdates: number;
  /** Duration in ms */
  durationMs: number;
  /** Breakdown by domain */
  byDomain: Record<string, {
    episodes: number;
    patterns: number;
    avgQuality: number;
  }>;
}

/** Consolidator configuration. */
export interface ConsolidatorConfig {
  /** Quality threshold for "success" (Thompson update). Default: 0.7 */
  successThreshold?: number;
  /** Minimum episodes before creating a pattern. Default: 2 */
  minEpisodesForPattern?: number;
  /** Maximum number of patterns to retain. Default: 200 */
  maxPatterns?: number;
  /** Ebbinghaus stability constant S. Higher = slower decay. Default: 10 */
  retentionStability?: number;
  /** Maximum age in days before pruning (regardless of retention). Default: 90 */
  maxAgeDays?: number;
  /** Whether to update domain prototypes during consolidation. Default: true */
  updatePrototypes?: boolean;
}

// ---------------------------------------------------------------------------
// Internal: Pattern store
// ---------------------------------------------------------------------------

interface PatternStore {
  version: number;
  patterns: ConsolidatedPattern[];
  lastConsolidation: string;
  totalEpisodesProcessed: number;
}

// ---------------------------------------------------------------------------
// MemoryConsolidator
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<ConsolidatorConfig> = {
  successThreshold: 0.7,
  minEpisodesForPattern: 2,
  maxPatterns: 200,
  retentionStability: 10,
  maxAgeDays: 90,
  updatePrototypes: true,
};

export class MemoryConsolidator {
  private patterns = new Map<string, ConsolidatedPattern>();
  private readonly config: Required<ConsolidatorConfig>;
  private totalEpisodesProcessed = 0;

  // References to update during consolidation
  private readonly modelSampler?: ThompsonSampler<string>;
  private readonly strategySampler?: ThompsonSampler<string>;
  private readonly prototype?: DomainPrototype;
  private readonly _cache?: IntuitionCache;

  constructor(
    deps?: {
      modelSampler?: ThompsonSampler<string>;
      strategySampler?: ThompsonSampler<string>;
      prototype?: DomainPrototype;
      cache?: IntuitionCache;
    },
    config?: ConsolidatorConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelSampler = deps?.modelSampler;
    this.strategySampler = deps?.strategySampler;
    this.prototype = deps?.prototype;
    this._cache = deps?.cache; // Used in Phase 4 for dream output caching
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run a consolidation pass over raw episodes.
   *
   * Groups episodes by domain/model/strategy, extracts compressed patterns,
   * updates Thompson samplers and domain prototypes, then prunes stale data.
   */
  consolidate(episodes: ConsolidationEpisode[]): ConsolidationResult {
    const start = Date.now();
    const byDomain: Record<string, { episodes: number; patterns: number; qualitySum: number }> = {};

    // --- Phase 0: Count unique episodes per domain ---
    for (const ep of episodes) {
      if (!byDomain[ep.domain]) byDomain[ep.domain] = { episodes: 0, patterns: 0, qualitySum: 0 };
      byDomain[ep.domain].episodes++;
      byDomain[ep.domain].qualitySum += ep.qualityScore;
    }

    // --- Phase 1: Group episodes ---
    const groups = this.groupEpisodes(episodes);

    // --- Phase 2: Extract patterns from each group ---
    let patternsCreated = 0;
    let prototypeUpdates = 0;

    for (const [key, groupEpisodes] of groups.entries()) {
      if (groupEpisodes.length < this.config.minEpisodesForPattern) continue;

      const pattern = this.extractPattern(key, groupEpisodes);

      // Merge with existing pattern or create new
      const existing = this.patterns.get(key);
      if (existing) {
        this.mergePattern(existing, pattern);
      } else {
        this.patterns.set(key, pattern);
        patternsCreated++;
      }

      // Track pattern count per domain
      if (byDomain[pattern.domain]) byDomain[pattern.domain].patterns++;

      // --- Phase 3: Update live components ---
      this.updateThompsonFromPattern(pattern);
      if (this.config.updatePrototypes) {
        prototypeUpdates += this.updatePrototypeFromEpisodes(groupEpisodes);
      }
    }

    // --- Phase 4: Apply Ebbinghaus retention decay ---
    this.applyRetentionDecay();

    // --- Phase 5: Budget-gated pruning ---
    const patternsPruned = this.pruneStale();

    this.totalEpisodesProcessed += episodes.length;

    // Build domain summary
    const domainSummary: ConsolidationResult['byDomain'] = {};
    for (const [domain, stats] of Object.entries(byDomain)) {
      domainSummary[domain] = {
        episodes: stats.episodes,
        patterns: stats.patterns,
        avgQuality: stats.episodes > 0 ? stats.qualitySum / stats.episodes : 0,
      };
    }

    const durationMs = Date.now() - start;

    Logger.info('MemoryConsolidator',
      `Consolidated ${episodes.length} episodes → ${patternsCreated} patterns, ` +
      `${patternsPruned} pruned, ${prototypeUpdates} prototype updates (${durationMs}ms)`);

    return {
      episodesProcessed: episodes.length,
      patternsCreated,
      patternsPruned,
      prototypeUpdates,
      durationMs,
      byDomain: domainSummary,
    };
  }

  /** Get a specific pattern by key. */
  getPattern(key: string): ConsolidatedPattern | null {
    return this.patterns.get(key) ?? null;
  }

  /** Get all patterns for a domain. */
  getPatternsByDomain(domain: string): ConsolidatedPattern[] {
    const results: ConsolidatedPattern[] = [];
    for (const pattern of this.patterns.values()) {
      if (pattern.domain === domain) results.push(pattern);
    }
    return results;
  }

  /** Get all patterns. */
  getAllPatterns(): ConsolidatedPattern[] {
    return Array.from(this.patterns.values());
  }

  /** Number of consolidated patterns. */
  get patternCount(): number {
    return this.patterns.size;
  }

  /** Total episodes ever processed. */
  get processedCount(): number {
    return this.totalEpisodesProcessed;
  }

  /** Access the cache reference (for external wiring). */
  getCache(): IntuitionCache | undefined {
    return this._cache;
  }

  /** Reset all state. */
  reset(): void {
    this.patterns.clear();
    this.totalEpisodesProcessed = 0;
  }

  /** Serialize for persistence. */
  serialize(): PatternStore {
    return {
      version: 1,
      patterns: Array.from(this.patterns.values()),
      lastConsolidation: new Date().toISOString(),
      totalEpisodesProcessed: this.totalEpisodesProcessed,
    };
  }

  /** Load from persisted state. */
  deserialize(state: PatternStore): void {
    this.patterns.clear();
    for (const p of state.patterns) {
      this.patterns.set(p.key, p);
    }
    this.totalEpisodesProcessed = state.totalEpisodesProcessed ?? 0;
    Logger.info('MemoryConsolidator', `Loaded ${this.patterns.size} consolidated patterns`);
  }

  // ---------------------------------------------------------------------------
  // Private: Grouping & extraction
  // ---------------------------------------------------------------------------

  /**
   * Group episodes by domain, then optionally by model and strategy.
   * Keys: 'domain', 'domain:model', or 'domain:model:strategy'.
   */
  private groupEpisodes(episodes: ConsolidationEpisode[]): Map<string, ConsolidationEpisode[]> {
    const groups = new Map<string, ConsolidationEpisode[]>();

    for (const ep of episodes) {
      // Create multiple groupings for different granularities
      const keys: string[] = [ep.domain];

      if (ep.model) {
        keys.push(`${ep.domain}:${ep.model}`);
        if (ep.strategy) {
          keys.push(`${ep.domain}:${ep.model}:${ep.strategy}`);
        }
      }

      for (const key of keys) {
        const group = groups.get(key) ?? [];
        group.push(ep);
        groups.set(key, group);
      }
    }

    return groups;
  }

  /**
   * Extract a compressed pattern from a group of episodes.
   */
  private extractPattern(key: string, episodes: ConsolidationEpisode[]): ConsolidatedPattern {
    const parts = key.split(':');
    const domain = parts[0];
    const model = parts[1];
    const strategy = parts[2];

    const scores = episodes.map(e => e.qualityScore);
    const successes = scores.filter(s => s >= this.config.successThreshold).length;
    const failures = scores.length - successes;

    const avgQuality = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.length > 1
      ? scores.reduce((sum, s) => sum + (s - avgQuality) ** 2, 0) / scores.length
      : 0;

    // Use latest episode timestamp so retention decay reflects actual data age
    const latestTimestamp = episodes
      .map(e => e.timestamp)
      .sort()
      .pop() ?? new Date().toISOString();
    const now = new Date().toISOString();

    return {
      key,
      domain,
      model,
      strategy,
      alpha: successes + 1,   // Beta prior α=1
      beta: failures + 1,     // Beta prior β=1
      episodeCount: episodes.length,
      avgQuality,
      qualityVariance: Math.min(1, variance * 4), // Scale variance to 0-1
      bestQuality: Math.max(...scores),
      worstQuality: Math.min(...scores),
      retention: 1.0,
      lastUpdated: latestTimestamp,
      createdAt: now,
    };
  }

  /**
   * Merge a new pattern into an existing one.
   * Uses online update: weighted average of stats.
   */
  private mergePattern(existing: ConsolidatedPattern, incoming: ConsolidatedPattern): void {
    const n1 = existing.episodeCount;
    const n2 = incoming.episodeCount;
    const total = n1 + n2;

    existing.alpha += incoming.alpha - 1; // Subtract prior to avoid double-counting
    existing.beta += incoming.beta - 1;
    existing.episodeCount = total;
    existing.avgQuality = (existing.avgQuality * n1 + incoming.avgQuality * n2) / total;
    existing.bestQuality = Math.max(existing.bestQuality, incoming.bestQuality);
    existing.worstQuality = Math.min(existing.worstQuality, incoming.worstQuality);
    existing.qualityVariance = (existing.qualityVariance * n1 + incoming.qualityVariance * n2) / total;
    existing.lastUpdated = new Date().toISOString();
    existing.retention = 1.0; // Refresh retention on new data
  }

  // ---------------------------------------------------------------------------
  // Private: Thompson & Prototype updates
  // ---------------------------------------------------------------------------

  /**
   * Push consolidated pattern data into ThompsonSampler.
   */
  private updateThompsonFromPattern(pattern: ConsolidatedPattern): void {
    // Update model sampler
    if (this.modelSampler && pattern.model) {
      // Replay successes/failures as batch update
      const successes = pattern.alpha - 1;
      const failures = pattern.beta - 1;
      for (let i = 0; i < successes; i++) {
        this.modelSampler.update(pattern.model, this.config.successThreshold + 0.1);
      }
      for (let i = 0; i < failures; i++) {
        this.modelSampler.update(pattern.model, this.config.successThreshold - 0.2);
      }
    }

    // Update strategy sampler
    if (this.strategySampler && pattern.strategy) {
      const successes = pattern.alpha - 1;
      const failures = pattern.beta - 1;
      for (let i = 0; i < successes; i++) {
        this.strategySampler.update(pattern.strategy, this.config.successThreshold + 0.1);
      }
      for (let i = 0; i < failures; i++) {
        this.strategySampler.update(pattern.strategy, this.config.successThreshold - 0.2);
      }
    }
  }

  /**
   * Update domain prototype from high-quality episodes.
   * Returns count of prototype updates made.
   */
  private updatePrototypeFromEpisodes(episodes: ConsolidationEpisode[]): number {
    if (!this.prototype) return 0;

    let updates = 0;
    const highQuality = episodes.filter(e =>
      e.qualityScore >= this.config.successThreshold && e.embedding
    );

    for (const ep of highQuality) {
      this.prototype.addExample(ep.domain, ep.embedding!, ep.qualityScore);
      updates++;
    }

    return updates;
  }

  // ---------------------------------------------------------------------------
  // Private: Ebbinghaus retention & pruning
  // ---------------------------------------------------------------------------

  /**
   * Apply Ebbinghaus retention decay to all patterns.
   * R(t) = exp(-t / S) where t = days since last update, S = stability constant.
   */
  private applyRetentionDecay(): void {
    const now = Date.now();

    for (const pattern of this.patterns.values()) {
      const lastUpdate = new Date(pattern.lastUpdated).getTime();
      const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      pattern.retention = Math.exp(-daysSinceUpdate / this.config.retentionStability);
    }
  }

  /**
   * Prune patterns that are stale or over budget.
   * Budget-gated: keep at most maxPatterns, evicting lowest-retention first.
   */
  private pruneStale(): number {
    let pruned = 0;
    const now = Date.now();
    const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

    // Phase 1: Remove patterns exceeding max age
    const toDelete: string[] = [];
    for (const [key, pattern] of this.patterns.entries()) {
      const age = now - new Date(pattern.lastUpdated).getTime();
      if (age > maxAgeMs && pattern.retention < 0.05) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.patterns.delete(key);
      pruned++;
    }

    // Phase 2: Budget-gated eviction (keep at most maxPatterns)
    if (this.patterns.size > this.config.maxPatterns) {
      // Sort by retention ascending (lowest first)
      const sorted = Array.from(this.patterns.entries())
        .sort(([, a], [, b]) => a.retention - b.retention);

      const excess = this.patterns.size - this.config.maxPatterns;
      for (let i = 0; i < excess && i < sorted.length; i++) {
        this.patterns.delete(sorted[i][0]);
        pruned++;
      }
    }

    return pruned;
  }
}
