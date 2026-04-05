/**
 * IntuitionCache — Fast lookup for previously computed intuition assessments.
 *
 * Avoids recomputing Thompson samples, prototype distances, and novelty scores
 * for outputs the system has already evaluated. Critical for the dreaming engine
 * (Phase 4), which generates many candidates rapidly and needs fast quality
 * predictions for each.
 *
 * Cache keys are DJB2 hashes of (domain + output) — no embedding needed.
 * For approximate/similarity-based lookups, use `findSimilar()` which
 * delegates to EmbeddingService when available.
 *
 * @module intuition/IntuitionCache
 */

import type { IntuitionAssessment } from './IntuitionStrategy.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry {
  /** Cache key (DJB2 hash of domain+output) */
  key: string;
  /** Domain tag */
  domain: string;
  /** Stored assessment */
  assessment: IntuitionAssessment;
  /** Embedding vector (optional, for similarity search) */
  embedding?: number[];
  /** Creation timestamp (ms since epoch) */
  createdAt: number;
  /** Last access timestamp (for LRU) */
  lastAccessedAt: number;
  /** Access count */
  hitCount: number;
}

export interface IntuitionCacheConfig {
  /** Maximum cache entries. Default: 500 */
  maxSize?: number;
  /** Time-to-live in milliseconds. Default: 3600000 (1 hour) */
  ttlMs?: number;
  /** Whether to store embeddings for similarity search. Default: false */
  storeEmbeddings?: boolean;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export interface SerializedCache {
  version: number;
  entries: CacheEntry[];
  config: IntuitionCacheConfig;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// IntuitionCache
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<IntuitionCacheConfig> = {
  maxSize: 500,
  ttlMs: 3_600_000, // 1 hour
  storeEmbeddings: false,
};

export class IntuitionCache {
  private entries = new Map<string, CacheEntry>();
  private readonly config: Required<IntuitionCacheConfig>;

  // Access-order tracking for LRU (most recently used at the end)
  private accessOrder: string[] = [];

  // Stats
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config?: IntuitionCacheConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get a cached assessment for a domain + output pair.
   * Returns null if not cached or expired.
   */
  get(domain: string, output: string): IntuitionAssessment | null {
    const key = this.hashKey(domain, output);
    const entry = this.entries.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.createdAt > this.config.ttlMs) {
      this.entries.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.misses++;
      return null;
    }

    // Update access stats
    entry.lastAccessedAt = Date.now();
    entry.hitCount++;
    this.hits++;

    // Move to end of LRU
    this.touchKey(key);

    return entry.assessment;
  }

  /**
   * Store an assessment in the cache.
   * Optionally include an embedding for future similarity search.
   */
  set(domain: string, output: string, assessment: IntuitionAssessment, embedding?: number[]): void {
    const key = this.hashKey(domain, output);

    // Evict if at capacity
    if (this.entries.size >= this.config.maxSize && !this.entries.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry = {
      key,
      domain,
      assessment,
      createdAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      ...(this.config.storeEmbeddings && embedding ? { embedding } : {}),
    };

    this.entries.set(key, entry);
    this.touchKey(key);
  }

  /**
   * Find the most similar cached assessment by embedding similarity.
   * Returns null if no similar entries found (above threshold).
   *
   * Uses cosine similarity — higher = more similar.
   */
  findSimilar(domain: string, embedding: number[], threshold: number = 0.85): CacheEntry | null {
    let bestEntry: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.entries.values()) {
      if (entry.domain !== domain || !entry.embedding) continue;

      const similarity = this.cosineSimilarity(embedding, entry.embedding);
      if (similarity > threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestEntry = entry;
      }
    }

    if (bestEntry) {
      this.hits++;
      bestEntry.hitCount++;
      bestEntry.lastAccessedAt = Date.now();
    } else {
      this.misses++;
    }

    return bestEntry;
  }

  /** Check if a domain+output is cached and not expired. */
  has(domain: string, output: string): boolean {
    return this.get(domain, output) !== null;
  }

  /** Remove a specific entry. */
  delete(domain: string, output: string): boolean {
    const key = this.hashKey(domain, output);
    const deleted = this.entries.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    return deleted;
  }

  /** Get cache statistics. */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.entries.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /** Get entries for a specific domain. */
  getDomainEntries(domain: string): CacheEntry[] {
    const results: CacheEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.domain === domain) results.push(entry);
    }
    return results;
  }

  /** Remove all expired entries. Returns count of purged entries. */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.entries.delete(key);
        purged++;
      }
    }

    if (purged > 0) {
      this.accessOrder = this.accessOrder.filter(k => this.entries.has(k));
      Logger.info('IntuitionCache', `Purged ${purged} expired entries (${this.entries.size} remaining)`);
    }

    return purged;
  }

  /** Clear all entries and reset stats. */
  reset(): void {
    this.entries.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /** Serialize for persistence. */
  serialize(): SerializedCache {
    return {
      version: 1,
      entries: Array.from(this.entries.values()),
      config: this.config,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Load from persisted state. */
  deserialize(state: SerializedCache): void {
    this.entries.clear();
    this.accessOrder = [];

    for (const entry of state.entries) {
      this.entries.set(entry.key, entry);
      this.accessOrder.push(entry.key);
    }

    Logger.info('IntuitionCache', `Loaded ${this.entries.size} cached assessments`);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * DJB2 hash for cache keys. Fast, good distribution, no crypto needed.
   */
  private hashKey(domain: string, output: string): string {
    const combined = `${domain}\0${output}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Keep to 32-bit int
    }
    return `${hash}`;
  }

  /**
   * Move key to end of access-order list (most recently used).
   */
  private touchKey(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Evict least-recently-used entry.
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    this.entries.delete(lruKey);
    this.accessOrder.shift();
    this.evictions++;
  }

  /**
   * Cosine similarity between two vectors.
   * Returns 0 for zero vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
