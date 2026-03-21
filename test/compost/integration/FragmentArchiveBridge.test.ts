import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for FragmentArchiveBridge — bridges compost seeds to FragmentArchive.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FragmentArchiveBridge } from '../../../src/compost/integration/FragmentArchiveBridge.js';
import { SeedBank } from '../../../src/compost/SeedBank.js';
import { mergeConfig } from '../../../src/compost/defaults.js';
import type { Seed } from '../../../src/compost/types.js';

describe('FragmentArchiveBridge', () => {
  let tmpDir: string;
  let seedBank: SeedBank;
  let bridge: FragmentArchiveBridge;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fragment-bridge-test-'));
    const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
    seedBank = new SeedBank(config);
    bridge = new FragmentArchiveBridge();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeSeed(overrides: Partial<Seed> = {}): Seed {
    return {
      id: 'seed-001',
      content: 'Glaze frequency visualizer',
      score: 8.5,
      source: { fragments: ['f1'], collisionType: 'timestamp', domains: ['ceramics'] },
      promotedAt: new Date().toISOString(),
      usedBy: [],
      useCount: 0,
      ...overrides,
    };
  }

  describe('getSeedsAsFragments()', () => {
    it('converts Seed[] to fragment format', async () => {
      await seedBank.add(makeSeed());
      const seeds = await seedBank.getAll();
      const fragments = bridge.getSeedsAsFragments(seeds);
      expect(fragments).toHaveLength(1);
      expect(fragments[0].content).toBe('Glaze frequency visualizer');
    });
  });

  describe('getRandomSeedAsPromptSeed()', () => {
    it('returns content for swarm use', async () => {
      await seedBank.add(makeSeed());
      const content = await bridge.getRandomSeedAsPromptSeed(seedBank);
      expect(content).toBe('Glaze frequency visualizer');
    });

    it('returns undefined when no seeds', async () => {
      const content = await bridge.getRandomSeedAsPromptSeed(seedBank);
      expect(content).toBeUndefined();
    });
  });
});
