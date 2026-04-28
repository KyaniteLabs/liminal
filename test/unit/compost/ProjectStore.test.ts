/**
 * Tests for the ProjectStore — high-level creative history API.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../../../src/compost/ProjectStore.js';
import type { Seed } from '../../../src/compost/types.js';

/** Helper to create a test seed. */
function makeSeed(overrides: Partial<Seed> = {}): Seed {
  return {
    id: `seed-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Test seed content for compost pipeline',
    score: 0.75,
    source: {
      fragments: ['frag-1', 'frag-2'],
      collisionType: 'domain-opposites',
      domains: ['p5', 'shader'],
    },
    promotedAt: new Date().toISOString(),
    usedBy: [],
    useCount: 0,
    ...overrides,
  };
}

describe('ProjectStore', () => {
  let tempDir: string;
  let store: ProjectStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-project-test-'));
    store = new ProjectStore({ projectRoot: tempDir });
  });

  afterEach(() => {
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Initialization ────────────────────────────────────────────────────

  describe('init()', () => {
    it('creates a new project store', () => {
      const result = store.init();

      expect(result.isNew).toBe(true);
      expect(result.dbPath).toContain('project.liminal');
      expect(result.stats.totalEvents).toBe(0);
    });

    it('opens an existing project store', () => {
      store.init();
      store.recordHeapAdd(['test.js'], 100);
      store.close();

      const reopened = new ProjectStore({ projectRoot: tempDir });
      const result = reopened.init();
      reopened.close();

      expect(result.isNew).toBe(false);
      expect(result.stats.totalEvents).toBe(1);
    });
  });

  // ─── Recording Methods ─────────────────────────────────────────────────

  describe('recordHeapAdd()', () => {
    it('records a heap_add event', () => {
      store.init();
      const event = store.recordHeapAdd(['sketch.js', 'shader.glsl'], 4096);

      expect(event.type).toBe('heap_add');
      expect(event.payload.files).toEqual(['sketch.js', 'shader.glsl']);
      expect(event.payload.totalBytes).toBe(4096);
    });
  });

  describe('recordDigestEnd()', () => {
    it('records a digest_end event with stats and seeds', () => {
      store.init();
      const stats = {
        filesProcessed: 5,
        totalBytes: 10240,
        domains: ['p5', 'shader'],
        fragmentCount: 12,
        collisionCount: 3,
        seedsPromoted: 2,
        soupCycles: 0,
        durationMs: 5200,
      };
      const seeds = [makeSeed(), makeSeed()];

      const event = store.recordDigestEnd(stats, seeds);

      expect(event.type).toBe('digest_end');
      expect(event.payload.filesProcessed).toBe(5);
      expect(event.payload.seedsPromoted).toBe(2);
      expect(event.payload.seedIds).toHaveLength(2);
    });
  });

  describe('recordSeedPromotion()', () => {
    it('records a seed_promote event', () => {
      store.init();
      const seed = makeSeed({ score: 0.92 });

      const event = store.recordSeedPromotion(seed);

      expect(event.type).toBe('seed_promote');
      expect(event.payload.seedId).toBe(seed.id);
      expect(event.payload.score).toBe(0.92);
    });
  });

  describe('recordSeedPrune()', () => {
    it('records a seed_prune event', () => {
      store.init();

      const event = store.recordSeedPrune(5, 90);

      expect(event.type).toBe('seed_prune');
      expect(event.payload.count).toBe(5);
      expect(event.payload.retentionDays).toBe(90);
    });
  });

  describe('recordSoupStart() / recordSoupStop()', () => {
    it('records soup lifecycle events', () => {
      store.init();

      const start = store.recordSoupStart(20);
      expect(start.type).toBe('soup_start');
      expect(start.payload.populationSize).toBe(20);

      const stop = store.recordSoupStop(150, 7);
      expect(stop.type).toBe('soup_stop');
      expect(stop.payload.totalCycles).toBe(150);
      expect(stop.payload.totalSeedsPromoted).toBe(7);
    });
  });

  describe('recordSoupCycle()', () => {
    it('records a soup cycle with promotion flag', () => {
      store.init();

      const event = store.recordSoupCycle(42, 0.85, true, ['p5', 'music']);
      expect(event.type).toBe('soup_cycle');
      expect(event.payload.cycle).toBe(42);
      expect(event.payload.score).toBe(0.85);
      expect(event.payload.promoted).toBe(true);
    });
  });

  describe('recordSeedUse()', () => {
    it('records when a seed is consumed', () => {
      store.init();

      const event = store.recordSeedUse('seed-abc123', 'RalphLoop', 3);
      expect(event.type).toBe('seed_use');
      expect(event.payload.seedId).toBe('seed-abc123');
      expect(event.payload.useCount).toBe(3);
    });
  });

  // ─── Timeline ──────────────────────────────────────────────────────────

  describe('getTimeline()', () => {
    it('returns a formatted timeline with total count', () => {
      store.init();
      store.recordHeapAdd(['a.js'], 100);
      store.recordDigestEnd(
        { filesProcessed: 1, totalBytes: 100, domains: ['p5'], fragmentCount: 5, collisionCount: 1, seedsPromoted: 2, soupCycles: 0, durationMs: 2000 },
        [makeSeed(), makeSeed()],
      );

      const timeline = store.getTimeline();

      expect(timeline.entries).toHaveLength(2);
      expect(timeline.totalCount).toBe(2);
      expect(timeline.branchName).toBe('main');
    });

    it('returns empty timeline for a fresh project', () => {
      store.init();

      const timeline = store.getTimeline();
      expect(timeline.entries).toHaveLength(0);
      expect(timeline.totalCount).toBe(0);
    });
  });

  describe('getRecentDigests()', () => {
    it('returns digest_end events', () => {
      store.init();
      const stats = { filesProcessed: 1, totalBytes: 100, domains: ['p5'], fragmentCount: 5, collisionCount: 0, seedsPromoted: 1, soupCycles: 0, durationMs: 1000 };
      store.recordDigestEnd(stats, [makeSeed()]);
      store.recordHeapAdd(['b.js'], 200);
      store.recordDigestEnd(stats, [makeSeed()]);

      const digests = store.getRecentDigests(10);
      expect(digests).toHaveLength(2);
      expect(digests.every(e => e.type === 'digest_end')).toBe(true);
    });
  });

  // ─── Snapshots ─────────────────────────────────────────────────────────

  describe('saveSnapshot() / getLatestSnapshot()', () => {
    it('saves and retrieves a snapshot', () => {
      store.init();
      store.recordHeapAdd(['a.js'], 100); // Need at least one event for snapshot
      const seeds = [makeSeed(), makeSeed(), makeSeed()];

      store.saveSnapshot(seeds, 1024);

      const snapshot = store.getLatestSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.state.seedCount).toBe(3);
      expect(snapshot!.state.heapSize).toBe(1024);
    });
  });

  // ─── Branching ─────────────────────────────────────────────────────────

  describe('branching', () => {
    it('creates and switches branches', () => {
      store.init();
      store.recordHeapAdd(['a.js'], 100);

      const branch = store.createBranch('experiment', 'Testing a new strategy');
      expect(branch.name).toBe('experiment');

      store.switchBranch('experiment');
      expect(store.getActiveBranch()).toBe('experiment');

      // Events on this branch
      store.recordHeapAdd(['b.js'], 200);
      const timeline = store.getTimeline({ branch: 'experiment' });
      // The switch itself creates a branch_switch event + the heap_add = 2
      expect(timeline.totalCount).toBe(2);
    });

    it('lists branches correctly', () => {
      store.init();
      store.createBranch('b1');
      store.createBranch('b2');

      const branches = store.listBranches();
      expect(branches).toHaveLength(3); // main + b1 + b2
    });

    it('deletes branches', () => {
      store.init();
      store.createBranch('to-delete');
      store.deleteBranch('to-delete');
      expect(store.listBranches()).toHaveLength(1);
    });
  });

  // ─── Undo ──────────────────────────────────────────────────────────────

  describe('undo()', () => {
    it('undoes the most recent creative operation', () => {
      store.init();
      store.recordHeapAdd(['a.js'], 100);
      store.recordSeedPromotion(makeSeed());

      const result = store.undo();

      expect(result.undoneEvent.type).toBe('seed_promote');
      // heap_add + the undo event itself = 2 remaining
      expect(result.remainingEvents).toBe(2);
    });

    it('requires initialization', () => {
      expect(() => store.undo()).toThrow('not initialized');
    });
  });

  // ─── Stats ─────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('returns aggregate statistics', () => {
      store.init();
      store.recordHeapAdd(['a.js'], 100);
      store.recordSeedPromotion(makeSeed());

      const stats = store.getStats();
      expect(stats.activeEvents).toBe(2);
      expect(stats.eventTypes.heap_add).toBe(1);
      expect(stats.eventTypes.seed_promote).toBe(1);
    });
  });

  describe('getStatusSummary()', () => {
    it('produces a human-readable summary', () => {
      store.init();
      store.recordHeapAdd(['sketch.js'], 2048);

      const summary = store.getStatusSummary();
      expect(summary).toContain('main');
      expect(summary).toContain('1 active');
      expect(summary).toContain('heap_add: 1');
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  describe('close()', () => {
    it('prevents operations after close', () => {
      store.init();
      store.close();

      expect(() => store.recordHeapAdd(['a.js'], 100)).toThrow('not initialized');
    });
  });

  describe('getEventStore() / getAssetStore()', () => {
    it('provides access to underlying stores', () => {
      store.init();

      expect(store.getEventStore()).not.toBeNull();
      expect(store.getAssetStore()).not.toBeNull();
    });
  });
});
