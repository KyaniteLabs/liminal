import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for SwarmBridge — bridges compost seeds into swarm pipeline.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SwarmBridge } from '../../../src/compost/integration/SwarmBridge.js';
import { SeedBank } from '../../../src/compost/SeedBank.js';
import { mergeConfig } from '../../../src/compost/defaults.js';
describe('SwarmBridge', () => {
  let tmpDir: string;
  let seedBank: SeedBank;
  let bridge: SwarmBridge;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'swarm-bridge-test-'));
    const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
    seedBank = new SeedBank(config);
    bridge = new SwarmBridge();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getSeedForSwarm()', () => {
    it('returns random seed content', async () => {
      await seedBank.add({
        id: 's1', content: 'Swarm seed content', score: 8,
        source: { fragments: [], collisionType: 't', domains: ['ceramics'] },
        promotedAt: new Date().toISOString(), usedBy: [], useCount: 0,
      });
      const content = await bridge.getSeedForSwarm(seedBank);
      expect(content).toBe('Swarm seed content');
    });

    it('returns undefined when no seeds', async () => {
      const content = await bridge.getSeedForSwarm(seedBank);
      expect(content).toBeUndefined();
    });
  });

  describe('getSeedsByDomain()', () => {
    it('returns domain-filtered seeds', async () => {
      await seedBank.add({
        id: 'a', content: 'Ceramics seed', score: 8,
        source: { fragments: [], collisionType: 't', domains: ['ceramics'] },
        promotedAt: new Date().toISOString(), usedBy: [], useCount: 0,
      });
      await seedBank.add({
        id: 'b', content: 'Music seed', score: 7,
        source: { fragments: [], collisionType: 't', domains: ['music'] },
        promotedAt: new Date().toISOString(), usedBy: [], useCount: 0,
      });
      const results = await bridge.getSeedsByDomain(seedBank, 'ceramics');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('a');
    });
  });
});
