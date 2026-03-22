/**
 * QualityArchive - Persistent storage layer for high-quality outputs.
 *
 * Manages JSON file read/write for the archive, storing items with
 * metadata (domain, quality score, timestamp, behavior vector).
 *
 * Companion to ArchiveLearning - this handles the storage layer.
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { Logger } from '../utils/Logger.js';

/**
 * Query options for archive searches.
 */
export interface ArchiveQueryOptions {
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum quality score filter */
  minQuality?: number;
  /** Minimum timestamp (ISO string) */
  since?: string;
  /** Sort by 'quality' (default) or 'recent' */
  sortBy?: 'quality' | 'recent';
}

/**
 * An archived output entry in storage.
 */
export interface ArchiveEntry {
  /** Unique identifier */
  id: string;
  /** Domain (e.g., 'p5', 'glsl', 'three', 'music') */
  domain: string;
  /** Original prompt that generated this output */
  prompt: string;
  /** The generated output (code, art, etc.) */
  output: string;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** ISO 8601 timestamp when created */
  createdAt: string;
  /** Number of times this example has been used */
  usedCount?: number;
  /** User rating if provided */
  userRating?: number;
}

/**
 * Archive data structure as stored in JSON file.
 */
interface ArchiveData {
  archives: Record<string, ArchiveEntry[]>;
  lastUpdated: string;
}

/**
 * Configuration for QualityArchive.
 */
export interface QualityArchiveConfig {
  /** Path to archive JSON file */
  path?: string;
  /** Minimum quality threshold for adding items */
  minQuality?: number;
  /** Maximum examples to keep per domain */
  maxExamplesPerDomain?: number;
}

/**
 * QualityArchive manages persistent storage of high-quality outputs.
 *
 * - Stores items in JSON file
 * - Organizes by domain
 * - Supports querying by domain, quality, recency
 * - Handles file I/O with error recovery
 */
export class QualityArchive {
  private path: string;
  private maxExamplesPerDomain: number;
  private cache: Map<string, ArchiveEntry[]>;

  /** Default minimum quality threshold */
  static readonly DEFAULT_MIN_QUALITY = 0.65;

  /** Default max examples per domain */
  static readonly DEFAULT_MAX_EXAMPLES = 20;

  /** Default archive path */
  static readonly DEFAULT_PATH = `${process.env.HOME}/.liminal/archive/quality_archive.json`;

  /**
   * Create a new QualityArchive instance.
   * @param config - Optional configuration
   */
  constructor(config: QualityArchiveConfig = {}) {
    this.path = config.path ?? QualityArchive.DEFAULT_PATH;
    this.maxExamplesPerDomain = config.maxExamplesPerDomain ?? QualityArchive.DEFAULT_MAX_EXAMPLES;
    this.cache = new Map();

    // Initialize archive with default domains
    this.cache.set('p5', []);
    this.cache.set('glsl', []);
    this.cache.set('three', []);
    this.cache.set('music', []);
  }

  /**
   * Load archive from disk.
   * Should be called after construction to populate the cache.
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.path, 'utf-8');
      const archiveData: ArchiveData = JSON.parse(data);

      // Populate cache from loaded data
      for (const [domain, entries] of Object.entries(archiveData.archives)) {
        this.cache.set(domain, entries);
      }

      const total = Array.from(this.cache.values()).reduce((sum, arr) => sum + arr.length, 0);
      Logger.info('QualityArchive', `Loaded ${total} archived outputs from ${this.path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet - that's fine
        Logger.info('QualityArchive', 'Archive file not found, starting fresh');
      } else {
        Logger.warn('QualityArchive', `Could not load archive: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Save archive to disk.
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.path), { recursive: true });

      const data: ArchiveData = {
        archives: Object.fromEntries(this.cache),
        lastUpdated: new Date().toISOString(),
      };

      await fs.writeFile(this.path, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      Logger.error('QualityArchive', `Error saving archive: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Add an entry to the archive.
   * @param entry - The entry to add
   */
  async add(entry: ArchiveEntry): Promise<void> {
    const domain = entry.domain;

    // Ensure domain exists in cache
    if (!this.cache.has(domain)) {
      this.cache.set(domain, []);
    }

    const entries = this.cache.get(domain)!;
    entries.push(entry);

    // Sort by quality (descending) and keep only the best
    entries.sort((a, b) => b.qualityScore - a.qualityScore);
    const trimmed = entries.slice(0, this.maxExamplesPerDomain);
    this.cache.set(domain, trimmed);

    // Persist to disk
    await this.save();
  }

  /**
   * Query entries by domain with filters.
   * @param domain - Domain to query
   * @param options - Query options
   * @returns Filtered and sorted entries
   */
  query(domain: string, options: ArchiveQueryOptions = {}): ArchiveEntry[] {
    let entries = this.cache.get(domain) ?? [];

    // Filter by minimum quality
    if (options.minQuality !== undefined) {
      entries = entries.filter(e => e.qualityScore >= options.minQuality!);
    }

    // Filter by recency
    if (options.since !== undefined) {
      const sinceDate = new Date(options.since);
      entries = entries.filter(e => new Date(e.createdAt) >= sinceDate);
    }

    // Sort
    const sortBy = options.sortBy ?? 'quality';
    if (sortBy === 'quality') {
      entries.sort((a, b) => b.qualityScore - a.qualityScore);
    } else if (sortBy === 'recent') {
      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Apply limit
    if (options.limit !== undefined) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Search across all domains by keywords.
   * @param query - Search query string
   * @param domain - Optional domain filter
   * @param limit - Max results (default: 10)
   * @returns Matching entries sorted by quality
   */
  search(query: string, domain?: string, limit = 10): ArchiveEntry[] {
    const queryLower = query.toLowerCase();
    const results: ArchiveEntry[] = [];

    const domainsToSearch = domain ? [domain] : Array.from(this.cache.keys());

    for (const d of domainsToSearch) {
      const entries = this.cache.get(d) ?? [];
      for (const entry of entries) {
        if (
          entry.prompt.toLowerCase().includes(queryLower) ||
          entry.output.toLowerCase().includes(queryLower)
        ) {
          results.push(entry);
        }
      }
    }

    // Sort by quality and limit
    results.sort((a, b) => b.qualityScore - a.qualityScore);
    return results.slice(0, limit);
  }

  /**
   * Record that an entry was used.
   * @param itemId - ID of the entry
   */
  async recordUsage(itemId: string): Promise<void> {
    for (const entries of this.cache.values()) {
      const entry = entries.find(e => e.id === itemId);
      if (entry) {
        entry.usedCount = (entry.usedCount ?? 0) + 1;
        await this.save();
        return;
      }
    }
  }

  /**
   * Add a user rating to an entry.
   * @param itemId - ID of the entry
   * @param rating - Rating value
   */
  async addUserRating(itemId: string, rating: number): Promise<void> {
    for (const entries of this.cache.values()) {
      const entry = entries.find(e => e.id === itemId);
      if (entry) {
        entry.userRating = rating;
        await this.save();
        return;
      }
    }
  }

  /**
   * Get archive statistics.
   * @returns Statistics object
   */
  getStats(): {
    totalOutputs: number;
    byDomain: Record<string, number>;
    avgQuality: Record<string, number>;
  } {
    const byDomain: Record<string, number> = {};
    const avgQuality: Record<string, number> = {};
    let total = 0;

    for (const [domain, entries] of this.cache) {
      const count = entries.length;
      byDomain[domain] = count;
      total += count;

      if (count > 0) {
        const sumQuality = entries.reduce((sum, e) => sum + e.qualityScore, 0);
        avgQuality[domain] = sumQuality / count;
      } else {
        avgQuality[domain] = 0;
      }
    }

    return { totalOutputs: total, byDomain, avgQuality };
  }

  /**
   * Export entries for fine-tuning.
   * @param domain - Optional domain filter
   * @param minQuality - Minimum quality threshold (default: 0.75)
   * @returns Array of training examples
   */
  exportForFinetuning(
    domain?: string,
    minQuality = 0.75
  ): Array<{
    prompt: string;
    completion: string;
    domain: string;
    qualityScore: number;
    metadata: Record<string, unknown>;
  }> {
    const trainingData: Array<{
      prompt: string;
      completion: string;
      domain: string;
      qualityScore: number;
      metadata: Record<string, unknown>;
    }> = [];

    const domainsToExport = domain ? [domain] : Array.from(this.cache.keys());

    for (const d of domainsToExport) {
      const entries = this.cache.get(d) ?? [];
      for (const entry of entries) {
        if (entry.qualityScore >= minQuality) {
          trainingData.push({
            prompt: entry.prompt,
            completion: entry.output,
            domain: entry.domain,
            qualityScore: entry.qualityScore,
            metadata: entry.metadata,
          });
        }
      }
    }

    return trainingData;
  }

  /**
   * Clear all entries from the archive.
   */
  async clear(): Promise<void> {
    for (const domain of this.cache.keys()) {
      this.cache.set(domain, []);
    }
    await this.save();
  }

  /**
   * Get all entries for a domain.
   * @param domain - Domain to get entries for
   * @returns All entries for the domain
   */
  getAll(domain: string): ArchiveEntry[] {
    return this.cache.get(domain) ?? [];
  }

  /**
   * Get an entry by ID.
   * @param itemId - ID of the entry
   * @returns The entry if found, undefined otherwise
   */
  getById(itemId: string): ArchiveEntry | undefined {
    for (const entries of this.cache.values()) {
      const entry = entries.find(e => e.id === itemId);
      if (entry) {
        return entry;
      }
    }
    return undefined;
  }
}
