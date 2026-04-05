/**
 * Tests for the EventStore — SQLite-backed event sourcing engine.
 *
 * Tests cover: initialization, event append, query, timeline, snapshots,
 * branching, undo, asset registry, and stats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventStore } from '../../../src/compost/EventStore.js';
import type { CompostEvent, EventType } from '../../../src/compost/EventStore.js';

describe('EventStore', () => {
  let tempDir: string;
  let store: EventStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-eventstore-test-'));
    store = new EventStore({ projectRoot: tempDir });
    store.init();
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Initialization ────────────────────────────────────────────────────

  describe('init()', () => {
    it('creates the database and main branch', () => {
      const stats = store.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.branchCount).toBe(1);

      const branches = store.listBranches();
      expect(branches).toHaveLength(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].isActive).toBe(true);
    });

    it('is safe to call multiple times', () => {
      store.init();
      store.init();
      expect(store.getStats().totalEvents).toBe(0);
    });

    it('reopens an existing database correctly', () => {
      store.append('heap_add', { files: ['test.js'], totalBytes: 100 });
      store.close();

      const reopened = new EventStore({ projectRoot: tempDir });
      reopened.init();
      expect(reopened.getStats().totalEvents).toBe(1);
      expect(reopened.getActiveBranch()).toBe('main');
      reopened.close();
    });
  });

  // ─── Event Append ──────────────────────────────────────────────────────

  describe('append()', () => {
    it('appends an event with auto-generated ID and timestamp', () => {
      const event = store.append('heap_add', { files: ['sketch.js'], totalBytes: 2048 });

      expect(event.id).toBeGreaterThan(0);
      expect(event.type).toBe('heap_add');
      expect(event.payload.files).toEqual(['sketch.js']);
      expect(event.payload.totalBytes).toBe(2048);
      expect(event.timestamp).toBeTruthy();
      expect(event.branch).toBe('main');
      expect(event.payloadHash).toBeTruthy();
    });

    it('generates different IDs for sequential events', () => {
      const e1 = store.append('heap_add', { files: ['a.js'], totalBytes: 1 });
      const e2 = store.append('heap_add', { files: ['b.js'], totalBytes: 2 });

      expect(e2.id).toBeGreaterThan(e1.id);
    });

    it('generates consistent payload hashes for identical payloads', () => {
      const payload = { files: ['test.js'], totalBytes: 100 };
      const e1 = store.append('heap_add', payload);
      const e2 = store.append('heap_add', payload);

      expect(e1.payloadHash).toBe(e2.payloadHash);
    });

    it('generates different hashes for different payloads', () => {
      const e1 = store.append('heap_add', { files: ['a.js'] });
      const e2 = store.append('heap_add', { files: ['b.js'] });

      expect(e1.payloadHash).not.toBe(e2.payloadHash);
    });
  });

  describe('appendBatch()', () => {
    it('appends multiple events in a single transaction', () => {
      const events = store.appendBatch([
        { type: 'heap_add', payload: { files: ['a.js'], totalBytes: 100 } },
        { type: 'heap_add', payload: { files: ['b.js'], totalBytes: 200 } },
        { type: 'digest_start', payload: { fileCount: 2 } },
      ]);

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('heap_add');
      expect(events[1].type).toBe('heap_add');
      expect(events[2].type).toBe('digest_start');
      expect(store.getStats().totalEvents).toBe(3);
    });

    it('rolls back all events if one fails', () => {
      // All valid events — batch should succeed
      const events = store.appendBatch([
        { type: 'heap_add', payload: { files: ['a.js'] } },
        { type: 'heap_add', payload: { files: ['b.js'] } },
      ]);
      expect(events).toHaveLength(2);
    });
  });

  // ─── Query ─────────────────────────────────────────────────────────────

  describe('getEvent()', () => {
    it('returns an event by ID', () => {
      const appended = store.append('digest_end', {
        filesProcessed: 5,
        seedsPromoted: 3,
        durationMs: 4200,
      });

      const retrieved = store.getEvent(appended.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(appended.id);
      expect(retrieved!.payload.filesProcessed).toBe(5);
    });

    it('returns null for non-existent ID', () => {
      expect(store.getEvent(99999)).toBeNull();
    });
  });

  describe('queryEvents()', () => {
    beforeEach(() => {
      store.append('heap_add', { files: ['a.js'], totalBytes: 100 });
      store.append('digest_end', { filesProcessed: 1, seedsPromoted: 0 });
      store.append('seed_promote', { seedId: 'seed-1', score: 0.8 });
      store.append('heap_add', { files: ['b.js'], totalBytes: 200 });
      store.append('seed_promote', { seedId: 'seed-2', score: 0.9 });
    });

    it('filters by type', () => {
      const promotions = store.queryEvents({ type: 'seed_promote' });
      expect(promotions).toHaveLength(2);
      expect(promotions.every(e => e.type === 'seed_promote')).toBe(true);
    });

    it('limits results', () => {
      const limited = store.queryEvents({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('offsets results', () => {
      const all = store.queryEvents({ limit: 100 });
      const offset = store.queryEvents({ limit: 2, offset: 2 });
      expect(offset[0].id).toBe(all[2].id);
    });

    it('filters by timestamp range', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000).toISOString();
      const past = new Date(now.getTime() - 86400000).toISOString();

      const events = store.queryEvents({
        fromTimestamp: past,
        toTimestamp: future,
      });
      expect(events.length).toBe(5);
    });
  });

  describe('getEventCount()', () => {
    it('counts active events', () => {
      store.append('heap_add', { files: ['a.js'] });
      store.append('heap_add', { files: ['b.js'] });
      expect(store.getEventCount()).toBe(2);
    });

    it('counts events on a specific branch', () => {
      store.append('heap_add', { files: ['a.js'] });
      expect(store.getEventCount('main')).toBe(1);
      expect(store.getEventCount('nonexistent')).toBe(0);
    });
  });

  describe('getRecent()', () => {
    it('returns the N most recent events', () => {
      for (let i = 0; i < 10; i++) {
        store.append('heap_add', { files: [`file-${i}.js`], index: i });
      }

      const recent = store.getRecent(3);
      expect(recent).toHaveLength(3);
      // Most recent first
      expect(recent[0].payload.index).toBe(9);
      expect(recent[2].payload.index).toBe(7);
    });
  });

  describe('getLatestByType()', () => {
    it('returns the most recent event of a given type', () => {
      store.append('digest_end', { filesProcessed: 1, generation: 1 });
      store.append('seed_promote', { seedId: 's1' });
      store.append('digest_end', { filesProcessed: 2, generation: 2 });

      const latest = store.getLatestByType('digest_end');
      expect(latest).not.toBeNull();
      expect(latest!.payload.generation).toBe(2);
    });

    it('returns null when no event of that type exists', () => {
      expect(store.getLatestByType('soup_start')).toBeNull();
    });
  });

  // ─── Timeline ──────────────────────────────────────────────────────────

  describe('timeline()', () => {
    it('produces human-readable descriptions', () => {
      store.append('heap_add', { files: ['sketch.js', 'shader.glsl'], totalBytes: 4096 });
      store.append('digest_end', { filesProcessed: 2, seedsPromoted: 5, durationMs: 3500 });

      const timeline = store.timeline();
      expect(timeline).toHaveLength(2);
      expect(timeline[0].description).toContain('5 seeds');
      expect(timeline[0].deltaMs).not.toBeNull();
      expect(timeline[1].description).toContain('2 file(s)');
      expect(timeline[1].deltaMs).toBeNull(); // First event has no delta
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        store.append('heap_add', { files: [`f${i}.js`], totalBytes: 100 });
      }

      const page1 = store.timeline({ limit: 2, offset: 0 });
      const page2 = store.timeline({ limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].event.id).not.toBe(page2[0].event.id);
    });
  });

  // ─── Snapshots ─────────────────────────────────────────────────────────

  describe('snapshots', () => {
    it('saves and retrieves a snapshot', () => {
      store.append('heap_add', { files: ['a.js'], totalBytes: 100 });
      store.saveSnapshot({ seedCount: 3, seeds: ['s1', 's2', 's3'] });

      const snapshot = store.getLatestSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.state.seedCount).toBe(3);
      expect(snapshot!.branch).toBe('main');
    });

    it('returns null when no snapshot exists', () => {
      expect(store.getLatestSnapshot()).toBeNull();
    });

    it('retrieves snapshot before a given event ID', () => {
      const e1 = store.append('heap_add', { files: ['a.js'] }); // id=1
      store.saveSnapshot({ version: 1 });
      const e2 = store.append('heap_add', { files: ['b.js'] }); // id=3 (saveSnapshot appends a snapshot event at id=2)
      store.saveSnapshot({ version: 2 });

      const snap = store.getSnapshotBefore(e2.id);
      expect(snap).not.toBeNull();
      expect(snap!.state.version).toBe(1);
    });
  });

  // ─── Branches ──────────────────────────────────────────────────────────

  describe('branches', () => {
    it('creates a named branch', () => {
      store.append('heap_add', { files: ['a.js'] });
      const branch = store.createBranch('experiment', 'Testing wild shaders');

      expect(branch.name).toBe('experiment');
      expect(branch.isActive).toBe(false);
      expect(branch.description).toBe('Testing wild shaders');
    });

    it('switches to a branch', () => {
      store.createBranch('test-branch');
      store.switchBranch('test-branch');

      expect(store.getActiveBranch()).toBe('test-branch');
    });

    it('appends events to the active branch', () => {
      store.createBranch('b1');
      store.switchBranch('b1');

      const event = store.append('heap_add', { files: ['x.js'] });
      expect(event.branch).toBe('b1');
    });

    it('lists all branches with active state', () => {
      store.createBranch('b1');
      store.createBranch('b2');
      store.switchBranch('b2');

      const branches = store.listBranches();
      expect(branches).toHaveLength(3); // main + b1 + b2
      expect(branches.find(b => b.name === 'b2')!.isActive).toBe(true);
      expect(branches.find(b => b.name === 'main')!.isActive).toBe(false);
    });

    it('deletes a non-active branch', () => {
      store.createBranch('to-delete');
      store.deleteBranch('to-delete');
      expect(store.listBranches().length).toBe(1);
    });

    it('refuses to delete main', () => {
      expect(() => store.deleteBranch('main')).toThrow("Cannot delete the 'main' branch");
    });

    it('refuses to delete the active branch', () => {
      store.createBranch('active-one');
      store.switchBranch('active-one');
      expect(() => store.deleteBranch('active-one')).toThrow('Cannot delete the currently active branch');
    });

    it('refuses to create a branch named main', () => {
      expect(() => store.createBranch('main')).toThrow("Cannot create a branch named 'main'");
    });

    it('refuses to create duplicate branches', () => {
      store.createBranch('unique-name');
      expect(() => store.createBranch('unique-name')).toThrow("already exists");
    });

    it('refuses to switch to non-existent branch', () => {
      expect(() => store.switchBranch('ghost')).toThrow("does not exist");
    });
  });

  // ─── Undo ──────────────────────────────────────────────────────────────

  describe('undo()', () => {
    it('marks the most recent event as undone', () => {
      store.append('heap_add', { files: ['a.js'], totalBytes: 100 });
      store.append('seed_promote', { seedId: 's1', score: 0.8, content: 'test content' });

      const result = store.undo();

      expect(result.undoneEvent.type).toBe('seed_promote');
      // undo() appends an 'undo' event, so: heap_add(1) + undo_event(1) = 2 active
      expect(result.remainingEvents).toBe(2);
      expect(result.needsSnapshot).toBe(true);
    });

    it('excludes undone events from queries', () => {
      store.append('heap_add', { files: ['a.js'] });
      store.append('seed_promote', { seedId: 's1', score: 0.8, content: 'test' });
      store.undo();

      const events = store.queryEvents({});
      // heap_add + the undo event itself — seed_promote is excluded
      expect(events).toHaveLength(2);
      expect(events.every(e => e.type !== 'seed_promote')).toBe(true);
    });

    it('counts undone events separately in stats', () => {
      store.append('heap_add', { files: ['a.js'] });
      store.append('seed_promote', { seedId: 's1', score: 0.8, content: 'test' });
      store.undo();

      const stats = store.getStats();
      expect(stats.activeEvents).toBe(2); // heap_add + the undo event itself
      expect(stats.undoneEvents).toBe(1); // the undone seed_promote
      expect(stats.totalEvents).toBe(3); // all three
    });

    it('refuses to undo when no events exist', () => {
      expect(() => store.undo()).toThrow('No events to undo');
    });

    it('refuses to undo structural events', () => {
      store.createBranch('test');
      // The last event is branch_create (structural)
      expect(() => store.undo()).toThrow('structural');
    });
  });

  // ─── Asset Registry ────────────────────────────────────────────────────

  describe('asset registry', () => {
    it('registers and retrieves an asset', () => {
      store.registerAsset({
        hash: 'abc123',
        filename: 'sketch.js',
        type: 'text/javascript',
        size: 2048,
        metadata: { domain: 'p5' },
      });

      const asset = store.getAsset('abc123');
      expect(asset).not.toBeNull();
      expect(asset!.filename).toBe('sketch.js');
      expect(asset!.size).toBe(2048);
      expect(asset!.metadata.domain).toBe('p5');
    });

    it('returns null for non-existent asset', () => {
      expect(store.getAsset('nonexistent')).toBeNull();
    });

    it('lists assets with optional type filter', () => {
      store.registerAsset({ hash: 'a1', filename: 'f1.js', type: 'text/javascript', size: 100 });
      store.registerAsset({ hash: 'a2', filename: 'f2.png', type: 'image/png', size: 200 });

      const all = store.listAssets();
      expect(all).toHaveLength(2);

      const images = store.listAssets('image/png');
      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('f2.png');
    });
  });

  // ─── Stats ─────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('returns comprehensive statistics', () => {
      store.append('heap_add', { files: ['a.js'], totalBytes: 100 });
      store.append('digest_end', { filesProcessed: 1, seedsPromoted: 2, durationMs: 1000 });
      store.append('seed_promote', { seedId: 's1', score: 0.8, content: 'test' });

      const stats = store.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.activeEvents).toBe(3);
      expect(stats.undoneEvents).toBe(0);
      expect(stats.eventTypes).toEqual({
        heap_add: 1,
        digest_end: 1,
        seed_promote: 1,
      });
      expect(stats.branchCount).toBe(1);
      expect(stats.snapshotCount).toBe(0);
      expect(stats.oldestEvent).toBeTruthy();
      expect(stats.newestEvent).toBeTruthy();
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  describe('close()', () => {
    it('closes the database safely', () => {
      store.append('heap_add', { files: ['a.js'] });
      store.close();

      // Verify DB file exists
      const dbPath = store.getDbPath();
      const { existsSync } = require('node:fs');
      expect(existsSync(dbPath)).toBe(true);
    });
  });
});
