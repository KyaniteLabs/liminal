import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for SeedBank — seed storage, querying, and lifecycle.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SeedBank } from '../../src/compost/SeedBank.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import type { Seed } from '../../src/compost/types.js';

describe('SeedBank', () => {
  let tmpDir: string;
  let bank: SeedBank;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-test-'));
    const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
    bank = new SeedBank(config);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeSeed(overrides: Partial<Seed> = {}): Seed {
    return {
      id: `seed-${Math.random().toString(36).slice(2, 8)}`,
      content: 'A creative idea about glaze dynamics',
      score: 8.5,
      source: {
        fragments: ['frag-1', 'frag-2'],
        collisionType: 'timestamp',
        domains: ['ceramics', 'music'],
      },
      promotedAt: new Date().toISOString(),
      usedBy: [],
      useCount: 0,
      ...overrides,
    };
  }

  describe('add()', () => {
    it('persists seed to seeds.json', async () => {
      const seed = makeSeed();
      await bank.add(seed);
      const all = await bank.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(seed.id);
    });

    it('creates file in latest/', async () => {
      const seed = makeSeed({ id: 'seed-001', content: 'Test seed content' });
      await bank.add(seed);
      const files = await fs.readdir(path.join(tmpDir, 'seeds', 'latest'));
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('getAll()', () => {
    it('returns all seeds sorted by score desc', async () => {
      await bank.add(makeSeed({ id: 'a', score: 5 }));
      await bank.add(makeSeed({ id: 'b', score: 9 }));
      await bank.add(makeSeed({ id: 'c', score: 7 }));
      const all = await bank.getAll();
      expect(all[0].score).toBe(9);
      expect(all[1].score).toBe(7);
      expect(all[2].score).toBe(5);
    });

    it('returns empty array when no seeds', async () => {
      const all = await bank.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('getTop()', () => {
    it('returns top N seeds', async () => {
      await bank.add(makeSeed({ id: 'a', score: 5 }));
      await bank.add(makeSeed({ id: 'b', score: 9 }));
      await bank.add(makeSeed({ id: 'c', score: 7 }));
      const top = await bank.getTop(2);
      expect(top).toHaveLength(2);
      expect(top[0].score).toBe(9);
    });
  });

  describe('getByDomain()', () => {
    it('filters by source domain', async () => {
      await bank.add(makeSeed({ id: 'a', source: { fragments: [], collisionType: 't', domains: ['ceramics'] } }));
      await bank.add(makeSeed({ id: 'b', source: { fragments: [], collisionType: 't', domains: ['music'] } }));
      const results = await bank.getByDomain('ceramics');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('a');
    });
  });

  describe('markUsed()', () => {
    it('increments useCount and adds to usedBy', async () => {
      await bank.add(makeSeed({ id: 's1' }));
      await bank.markUsed('s1', 'SwarmOrchestrator');
      const all = await bank.getAll();
      expect(all[0].useCount).toBe(1);
      expect(all[0].usedBy).toContain('SwarmOrchestrator');
    });
  });

  describe('pruneOld()', () => {
    it('removes seeds older than retention days and unused', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      await bank.add(makeSeed({
        id: 'old-unused',
        promotedAt: oldDate.toISOString(),
        useCount: 0,
      }));
      await bank.add(makeSeed({
        id: 'recent',
        promotedAt: new Date().toISOString(),
        useCount: 0,
      }));
      await bank.add(makeSeed({
        id: 'old-used',
        promotedAt: oldDate.toISOString(),
        useCount: 5,
      }));
      await bank.pruneOld(90);
      const all = await bank.getAll();
      expect(all.find(s => s.id === 'old-unused')).toBeUndefined();
      expect(all.find(s => s.id === 'recent')).not.toBeNull();
      expect(all.find(s => s.id === 'old-used')).not.toBeNull();
    });
  });

  describe('count()', () => {
    it('returns total seed count', async () => {
      await bank.add(makeSeed({ id: 'a' }));
      await bank.add(makeSeed({ id: 'b' }));
      expect(await bank.count()).toBe(2);
    });
  });
});
