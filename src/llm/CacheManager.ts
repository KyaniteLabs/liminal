/**
 * CacheManager - LLM response caching with LRU eviction
 *
 * Features:
 * - Key = hash of (system prompt + user prompt)
 * - TTL = 1 hour default
 * - Max = 1000 entries default
 * - LRU eviction when full
 *
 * Note: Cache operations are synchronous. In Node.js single-threaded event loop,
 * Map operations (get, set, delete) are atomic relative to other JavaScript
 * execution. Concurrent async operations interleave but each operation completes
 * before the next begins.
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

function hashKey(system: string | null | undefined, user: string | null | undefined): string {
  // Simple hash for cache key — doesn't need crypto security
  const safeSystem = system ?? '';
  const safeUser = user ?? '';
  let hash = 0;
  const data = safeSystem + '|||' + safeUser;
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

  constructor(options?: CacheOptions) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }

  get(system: string | null | undefined, user: string | null | undefined): string | null {
    if (!this.options.enabled) return null;
    if (system == null || user == null) return null;

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
  }

  set(system: string | null | undefined, user: string | null | undefined, value: string | null | undefined): void {
    if (!this.options.enabled) return;
    if (system == null || user == null || value == null) return;

    const key = hashKey(system, user);

    // Evict oldest if at capacity
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
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
