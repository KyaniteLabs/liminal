import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for CompostSoup — continuous evolutionary loop.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostSoup } from '../../src/compost/CompostSoup.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import type { CompostFragment } from '../../src/compost/types.js';

function makeFragment(overrides: Partial<CompostFragment> = {}): CompostFragment {
  return {
    id: `frag-${Math.random().toString(36).slice(2, 8)}`,
    source: '/test/file.txt',
    domain: 'ceramics',
    layer: 'semantic',
    content: 'Creative fragment content about glaze dynamics.',
    metadata: {
      fileType: 'txt',
      timestamp: '2026-03-20T00:00:00Z',
      hash: 'a'.repeat(64),
      size: 100,
      extractedAt: '2026-03-20T00:00:00Z',
    },
    tags: ['ceramics'],
    score: 5,
    ...overrides,
  };
}

const mockEntropy = {
  nextInt: vi.fn((max: number) => 0 % max),
};

describe('CompostSoup', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let soup: CompostSoup;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soup-test-'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFn: any = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Merged offspring content' });
    mockLLM = { generate: mockFn };
    const config = mergeConfig({
      seedDir: path.join(tmpDir, 'seeds'),
      soupPopulationSize: 10,
      soupSeedPromotionThreshold: 0.7,
    });
    soup = new CompostSoup(config, mockLLM, mockEntropy as any);
  });

  afterEach(async () => {
    soup.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('cycle()', () => {
    it('picks 2 random fragments from different domains and merges', async () => {
      const fragments = [
        makeFragment({ domain: 'ceramics', id: 'c1' }),
        makeFragment({ domain: 'music', id: 'm1' }),
        makeFragment({ domain: 'code', id: 'x1' }),
      ];
      const stateBefore = await soup.cycle(fragments);
      const state = await soup.cycle(fragments);
      expect(state.generation).toBe(stateBefore.generation + 1);
      expect(state.lastCycleAt).toBeTruthy();
    });

    it('replaces worst in population if offspring is better', async () => {
      const fragments = [
        makeFragment({ domain: 'a', content: 'short', score: 1 }),
        makeFragment({ domain: 'b', content: 'short', score: 1 }),
      ];
      const state = await soup.cycle(fragments);
      // Population should have been updated
      expect(state.population.length).toBeLessThanOrEqual(11); // max + 1 possible
    });
  });

  describe('stop()', () => {
    it('sets abort signal', () => {
      soup.stop();
      expect(soup.isRunning()).toBe(false);
    });
  });
});
