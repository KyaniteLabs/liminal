/**
 * CacheManager - LLM response caching with LRU eviction
 *
 * Features:
 * - Key = hash of (system prompt + user prompt)
 * - TTL = 1 hour default
 * - Max = 1000 entries default
 * - LRU eviction when full
 */

export interface CacheOptions {
  enabled?: boolean;
  ttlMs?: number;
  maxEntries?: number;
}

import { CACHE_TTL_MS, CACHE_MAX_ENTRIES } from '../constants/limits.js';

interface CacheEntry {
  value: string;
  timestamp: number;
}

function hashKey(system: string, user: string): string {
  // Simple hash for cache key — doesn't need crypto security
  let hash = 0;
  const data = system + '|||' + user;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

const DEFAULT_CACHE_OPTIONS: Required<CacheOptions> = {
  enabled: true,
  ttlMs: CACHE_TTL_MS,
  maxEntries: CACHE_MAX_ENTRIES,
};

export class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private options: Required<CacheOptions>;
  /** Lock for atomic cache operations */
  private lock: Promise<void> = Promise.resolve();

  constructor(options?: CacheOptions) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }

  /**
   * Acquire the cache lock.
   * Ensures atomic cache operations.
   */
  private async acquireLock(): Promise<() => void> {
    const releasePromise = this.lock;
    let releaseFn: () => void = () => {};
    
    this.lock = new Promise((resolve) => {
      releaseFn = resolve;
    });
    
    await releasePromise;
    return releaseFn;
  }

  /**
   * Execute a function with the cache lock held.
   */
  private async withLock<T>(fn: () => T): Promise<T> {
    const release = await this.acquireLock();
    try {
      return fn();
    } finally {
      release();
    }
  }

  async get(system: string, user: string): Promise<string | null> {
    if (!this.options.enabled) return null;

    return this.withLock(() => {
      const key = hashKey(system, user);
      const entry = this.cache.get(key);

      if (!entry) return null;

      // Check TTL
      if (Date.now() - entry.timestamp > this.options.ttlMs) {
        this.cache.delete(key);
        return null;
      }

      // LRU: move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);

      return entry.value;
    });
  }

  async set(system: string, user: string, value: string): Promise<void> {
    if (!this.options.enabled) return;

    await this.withLock(() => {
      const key = hashKey(system, user);

      // Evict oldest if at capacity (atomic check-and-evict)
      if (this.cache.size >= this.options.maxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) {
          this.cache.delete(oldest);
        }
      }

      this.cache.set(key, {
        value,
        timestamp: Date.now(),
      });
    });
  }

  async clear(): Promise<void> {
    await this.withLock(() => {
      this.cache.clear();
    });
  }

  get size(): number {
    return this.cache.size;
  }
}
