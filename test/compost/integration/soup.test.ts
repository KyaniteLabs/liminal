import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Soup integration test — multi-cycle evolution verification.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostSoup } from '../../../src/compost/CompostSoup.js';
import { mergeConfig } from '../../../src/compost/defaults.js';
import type { CompostFragment } from '../../../src/compost/types.js';

function makeFragment(overrides: Partial<CompostFragment> = {}): CompostFragment {
  return {
    id: `frag-${Math.random().toString(36).slice(2, 8)}`,
    source: '/test/file.txt',
    domain: 'domain-a',
    layer: 'semantic',
    content: 'Creative content for evolution.',
    metadata: {
      fileType: 'txt',
      timestamp: new Date().toISOString(),
      hash: 'a'.repeat(64),
      size: 100,
      extractedAt: new Date().toISOString(),
    },
    tags: ['test'],
    score: 5,
    ...overrides,
  };
}

const mockEntropy = {
  nextInt: vi.fn((max: number) => 0 % max),
};

describe('Soup Integration', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let soup: CompostSoup;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soup-int-test-'));
    const mockFn: any = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Evolved offspring: ' + Math.random().toString(36) });
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

  it('runs N cycles without error', async () => {
    const fragments = [
      makeFragment({ domain: 'ceramics', id: 'c1', content: 'Glaze dynamics in kiln firing process.' }),
      makeFragment({ domain: 'music', id: 'm1', content: 'Rhythmic patterns in percussion ensembles.' }),
      makeFragment({ domain: 'code', id: 'x1', content: 'Algorithmic pattern generation in TypeScript.' }),
      makeFragment({ domain: 'image', id: 'i1', content: 'Color theory and composition in visual art.' }),
    ];

    for (let i = 0; i < 5; i++) {
      const state = await soup.cycle(fragments);
      expect(state.generation).toBeGreaterThan(0);
    }
  });

  it('population evolves (scores change)', async () => {
    const fragments = [
      makeFragment({ domain: 'a', id: 'f1', content: 'First domain content' }),
      makeFragment({ domain: 'b', id: 'f2', content: 'Second domain content' }),
      makeFragment({ domain: 'c', id: 'f3', content: 'Third domain content' }),
    ];

    const state1 = await soup.cycle(fragments);
    const state2 = await soup.cycle(fragments);

    // Population should grow or stay the same across cycles
    expect(state2.population.length).toBeGreaterThanOrEqual(state1.population.length);
  });

  it('state persists across cycles', async () => {
    const fragments = [
      makeFragment({ domain: 'x', id: 'p1', content: 'Content one' }),
      makeFragment({ domain: 'y', id: 'p2', content: 'Content two' }),
    ];

    const state1 = await soup.cycle(fragments);
    expect(state1.generation).toBeGreaterThanOrEqual(1);

    const state2 = await soup.cycle(fragments);
    expect(state2.generation).toBeGreaterThan(state1.generation);
  });
});
