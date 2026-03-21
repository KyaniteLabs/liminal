import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for DigestGenerator — weekly digest markdown generation.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DigestGenerator } from '../../src/compost/DigestGenerator.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import type { DigestStats, Seed } from '../../src/compost/types.js';

describe('DigestGenerator', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let generator: DigestGenerator;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'digest-test-'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFn: any = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Weekly synthesis narrative.' });
    mockLLM = { generate: mockFn };
    const config = mergeConfig({ digestDir: path.join(tmpDir, 'digest') });
    generator = new DigestGenerator(config, mockLLM);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  function makeStats(overrides: Partial<DigestStats> = {}): DigestStats {
    return {
      filesProcessed: 10,
      totalBytes: 5000,
      domains: ['ceramics', 'music', 'code'],
      fragmentCount: 50,
      collisionCount: 20,
      seedsPromoted: 3,
      soupCycles: 100,
      durationMs: 5000,
      ...overrides,
    };
  }

  function makeSeeds(): Seed[] {
    return [
      {
        id: 'seed-001',
        content: 'Glaze frequency visualizer concept',
        score: 9.2,
        source: { fragments: ['f1', 'f2'], collisionType: 'metadata', domains: ['ceramics', 'music'] },
        promotedAt: '2026-03-20T00:00:00Z',
        usedBy: [],
        useCount: 0,
      },
      {
        id: 'seed-002',
        content: 'Voice ceramic form mapping',
        score: 8.7,
        source: { fragments: ['f3', 'f4'], collisionType: 'domain-opposite', domains: ['3d', 'ceramics'] },
        promotedAt: '2026-03-20T00:00:00Z',
        usedBy: [],
        useCount: 0,
      },
    ];
  }

  describe('generate()', () => {
    it('produces markdown string with expected sections', () => {
      const stats = makeStats();
      const seeds = makeSeeds();
      const result = generator.generate(stats, seeds, ['Best offspring found']);

      expect(result).toContain('# Compost Mill Digest');
      expect(result).toContain('## Heap Stats');
      expect(result).toContain('## Seeds Promoted');
      expect(result).toContain('## Soup Highlights');
      expect(result).toContain('## Domain Heatmap');
    });

    it('seed entries include score, sources, collision type, content', () => {
      const stats = makeStats();
      const seeds = makeSeeds();
      const result = generator.generate(stats, seeds, []);

      expect(result).toContain('9.2');
      expect(result).toContain('ceramics');
      expect(result).toContain('music');
      expect(result).toContain('metadata');
      expect(result).toContain('Glaze frequency visualizer');
    });

    it('stats formatting shows file counts and domains', () => {
      const stats = makeStats();
      const result = generator.generate(stats, [], []);
      expect(result).toContain('10');
      expect(result).toContain('ceramics');
    });
  });

  describe('save()', () => {
    it('writes to digest/YYYY-MM-DD.md', async () => {
      const stats = makeStats();
      const seeds = makeSeeds();
      const digestPath = await generator.save(stats, seeds, []);
      expect(digestPath).toContain('digest');
      expect(digestPath).toMatch(/\d{4}-\d{2}-\d{2}\.md$/);

      const content = await fs.readFile(digestPath, 'utf-8');
      expect(content).toContain('Compost Mill Digest');
    });
  });
});
