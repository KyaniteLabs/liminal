/**
 * ParsingCache - File-hash-keyed parse cache for LIR tokens
 *
 * Stores parsed LIR tokens keyed by file SHA256. When a file is modified,
 * its hash changes and the cache entry becomes invalid.
 *
 * Cache directory: ~/.liminal/parsing-cache/
 *
 * Usage:
 *   const cache = new ParsingCache(cacheDir);
 *   await cache.set(filePath, token);
 *   const token = await cache.get(filePath);
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import type { LIRToken } from '../lir/types.js';

/**
 * Cache entry structure stored on disk
 */
interface CacheEntry {
  /** SHA256 hash of the file content when cached */
  hash: string;
  /** The cached LIR token */
  token: LIRToken;
}

/**
 * ParsingCache provides file-hash-based caching for parsed LIR tokens.
 *
 * The cache uses a two-tier strategy:
 * 1. In-memory Map for fast access
 * 2. Disk persistence for survival across process restarts
 *
 * Cache keys are SHA256 hashes of file content, so any modification
 * to the source file invalidates the cache entry.
 */
export class ParsingCache {
  /** Directory where cache files are stored */
  private readonly cacheDir: string;

  /** In-memory cache: hash -> CacheEntry */
  private memoryCache: Map<string, CacheEntry>;

  /** File path -> hash mapping (for quick lookups) */
  private filePathToHash: Map<string, string>;

  /**
   * Create a new ParsingCache instance
   *
   * @param cacheDir - Directory path for cache storage
   */
  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.memoryCache = new Map();
    this.filePathToHash = new Map();
  }

  /**
   * Initialize the cache by loading existing entries from disk
   */
  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });

      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entry: CacheEntry = JSON.parse(content);

          // Load into memory cache
          this.memoryCache.set(entry.hash, entry);
        } catch (error) {
          // Skip corrupted cache files
          console.warn(`Failed to load cache file ${file}:`, error);
        }
      }
    } catch (error) {
      // Cache directory doesn't exist yet, that's fine
      console.warn('Failed to initialize cache directory:', error);
    }
  }

  /**
   * Compute SHA256 hash of file content
   *
   * @param filePath - Path to the file
   * @returns SHA256 hash as hex string
   */
  private async computeFileHash(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Get cache file path for a given hash
   *
   * @param hash - SHA256 hash
   * @returns Path to cache file
   */
  private getCacheFilePath(hash: string): string {
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * Get cached token for a file
   *
   * Returns null if:
   * - File doesn't exist
   * - File has been modified (hash mismatch)
   * - No cache entry exists
   *
   * @param filePath - Path to the source file
   * @returns Cached LIR token or null
   */
  async get(filePath: string): Promise<LIRToken | null> {
    // Lazy initialization
    if (this.memoryCache.size === 0) {
      await this.initialize();
    }

    // Compute current file hash
    const currentHash = await this.computeFileHash(filePath);
    if (currentHash === null) {
      return null;
    }

    // Check in-memory cache
    const entry = this.memoryCache.get(currentHash);
    if (entry) {
      return entry.token;
    }

    // Try to load from disk
    try {
      const cacheFilePath = this.getCacheFilePath(currentHash);
      const content = await fs.readFile(cacheFilePath, 'utf-8');
      const parsedEntry: CacheEntry = JSON.parse(content);

      // Verify hash matches
      if (parsedEntry.hash === currentHash) {
        // Load into memory for next time
        this.memoryCache.set(currentHash, parsedEntry);
        return parsedEntry.token;
      }
    } catch (error) {
      // Cache file doesn't exist or is corrupted
    }

    return null;
  }

  /**
   * Store a token in the cache
   *
   * Stores the token in both memory and disk. If the file content
   * changes, the hash will change and get() will return null.
   *
   * @param filePath - Path to the source file
   * @param token - LIR token to cache
   */
  async set(filePath: string, token: LIRToken): Promise<void> {
    try {
      // Lazy initialization
      if (this.memoryCache.size === 0) {
        await this.initialize();
      }

      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Compute file hash
      const hash = await this.computeFileHash(filePath);
      if (hash === null) {
        throw new Error(`Cannot compute hash for file: ${filePath}`);
      }

      // Create cache entry
      const entry: CacheEntry = { hash, token };

      // Store in memory
      this.memoryCache.set(hash, entry);
      this.filePathToHash.set(filePath, hash);

      // Persist to disk
      const cacheFilePath = this.getCacheFilePath(hash);
      await fs.writeFile(cacheFilePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Cache write failed: ${message}`);
    }
  }

  /**
   * Clear all cached entries
   *
   * Removes all entries from memory and deletes all cache files from disk.
   */
  async clear(): Promise<void> {
    // Clear in-memory caches
    this.memoryCache.clear();
    this.filePathToHash.clear();

    // Delete all cache files from disk
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter((f) => f.endsWith('.json'));

      await Promise.all(
        cacheFiles.map((file) =>
          fs.unlink(path.join(this.cacheDir, file)).catch(() => {
            // Ignore errors when deleting files
          })
        )
      );
    } catch (error) {
      // Cache directory doesn't exist or can't be read
      console.warn('Failed to clear cache directory:', error);
    }
  }
}
