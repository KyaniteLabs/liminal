/**
 * EventStore — SQLite-backed event sourcing for the Compost Mill.
 *
 * Every compost operation (add files, digest, promote seeds, run soup cycles,
 * prune) is recorded as an immutable event in an append-only log. This gives
 * Liminal something it has never had: a timeline. Users can:
 *
 *   - Inspect what happened and when  (timeline / log)
 *   - Undo the most recent operation   (undo)
 *   - Branch the seed bank for experiments (branch / switch)
 *   - Query project state at any past date (state-at)
 *
 * Architecture
 * ────────────
 * The store is a single SQLite database per project (project.liminal).
 * Tables:
 *
 *   events     — append-only log of all compost operations
 *   snapshots  — materialized state at intervals (avoids full replay)
 *   branches   — named pointers to event IDs (lightweight branching)
 *   assets     — content-addressable blob registry (hash → metadata)
 *
 * Events are JSON payloads with a mandatory `type` discriminator.
 * Snapshots are taken every N events (configurable, default 50) so that
 * reconstructing past state does not require replaying the entire log.
 *
 * Thread safety: better-sqlite3 is synchronous and serialized — no concurrent
 * write concerns. The database is opened once and reused.
 *
 * @module compost/EventStore
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Discriminator for event payloads. Each type maps to a compost operation. */
export type EventType =
  | 'heap_add'          // Files added to the heap
  | 'digest_start'      // Digestion pipeline started
  | 'digest_end'        // Digestion pipeline completed
  | 'seed_promote'      // A fragment was promoted to a seed
  | 'seed_prune'        // Seeds were pruned (retention cleanup)
  | 'soup_start'        // Evolutionary soup started
  | 'soup_stop'         // Evolutionary soup stopped
  | 'soup_cycle'        // A single soup cycle completed
  | 'seed_use'          // A seed was consumed by a generator
  | 'branch_create'     // A named branch was created
  | 'branch_switch'     // Active branch was switched
  | 'snapshot'          // A state snapshot was taken
  | 'undo'              // The last event was rolled back
  | 'config_change'      // Compost config was changed
  | 'git_commit'         // A git commit was made via GitIntegration
  | 'git_branch';        // A git branch was created via GitIntegration

/** An immutable event in the compost timeline. */
export interface CompostEvent {
  /** Monotonically increasing event ID (SQLite rowid). */
  id: number;
  /** What happened. */
  type: EventType;
  /** JSON payload — shape depends on `type`. */
  payload: Record<string, unknown>;
  /** ISO 8601 timestamp of when the event was recorded. */
  timestamp: string;
  /** Name of the branch this event belongs to. */
  branch: string;
  /** SHA256 hash of the payload (integrity check). */
  payloadHash: string;
}

/** A materialized snapshot of compost state at a point in time. */
export interface Snapshot {
  /** Event ID this snapshot was taken after. */
  afterEventId: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Serialized state (seed bank contents, heap state, etc.). */
  state: Record<string, unknown>;
  /** Branch name this snapshot belongs to. */
  branch: string;
}

/** A named branch pointing to a specific point in the event log. */
export interface Branch {
  /** Human-readable branch name. */
  name: string;
  /** Event ID this branch points to. */
  eventId: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** Whether this is the currently active branch. */
  isActive: boolean;
  /** Optional description. */
  description?: string;
}

/** Configuration for the EventStore. */
export interface EventStoreConfig {
  /** Path to the project root directory. */
  projectRoot: string;
  /** Subdirectory name for Liminal data (default: '.liminal'). */
  dataDir?: string;
  /** Database filename (default: 'project.liminal'). */
  dbFilename?: string;
  /** Take a snapshot every N events (default: 50). */
  snapshotInterval?: number;
}

/** Result of an undo operation. */
export interface UndoResult {
  /** The event that was undone. */
  undoneEvent: CompostEvent;
  /** Number of events remaining on this branch. */
  remainingEvents: number;
  /** Whether a snapshot needs to be re-taken. */
  needsSnapshot: boolean;
}

/** Result of a timeline query. */
export interface TimelineEntry {
  event: CompostEvent;
  /** Human-readable description of what happened. */
  description: string;
  /** Time delta from the previous event (ms). */
  deltaMs: number | null;
}

// ─── SQL Schema ─────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  -- Append-only event log. Every compost operation creates one row.
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL,
    payload    TEXT    NOT NULL,  -- JSON
    timestamp  TEXT    NOT NULL,  -- ISO 8601
    branch     TEXT    NOT NULL DEFAULT 'main',
    payload_hash TEXT  NOT NULL,  -- SHA256 of payload
    undone     INTEGER NOT NULL DEFAULT 0  -- 0 = active, 1 = undone
  );

  -- Index for common query patterns
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  CREATE INDEX IF NOT EXISTS idx_events_branch ON events(branch);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_undone ON events(undone);

  -- Materialized state snapshots (avoid full replay)
  CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    after_event_id INTEGER NOT NULL,
    timestamp   TEXT    NOT NULL,
    state       TEXT    NOT NULL,  -- JSON
    branch      TEXT    NOT NULL DEFAULT 'main'
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_branch ON snapshots(branch);

  -- Named branches (lightweight forking)
  CREATE TABLE IF NOT EXISTS branches (
    name        TEXT    PRIMARY KEY,
    event_id    INTEGER NOT NULL,
    created_at  TEXT    NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 0,
    description TEXT
  );

  -- Content-addressable asset registry
  CREATE TABLE IF NOT EXISTS assets (
    hash        TEXT    PRIMARY KEY,  -- SHA256
    filename    TEXT    NOT NULL,
    type        TEXT    NOT NULL,  -- MIME type or extension
    size        INTEGER NOT NULL,
    first_seen  TEXT    NOT NULL,
    metadata    TEXT    DEFAULT '{}'  -- JSON
  );

  -- Store metadata: schema version, creation date
  CREATE TABLE IF NOT EXISTS store_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const META_SQL = `
  INSERT OR IGNORE INTO store_meta (key, value) VALUES
    ('schema_version', '1'),
    ('created_at', '${new Date().toISOString()}');
`;

// ─── EventStore Class ───────────────────────────────────────────────────────

/**
 * SQLite-backed event store for the Compost Mill.
 *
 * Provides an append-only timeline of all compost operations with support for
 * snapshots, branching, undo, and time-based queries.
 *
 * Usage:
 * ```ts
 * const store = new EventStore({ projectRoot: '/path/to/project' });
 * store.init();
 *
 * // Record events
 * store.append('heap_add', { files: ['sketch.js'], totalBytes: 2048 });
 * store.append('digest_end', { filesProcessed: 5, seedsPromoted: 3 });
 *
 * // Query timeline
 * const timeline = store.timeline({ limit: 10 });
 * for (const entry of timeline) {
 *   console.log(`${entry.event.timestamp} — ${entry.description}`);
 * }
 *
 * // Undo last action
 * store.undo();
 *
 * // Branch for experiments
 * store.createBranch('wild-shader-idea', 'Trying a new color collision strategy');
 * store.switchBranch('wild-shader-idea');
 * ```
 */
export class EventStore {
  private db: Database.Database;
  private readonly dataDir: string;
  private readonly dbPath: string;
  private readonly snapshotInterval: number;
  private eventsSinceSnapshot = 0;
  private currentBranch = 'main';
  private initialized = false;

  constructor(config: EventStoreConfig) {
    const dirName = config.dataDir ?? '.liminal';
    this.dataDir = join(config.projectRoot, dirName);
    this.dbPath = join(this.dataDir, config.dbFilename ?? 'project.liminal');
    this.snapshotInterval = config.snapshotInterval ?? 50;

    // Ensure data directory exists
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    // Also create the objects directory for content-addressable storage
    const objectsDir = join(this.dataDir, 'objects');
    if (!existsSync(objectsDir)) {
      mkdirSync(objectsDir, { recursive: true });
    }

    // Open database (creates file if it doesn't exist)
    this.db = new Database(this.dbPath);
    // WAL mode for better read concurrency and crash safety
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  /**
   * Initialize the database schema. Safe to call multiple times — uses
   * IF NOT EXISTS for all DDL statements.
   */
  init(): void {
    if (this.initialized) return;

    this.db.exec(SCHEMA_SQL);
    this.db.exec(META_SQL);

    // Ensure 'main' branch exists
    const mainBranch = this.db
      .prepare('SELECT name FROM branches WHERE name = ?')
      .get('main') as { name: string } | undefined;

    if (!mainBranch) {
      const now = new Date().toISOString();
      this.db.prepare(
        `INSERT INTO branches (name, event_id, created_at, is_active, description)
         VALUES ('main', 0, ?, 1, 'Default branch')`
      ).run(now);
    } else {
      // Mark main as active on re-open
      this.db.prepare('UPDATE branches SET is_active = 1 WHERE name = ?').run('main');
    }

    // Load current branch
    const active = this.db
      .prepare('SELECT name FROM branches WHERE is_active = 1')
      .get() as { name: string } | undefined;
    if (active) {
      this.currentBranch = active.name;
    }

    this.initialized = true;
  }

  // ─── Event Operations ──────────────────────────────────────────────────

  /**
   * Append an event to the timeline. Returns the created event with its
   * auto-generated ID and timestamp.
   *
   * Events are immutable once appended. The only way to "remove" an event
   * is via undo(), which marks it as undone (soft delete).
   */
  append(type: EventType, payload: Record<string, unknown>, branch?: string): CompostEvent {
    const timestamp = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    const payloadHash = sha256(payloadJson);
    const targetBranch = branch ?? this.currentBranch;

    // Validate branch name if provided explicitly
    if (branch) {
      this.validateBranchName(branch);
    }

    const result = this.db.prepare(
      `INSERT INTO events (type, payload, timestamp, branch, payload_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).run(type, payloadJson, timestamp, targetBranch, payloadHash);

    const id = Number(result.lastInsertRowid);

    // Update branch pointer to latest event
    this.db.prepare('UPDATE branches SET event_id = ? WHERE name = ?')
      .run(id, targetBranch);

    // Track snapshot interval
    this.eventsSinceSnapshot++;
    if (this.eventsSinceSnapshot >= this.snapshotInterval) {
      this.eventsSinceSnapshot = 0;
      // Snapshot will be taken by ProjectStore when it has state to materialize
    }

    return {
      id,
      type,
      payload,
      timestamp,
      branch: targetBranch,
      payloadHash,
    };
  }

  /**
   * Append multiple events in a single transaction. If any insert fails,
   * all are rolled back.
   */
  appendBatch(events: Array<{ type: EventType; payload: Record<string, unknown> }>): CompostEvent[] {
    const transaction = this.db.transaction(() => {
      return events.map(({ type, payload }) => this.append(type, payload));
    });
    return transaction();
  }

  // ─── Query Operations ──────────────────────────────────────────────────

  /**
   * Get a single event by ID.
   */
  getEvent(id: number): CompostEvent | null {
    const row = this.db
      .prepare('SELECT * FROM events WHERE id = ? AND undone = 0')
      .get(id) as EventRow | undefined;
    return row ? rowToEvent(row) : null;
  }

  /**
   * Query events with flexible filters.
   */
  queryEvents(filters: {
    type?: EventType;
    branch?: string;
    fromTimestamp?: string;
    toTimestamp?: string;
    limit?: number;
    offset?: number;
    includeUndone?: boolean;
  } = {}): CompostEvent[] {
    const clauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (!filters.includeUndone) {
      clauses.push('undone = 0');
    }
    if (filters.type) {
      clauses.push('type = ?');
      params.push(filters.type);
    }
    if (filters.branch) {
      clauses.push('branch = ?');
      params.push(filters.branch);
    }
    if (filters.fromTimestamp) {
      clauses.push('timestamp >= ?');
      params.push(filters.fromTimestamp);
    }
    if (filters.toTimestamp) {
      clauses.push('timestamp <= ?');
      params.push(filters.toTimestamp);
    }

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const sql = `SELECT * FROM events WHERE ${clauses.join(' AND ')}
                  ORDER BY id DESC LIMIT ? OFFSET ?`;

    const rows = this.db.prepare(sql).all(...params, limit, offset) as EventRow[];
    return rows.map(rowToEvent);
  }

  /**
   * Get the total count of events (active only, unless includeUndone).
   */
  getEventCount(branch?: string, includeUndone = false): number {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (!includeUndone) {
      clauses.push('undone = 0');
    }
    if (branch) {
      clauses.push('branch = ?');
      params.push(branch);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = this.db.prepare(`SELECT COUNT(*) as count FROM events ${where}`)
      .get(...params) as { count: number };
    return result.count;
  }

  /**
   * Get the most recent N events, newest first.
   */
  getRecent(count: number, branch?: string): CompostEvent[] {
    return this.queryEvents({ branch, limit: count });
  }

  /**
   * Get the latest event of a specific type.
   */
  getLatestByType(type: EventType, branch?: string): CompostEvent | null {
    const events = this.queryEvents({ type, branch, limit: 1 });
    return events[0] ?? null;
  }

  // ─── Timeline ──────────────────────────────────────────────────────────

  /**
   * Get a human-readable timeline of events. Each entry includes a
   * natural-language description and time delta from the previous event.
   */
  timeline(options: {
    branch?: string;
    limit?: number;
    offset?: number;
  } = {}): TimelineEntry[] {
    const events = this.queryEvents({
      branch: options.branch ?? this.currentBranch,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    // Reverse to chronological order for delta calculation
    const chronological = [...events].reverse();

    return chronological.map((event, i) => {
      const prev = chronological[i - 1];
      const deltaMs = prev
        ? new Date(event.timestamp).getTime() - new Date(prev.timestamp).getTime()
        : null;

      return {
        event,
        description: describeEvent(event),
        deltaMs,
      };
    }).reverse(); // Back to newest-first
  }

  // ─── Snapshots ─────────────────────────────────────────────────────────

  /**
   * Save a materialized state snapshot. This avoids replaying the entire
   * event log when reconstructing past state.
   *
   * @param state — Serializable state (seed bank contents, heap state, etc.)
   */
  saveSnapshot(state: Record<string, unknown>): void {
    const lastEvent = this.getLatestEvent();
    if (!lastEvent) return;

    this.db.prepare(
      `INSERT INTO snapshots (after_event_id, timestamp, state, branch)
       VALUES (?, ?, ?, ?)`
    ).run(lastEvent.id, new Date().toISOString(), JSON.stringify(state), this.currentBranch);
  }

  /**
   * Get the most recent snapshot for a branch.
   */
  getLatestSnapshot(branch?: string): Snapshot | null {
    const row = this.db.prepare(
      `SELECT * FROM snapshots WHERE branch = ?
       ORDER BY after_event_id DESC LIMIT 1`
    ).get(branch ?? this.currentBranch) as SnapshotRow | undefined;

    if (!row) return null;

    return {
      afterEventId: row.after_event_id,
      timestamp: row.timestamp,
      state: JSON.parse(row.state),
      branch: row.branch,
    };
  }

  /**
   * Get the snapshot closest to a given event ID. Used for efficient
   * state reconstruction at arbitrary points in time.
   */
  getSnapshotBefore(eventId: number, branch?: string): Snapshot | null {
    const row = this.db.prepare(
      `SELECT * FROM snapshots WHERE branch = ? AND after_event_id < ?
       ORDER BY after_event_id DESC LIMIT 1`
    ).get(branch ?? this.currentBranch, eventId) as SnapshotRow | undefined;

    if (!row) return null;

    return {
      afterEventId: row.after_event_id,
      timestamp: row.timestamp,
      state: JSON.parse(row.state),
      branch: row.branch,
    };
  }

  // ─── Branches ──────────────────────────────────────────────────────────

  /**
   * Create a named branch at the current position in the event log.
   * The branch starts with the same state as the current branch.
   */
  createBranch(name: string, description?: string): Branch {
    if (name === 'main') {
      throw new Error("Cannot create a branch named 'main' — it is the default branch");
    }

    // Validate branch name to prevent SQL injection
    this.validateBranchName(name);

    const existing = this.db.prepare('SELECT name FROM branches WHERE name = ?').get(name);
    if (existing) {
      throw new Error(`Branch '${name}' already exists`);
    }

    const lastEvent = this.getLatestEvent();
    const eventId = lastEvent?.id ?? 0;
    const now = new Date().toISOString();

    this.db.prepare(
      `INSERT INTO branches (name, event_id, created_at, is_active, description)
       VALUES (?, ?, ?, 0, ?)`
    ).run(name, eventId, now, description ?? null);

    // Record the branch creation as an event on the current branch
    this.append('branch_create', {
      branchName: name,
      fromEventId: eventId,
      description,
    });

    return {
      name,
      eventId,
      createdAt: now,
      isActive: false,
      description: description ?? undefined,
    };
  }

  /**
   * Switch to a named branch. All subsequent append() calls will
   * write to this branch.
   */
  switchBranch(name: string): void {
    // Validate branch name to prevent SQL injection
    this.validateBranchName(name);

    const branch = this.db.prepare('SELECT * FROM branches WHERE name = ?')
      .get(name) as BranchRow | undefined;

    if (!branch) {
      throw new Error(`Branch '${name}' does not exist. Create it first with createBranch().`);
    }

    // Deactivate all, activate target
    const transaction = this.db.transaction(() => {
      this.db.prepare('UPDATE branches SET is_active = 0').run();
      this.db.prepare('UPDATE branches SET is_active = 1 WHERE name = ?').run(name);
    });
    transaction();

    const prevBranch = this.currentBranch;
    this.currentBranch = name;

    // Record the switch
    this.append('branch_switch', { from: prevBranch, to: name });
  }

  /**
   * List all branches with their current positions.
   */
  listBranches(): Branch[] {
    const rows = this.db.prepare('SELECT * FROM branches ORDER BY created_at')
      .all() as BranchRow[];

    return rows.map((row) => ({
      name: row.name,
      eventId: row.event_id,
      createdAt: row.created_at,
      isActive: row.is_active === 1,
      description: row.description ?? undefined,
    }));
  }

  /**
   * Delete a branch. Cannot delete 'main' or the currently active branch.
   */
  deleteBranch(name: string): void {
    if (name === 'main') {
      throw new Error("Cannot delete the 'main' branch");
    }
    if (name === this.currentBranch) {
      throw new Error("Cannot delete the currently active branch. Switch to another first.");
    }

    // Validate branch name to prevent SQL injection
    this.validateBranchName(name);

    this.db.prepare('DELETE FROM branches WHERE name = ?').run(name);
  }

  /**
   * Get the name of the currently active branch.
   */
  getActiveBranch(): string {
    return this.currentBranch;
  }

  // ─── Undo ──────────────────────────────────────────────────────────────

  /**
   * Undo the most recent event on the current branch. Marks the event as
   * undone (soft delete). Returns the undone event and remaining count.
   *
   * Note: undo is a soft operation — the event remains in the log but is
   * excluded from queries. This preserves the audit trail.
   */
  undo(): UndoResult {
    const lastEvent = this.db.prepare(
      `SELECT * FROM events WHERE branch = ? AND undone = 0 ORDER BY id DESC LIMIT 1`
    ).get(this.currentBranch) as EventRow | undefined;

    if (!lastEvent) {
      throw new Error('No events to undo on the current branch');
    }

    // Don't undo structural events (branch_create, branch_switch, undo)
    const structuralTypes: EventType[] = ['branch_create', 'branch_switch', 'undo', 'snapshot'];
    if (structuralTypes.includes(lastEvent.type as EventType)) {
      throw new Error(
        `Cannot undo '${lastEvent.type}' events — they are structural. ` +
        `Only creative operations (digest, seed, soup) can be undone.`
      );
    }

    // Mark as undone
    this.db.prepare('UPDATE events SET undone = 1 WHERE id = ?').run(lastEvent.id);

    // Update branch pointer to the previous active event
    const prevEvent = this.db.prepare(
      `SELECT id FROM events WHERE branch = ? AND undone = 0 ORDER BY id DESC LIMIT 1`
    ).get(this.currentBranch) as { id: number } | undefined;

    if (prevEvent) {
      this.db.prepare('UPDATE branches SET event_id = ? WHERE name = ?')
        .run(prevEvent.id, this.currentBranch);
    }

    // Record the undo itself as an event
    this.append('undo', { undoneEventId: lastEvent.id, undoneType: lastEvent.type });

    const remaining = this.getEventCount(this.currentBranch);

    return {
      undoneEvent: rowToEvent(lastEvent),
      remainingEvents: remaining,
      needsSnapshot: true, // Caller should re-snapshot after undo
    };
  }

  // ─── Asset Registry ────────────────────────────────────────────────────

  /**
   * Register a binary asset (image, audio, shader, etc.) by its SHA256 hash.
   * Assets are stored in .liminal/objects/<hash-prefix>/<hash> on disk.
   * This registry maps hashes to human-readable metadata.
   */
  registerAsset(info: {
    hash: string;
    filename: string;
    type: string;
    size: number;
    metadata?: Record<string, unknown>;
  }): void {
    this.db.prepare(
      `INSERT OR IGNORE INTO assets (hash, filename, type, size, first_seen, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      info.hash,
      info.filename,
      info.type,
      info.size,
      new Date().toISOString(),
      JSON.stringify(info.metadata ?? {}),
    );
  }

  /**
   * Look up an asset by its SHA256 hash.
   */
  getAsset(hash: string): { hash: string; filename: string; type: string; size: number; metadata: Record<string, unknown> } | null {
    const row = this.db.prepare('SELECT * FROM assets WHERE hash = ?')
      .get(hash) as AssetRow | undefined;

    if (!row) return null;

    return {
      hash: row.hash,
      filename: row.filename,
      type: row.type,
      size: row.size,
      metadata: JSON.parse(row.metadata),
    };
  }

  /**
   * List all registered assets, optionally filtered by type.
   */
  listAssets(typeFilter?: string): Array<{ hash: string; filename: string; type: string; size: number }> {
    if (typeFilter) {
      return this.db.prepare('SELECT hash, filename, type, size FROM assets WHERE type = ?')
        .all(typeFilter) as Array<{ hash: string; filename: string; type: string; size: number }>;
    }
    return this.db.prepare('SELECT hash, filename, type, size FROM assets')
      .all() as Array<{ hash: string; filename: string; type: string; size: number }>;
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  /**
   * Get aggregate statistics about the event store.
   */
  getStats(): {
    totalEvents: number;
    activeEvents: number;
    undoneEvents: number;
    eventTypes: Record<string, number>;
    branchCount: number;
    snapshotCount: number;
    assetCount: number;
    oldestEvent: string | null;
    newestEvent: string | null;
    dbSizeBytes: number;
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c;
    const active = (this.db.prepare('SELECT COUNT(*) as c FROM events WHERE undone = 0').get() as { c: number }).c;
    const undone = total - active;
    const branches = (this.db.prepare('SELECT COUNT(*) as c FROM branches').get() as { c: number }).c;
    const snapshots = (this.db.prepare('SELECT COUNT(*) as c FROM snapshots').get() as { c: number }).c;
    const assets = (this.db.prepare('SELECT COUNT(*) as c FROM assets').get() as { c: number }).c;

    // Event type distribution
    const typeRows = this.db.prepare(
      'SELECT type, COUNT(*) as c FROM events WHERE undone = 0 GROUP BY type ORDER BY c DESC'
    ).all() as Array<{ type: string; c: number }>;
    const eventTypes: Record<string, number> = {};
    for (const row of typeRows) {
      eventTypes[row.type] = row.c;
    }

    // Time range
    const timeRange = this.db.prepare(
      'SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM events WHERE undone = 0'
    ).get() as { oldest: string | null; newest: string | null };

    // DB file size
    let dbSizeBytes = 0;
    try {
      const stat = statSync(this.dbPath);
      dbSizeBytes = stat.size;
    } catch {
      // DB not yet written
    }

    return {
      totalEvents: total,
      activeEvents: active,
      undoneEvents: undone,
      eventTypes,
      branchCount: branches,
      snapshotCount: snapshots,
      assetCount: assets,
      oldestEvent: timeRange.oldest,
      newestEvent: timeRange.newest,
      dbSizeBytes,
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Close the database connection. Call this when shutting down to ensure
   * WAL files are checkpointed.
   */
  close(): void {
    if (this.db.open) {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.db.close();
    }
  }

  /**
   * Get the database file path (useful for backup/export).
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get the objects directory path for content-addressable storage.
   */
  getObjectsDir(): string {
    return join(this.dataDir, 'objects');
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────

  private getLatestEvent(): CompostEvent | null {
    const row = this.db.prepare(
      `SELECT * FROM events WHERE undone = 0 ORDER BY id DESC LIMIT 1`
    ).get() as EventRow | undefined;
    return row ? rowToEvent(row) : null;
  }

  /**
   * Validate branch name to prevent SQL injection.
   * Only allows alphanumeric, hyphens, underscores, and forward slashes.
   */
  private validateBranchName(name: string): void {
    // Branch names should be safe for database queries and filesystem operations
    // Allow: alphanumeric, hyphens, underscores, forward slashes (for nested branches)
    const validPattern = /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/;

    if (!name || name.length > 255) {
      throw new Error('Branch name must be between 1 and 255 characters');
    }

    if (!validPattern.test(name)) {
      throw new Error(
        'Branch name can only contain alphanumeric characters, hyphens, underscores, and forward slashes'
      );
    }

    // Prevent SQL injection escape sequences (only block SQL syntax chars and prefix, not words)
    const dangerousPatterns = ["'", '"', ';', '--', '/*', '*/', 'xp_'];
    for (const pattern of dangerousPatterns) {
      if (name.includes(pattern)) {
        throw new Error(`Branch name contains dangerous pattern: ${pattern}`);
      }
    }
    // Note: no keyword blocklist needed — branch names are used only in parameterized
    // queries (never string-interpolated into SQL), so SQL keywords in names are harmless.
  }
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface EventRow {
  id: number;
  type: string;
  payload: string;
  timestamp: string;
  branch: string;
  payload_hash: string;
  undone: number;
}

interface SnapshotRow {
  id: number;
  after_event_id: number;
  timestamp: string;
  state: string;
  branch: string;
}

interface BranchRow {
  name: string;
  event_id: number;
  created_at: string;
  is_active: number;
  description: string | null;
}

interface AssetRow {
  hash: string;
  filename: string;
  type: string;
  size: number;
  first_seen: string;
  metadata: string;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/** Convert a database row to a CompostEvent object. */
function rowToEvent(row: EventRow): CompostEvent {
  return {
    id: row.id,
    type: row.type as EventType,
    payload: JSON.parse(row.payload),
    timestamp: row.timestamp,
    branch: row.branch,
    payloadHash: row.payload_hash,
  };
}

/** Generate a human-readable description for an event. */
function describeEvent(event: CompostEvent): string {
  const p = event.payload;
  switch (event.type) {
    case 'heap_add':
      return `Added ${(p.files as string[])?.length ?? '?'} file(s) to heap (${formatBytes(p.totalBytes as number ?? 0)})`;
    case 'digest_start':
      return 'Digestion pipeline started';
    case 'digest_end':
      return `Digestion complete: ${(p.filesProcessed as number)} files → ${(p.seedsPromoted as number)} seeds in ${formatDuration(p.durationMs as number)}`;
    case 'seed_promote':
      return `Seed promoted: "${truncate(p.content as string ?? '', 50)}" (score: ${(p.score as number ?? 0).toFixed(2)})`;
    case 'seed_prune':
      return `Pruned ${(p.count as number)} unused seeds (older than ${p.retentionDays} days)`;
    case 'soup_start':
      return 'Evolutionary soup started';
    case 'soup_stop':
      return `Soup stopped after ${(p.totalCycles as number)} cycles (${p.totalSeedsPromoted} seeds promoted)`;
    case 'soup_cycle':
      return `Soup cycle #${p.cycle}: offspring score ${(p.score as number ?? 0).toFixed(2)} ${p.promoted ? '→ promoted!' : ''}`;
    case 'seed_use':
      return `Seed used by ${(p.functionName as string)} (use #${p.useCount})`;
    case 'branch_create':
      return `Branch "${p.branchName}" created from event #${p.fromEventId}`;
    case 'branch_switch':
      return `Switched from "${p.from}" to "${p.to}"`;
    case 'snapshot':
      return `State snapshot saved (${p.seedCount} seeds, ${p.heapSize} bytes in heap)`;
    case 'undo':
      return `Undid ${(p.undoneType as string)} event #${p.undoneEventId}`;
    case 'config_change':
      return `Config changed: ${(p.field as string)} = ${JSON.stringify(p.newValue)}`;
    default:
      return `${event.type}: ${truncate(JSON.stringify(p), 80)}`;
  }
}

/** SHA256 hash of a string, returned as hex. */
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Format bytes as human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format milliseconds as human-readable duration. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/** Truncate a string to maxLength, appending '...' if truncated. */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
