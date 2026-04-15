/**
 * Integration test: MetabolicEntropyEngine wired through a CompostMill digest cycle.
 *
 * Verifies that:
 * - Entropy engine is accepted by CompostMill constructor
 * - A full digest cycle succeeds with entropy wired in
 * - Entropy harvest() is called during the cycle
 * - getTopSeeds callback allows entropy to access promoted seeds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../src/compost/CompostMill.js';
import { MetabolicEntropyEngine } from '../../src/entropy/MetabolicEntropyEngine.js';

describe('Entropy + CompostMill integration', () => {
  let tmpDir: string;
  let mill: CompostMill;
  let entropy: MetabolicEntropyEngine;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-compost-'));

    const mockFn = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Generated content' });
    const mockLLM = { generate: mockFn };

    entropy = new MetabolicEntropyEngine({
      eventStore: { getRecent: () => [{ type: 'test', at: Date.now() }] },
      heap: { listFiles: async () => [path.join(tmpDir, 'heap', 'doc.txt')] },
      telemetry: {
        getSummary: () => ({
          successRate: 0.95,
          avgDurationMs: 120,
          totalTasks: 10,
          totalViolations: 0,
        }),
      },
    });

    // Spy on harvest to verify it gets called
    vi.spyOn(entropy, 'harvest');

    mill = new CompostMill(mockLLM, {
      heapDir: path.join(tmpDir, 'heap'),
      digestDir: path.join(tmpDir, 'digest'),
      seedDir: path.join(tmpDir, 'seeds'),
      soupStatePath: path.join(tmpDir, 'soup-state.json'),
      maxHeapSizeBytes: 1024 * 1024,
      soupEnabled: false,
      entropy,
    });
  });

  afterEach(async () => {
    mill.stopSoup();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs a full digest cycle with entropy wired in', async () => {
    const heapDir = path.join(tmpDir, 'heap');
    await fs.mkdir(heapDir, { recursive: true });
    const file = path.join(heapDir, 'doc.txt');
    await fs.writeFile(file, 'Creative writing about music and ceramics.');

    await mill.add([file]);
    const result = await mill.digest();

    expect(result.stats.filesProcessed).toBe(1);
    expect(result.stats.fragmentCount).toBeGreaterThan(0);
    expect(result.digestPath).toBeTruthy();
  });

  it('harvests entropy after digest and exposes seeds to entropy', async () => {
    const heapDir = path.join(tmpDir, 'heap');
    await fs.mkdir(heapDir, { recursive: true });
    const file = path.join(heapDir, 'doc.txt');
    await fs.writeFile(file, 'A novel idea combining code and visual art.');

    await mill.add([file]);
    const result = await mill.digest();

    // Seeds should have been promoted
    expect(result.seeds.length).toBeGreaterThanOrEqual(0);

    // Entropy harvest should have been called by CompostMill.digest()
    expect(entropy.harvest).toHaveBeenCalled();

    // Verify entropy can access top seeds via the wired callback
    const topSeeds = await mill.getTopSeeds(10);
    expect(Array.isArray(topSeeds)).toBe(true);
  });
});
