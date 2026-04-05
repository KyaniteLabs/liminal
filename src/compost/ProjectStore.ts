/**
 * ProjectStore — High-level creative history API for Liminal.
 *
 * Wraps EventStore (timeline/versioning) and AssetStore (binary storage)
 * into a single facade that CompostMill and the CLI can use without
 * knowing about SQLite or content-addressable storage internals.
 *
 * This is the public interface for Liminal's "creative memory." Every
 * significant compost operation should flow through here so that the
 * event timeline is always complete.
 *
 * Lifecycle:
 * 1. `ProjectStore.init(projectRoot)` — creates .liminal/ and project.liminal
 * 2. Pass the ProjectStore to CompostMill (or use it directly from CLI)
 * 3. Call recording methods on each pipeline stage
 * 4. Call `close()` when shutting down
 *
 * @module compost/ProjectStore
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventStore } from './EventStore.js';
import type { CompostEvent, EventType, TimelineEntry, UndoResult, Branch, Snapshot } from './EventStore.js';
import { AssetStore } from './AssetStore.js';
import type { StoredAsset } from './AssetStore.js';
import type { Seed, DigestStats } from './types.js';
import { Logger } from '../utils/Logger.js';

/** Configuration for the ProjectStore. */
export interface ProjectStoreConfig {
  /** Path to the project root directory. */
  projectRoot: string;
  /** Subdirectory name (default: '.liminal'). */
  dataDir?: string;
  /** Database filename (default: 'project.liminal'). */
  dbFilename?: string;
  /** Snapshot every N events (default: 50). */
  snapshotInterval?: number;
}

/** Result of initializing a ProjectStore. */
export interface ProjectInitResult {
  /** Whether the project was created fresh (vs. opened existing). */
  isNew: boolean;
  /** Path to the database file. */
  dbPath: string;
  /** Path to the objects directory. */
  objectsDir: string;
  /** Stats about existing data (empty if new). */
  stats: ReturnType<EventStore['getStats']>;
}

/** Formatted timeline output for CLI display. */
export interface FormattedTimeline {
  entries: TimelineEntry[];
  totalCount: number;
  branchName: string;
}

/**
 * The main interface for Liminal's creative history system.
 *
 * Usage from CompostMill:
 * ```ts
 * const projectStore = new ProjectStore({ projectRoot: process.cwd() });
 * projectStore.init();
 *
 * // In CompostMill.add()
 * projectStore.recordHeapAdd(['sketch.js', 'shader.glsl'], 4096);
 *
 * // In CompostMill.digest()
 * projectStore.recordDigestStart(filePaths);
 * // ... pipeline runs ...
 * projectStore.recordDigestEnd(stats, promotedSeeds);
 * projectStore.saveSnapshot(seedBankContents, heapState);
 *
 * // In CLI
 * projectStore.timeline({ limit: 20 });
 * projectStore.undo();
 * projectStore.createBranch('experiment');
 *
 * projectStore.close();
 * ```
 */
export class ProjectStore {
  private readonly eventStore: EventStore;
  private readonly assetStore: AssetStore;
  private readonly projectRoot: string;
  private initialized = false;
  private wasNew = false;

  constructor(config: ProjectStoreConfig) {
    this.projectRoot = config.projectRoot;

    // Check if DB exists BEFORE constructing EventStore (constructor creates the file)
    const dirName = config.dataDir ?? '.liminal';
    const dbPath = join(config.projectRoot, dirName, config.dbFilename ?? 'project.liminal');
    this.wasNew = !existsSync(dbPath);

    this.eventStore = new EventStore({
      projectRoot: config.projectRoot,
      dataDir: config.dataDir,
      dbFilename: config.dbFilename,
      snapshotInterval: config.snapshotInterval,
    });
    this.assetStore = new AssetStore(this.eventStore);
  }

  /** Ensure init was called before use. */
  private ensureInit(): void {
    if (!this.initialized) {
      throw new Error('ProjectStore not initialized. Call init() first.');
    }
  }

  /**
   * Initialize the project store. Creates .liminal/ directory and database
   * if they don't exist. Safe to call multiple times.
   *
   * @returns Information about the initialized project.
   */
  init(): ProjectInitResult {
    const isNew = this.wasNew;

    this.eventStore.init();
    this.initialized = true;

    Logger.info('ProjectStore', isNew ? 'Created new project store' : 'Opened existing project store');

    return {
      isNew,
      dbPath: this.eventStore.getDbPath(),
      objectsDir: this.eventStore.getObjectsDir(),
      stats: this.eventStore.getStats(),
    };
  }

  // ─── Recording Methods (called by CompostMill) ─────────────────────────

  /**
   * Record that files were added to the heap.
   */
  recordHeapAdd(files: string[], totalBytes: number): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('heap_add', { files, totalBytes, fileCount: files.length });
  }

  /**
   * Record that a digestion pipeline started.
   */
  recordDigestStart(filePaths: string[]): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('digest_start', {
      fileCount: filePaths.length,
      files: filePaths,
    });
  }

  /**
   * Record that a digestion pipeline completed with results.
   */
  recordDigestEnd(stats: DigestStats, seeds: Seed[]): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('digest_end', {
      filesProcessed: stats.filesProcessed,
      totalBytes: stats.totalBytes,
      fragmentCount: stats.fragmentCount,
      collisionCount: stats.collisionCount,
      seedsPromoted: stats.seedsPromoted,
      domains: stats.domains,
      durationMs: stats.durationMs,
      seedIds: seeds.map(s => s.id),
      seedScores: seeds.map(s => ({ id: s.id, score: s.score })),
    });
  }

  /**
   * Record that a seed was promoted from a fragment.
   */
  recordSeedPromotion(seed: Seed): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('seed_promote', {
      seedId: seed.id,
      content: seed.content.slice(0, 200), // First 200 chars for the timeline
      score: seed.score,
      domains: seed.source.domains,
      collisionType: seed.source.collisionType,
    });
  }

  /**
   * Record that seeds were pruned due to retention policy.
   */
  recordSeedPrune(count: number, retentionDays: number): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('seed_prune', { count, retentionDays });
  }

  /**
   * Record that the evolutionary soup started.
   */
  recordSoupStart(populationSize: number): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('soup_start', { populationSize });
  }

  /**
   * Record that the evolutionary soup stopped.
   */
  recordSoupStop(totalCycles: number, totalSeedsPromoted: number): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('soup_stop', { totalCycles, totalSeedsPromoted });
  }

  /**
   * Record a single soup cycle.
   */
  recordSoupCycle(cycle: number, score: number, promoted: boolean, domains: [string, string]): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('soup_cycle', { cycle, score, promoted, domains });
  }

  /**
   * Record that a seed was consumed by a generator.
   */
  recordSeedUse(seedId: string, functionName: string, useCount: number): CompostEvent {
    this.ensureInit();
    return this.eventStore.append('seed_use', { seedId, functionName, useCount });
  }

  // ─── Asset Operations ──────────────────────────────────────────────────

  /**
   * Store a binary asset (image, audio, shader, etc.) and register it.
   */
  storeAsset(filePath: string): StoredAsset {
    this.ensureInit();
    return this.assetStore.storeFile(filePath);
  }

  /**
   * Store raw content as an asset.
   */
  storeAssetContent(content: Buffer | string, filename: string, type: string): StoredAsset {
    this.ensureInit();
    return this.assetStore.storeContent(content, filename, type);
  }

  /**
   * Retrieve an asset's content by hash.
   */
  getAssetContent(hash: string): Buffer | null {
    this.ensureInit();
    return this.assetStore.getContent(hash);
  }

  // ─── Timeline & History ────────────────────────────────────────────────

  /**
   * Get a formatted timeline of events for CLI display.
   */
  getTimeline(options: { limit?: number; offset?: number; branch?: string } = {}): FormattedTimeline {
    this.ensureInit();
    const branch = options.branch ?? this.eventStore.getActiveBranch();
    const entries = this.eventStore.timeline({
      branch,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });
    return {
      entries,
      totalCount: this.eventStore.getEventCount(branch),
      branchName: branch,
    };
  }

  /**
   * Get events of a specific type (e.g., all digest_end events).
   */
  getEventsByType(type: EventType, limit?: number): CompostEvent[] {
    this.ensureInit();
    return this.eventStore.queryEvents({ type, limit });
  }

  /**
   * Get all events in a date range.
   */
  getEventsInRange(from: string, to: string, limit?: number): CompostEvent[] {
    this.ensureInit();
    return this.eventStore.queryEvents({ fromTimestamp: from, toTimestamp: to, limit });
  }

  /**
   * Get the most recent digest result events.
   */
  getRecentDigests(count: number): CompostEvent[] {
    return this.getEventsByType('digest_end', count);
  }

  // ─── Snapshots ─────────────────────────────────────────────────────────

  /**
   * Save a snapshot of the current creative state. This should be called
   * after significant operations (digestion, soup cycle) to enable efficient
   * time-travel queries.
   *
   * @param seeds — Current seed bank contents (serializable)
   * @param heapSize — Current heap size in bytes
   * @param extraState — Any additional state to snapshot
   */
  saveSnapshot(seeds: Seed[], heapSize: number, extraState?: Record<string, unknown>): void {
    this.ensureInit();
    this.eventStore.saveSnapshot({
      seedCount: seeds.length,
      heapSize,
      seedIds: seeds.map(s => s.id),
      seedScores: seeds.map(s => ({ id: s.id, score: s.score })),
      ...extraState,
    });

    // Also record a snapshot event for the timeline
    this.eventStore.append('snapshot', {
      seedCount: seeds.length,
      heapSize,
    });
  }

  /**
   * Get the latest snapshot for the current branch.
   */
  getLatestSnapshot(): Snapshot | null {
    this.ensureInit();
    return this.eventStore.getLatestSnapshot();
  }

  // ─── Branching ─────────────────────────────────────────────────────────

  /**
   * Create a named branch for creative experimentation.
   * The branch starts at the current position in the event log.
   */
  createBranch(name: string, description?: string): Branch {
    this.ensureInit();
    return this.eventStore.createBranch(name, description);
  }

  /**
   * Switch to a named branch.
   */
  switchBranch(name: string): void {
    this.ensureInit();
    this.eventStore.switchBranch(name);
  }

  /**
   * List all branches.
   */
  listBranches(): Branch[] {
    this.ensureInit();
    return this.eventStore.listBranches();
  }

  /**
   * Delete a branch (cannot delete 'main' or active branch).
   */
  deleteBranch(name: string): void {
    this.ensureInit();
    this.eventStore.deleteBranch(name);
  }

  /**
   * Get the active branch name.
   */
  getActiveBranch(): string {
    return this.eventStore.getActiveBranch();
  }

  // ─── Undo ──────────────────────────────────────────────────────────────

  /**
   * Undo the most recent creative operation on the current branch.
   *
   * Only creative operations (digest, seed, soup) can be undone —
   * structural events (branch_create, branch_switch) cannot.
   */
  undo(): UndoResult {
    this.ensureInit();
    return this.eventStore.undo();
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  /**
   * Get aggregate statistics about the project's history.
   */
  getStats(): ReturnType<EventStore['getStats']> {
    this.ensureInit();
    return this.eventStore.getStats();
  }

  /**
   * Get a formatted summary string for CLI display.
   */
  getStatusSummary(): string {
    const stats = this.getStats();
    const branch = this.getActiveBranch();
    const lines = [
      `Project: ${this.projectRoot}`,
      `Branch: ${branch}`,
      `Events: ${stats.activeEvents} active (${stats.undoneEvents} undone)`,
      `Branches: ${stats.branchCount}`,
      `Snapshots: ${stats.snapshotCount}`,
      `Assets: ${stats.assetCount} (${formatBytes(stats.dbSizeBytes)} database)`,
      `Time range: ${stats.oldestEvent ?? 'no events'} → ${stats.newestEvent ?? 'now'}`,
    ];

    // Event type breakdown
    const typeEntries = Object.entries(stats.eventTypes);
    if (typeEntries.length > 0) {
      lines.push('');
      lines.push('Event breakdown:');
      for (const [type, count] of typeEntries.sort((a, b) => b[1] - a[1])) {
        lines.push(`  ${type}: ${count}`);
      }
    }

    return lines.join('\n');
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Close the project store and flush to disk.
   */
  close(): void {
    if (this.initialized) {
      this.eventStore.close();
      this.initialized = false;
    }
  }

  /**
   * Get the underlying EventStore (for advanced use).
   */
  getEventStore(): EventStore {
    return this.eventStore;
  }

  /**
   * Get the underlying AssetStore (for advanced use).
   */
  getAssetStore(): AssetStore {
    return this.assetStore;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
