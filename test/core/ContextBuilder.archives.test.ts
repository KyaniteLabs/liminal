/**
 * ContextBuilder Archives Integration Tests
 *
 * Tests to verify that archives are properly queried during context building
 * and that retrieved examples are injected into the generation context.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildContextForInjection,
  formatSeedsForContext,
  retrieveSeedBankContext,
  type ArchiveSources,
  type ArchiveRetrievalOptions,
} from '../../src/core/ContextBuilder.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';
import { MapElites } from '../../src/evolution/MapElites.js';
import { NoveltyArchive } from '../../src/evolution/NoveltyArchive.js';
import { SeedBank } from '../../src/compost/SeedBank.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import type { Seed } from '../../src/compost/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ContextBuilder Archives Integration', () => {
  beforeEach(() => {
    ContextAccumulation.clear();
  });

  describe('MapElites Integration', () => {
    it('should include diverse elites in context when MapElites is provided', () => {
      // Setup MapElites with some cells
      const mapElites = new MapElites([5, 5]);
      mapElites.insert('creation-1', [0.1, 0.2], 0.85);
      mapElites.insert('creation-2', [0.8, 0.9], 0.92);
      mapElites.insert('creation-3', [0.5, 0.5], 0.78);

      const archives: ArchiveSources = { mapElites };
      const archiveOptions: ArchiveRetrievalOptions = { diverseEliteCount: 2 };

      // Add some history so we get detailed context
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).toContain('Quality-diverse examples from archive:');
      // Should contain one of the creation IDs
      expect(context).toMatch(/creation-[123]/);
      expect(context).toContain('Fitness:');
    });

    it('should not include MapElites context when diverseEliteCount is 0', () => {
      const mapElites = new MapElites([5, 5]);
      mapElites.insert('creation-1', [0.1, 0.2], 0.85);

      const archives: ArchiveSources = { mapElites };
      const archiveOptions: ArchiveRetrievalOptions = { diverseEliteCount: 0 };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).not.toContain('Quality-diverse examples from archive:');
    });

    it('should not include MapElites context when MapElites is empty', () => {
      const mapElites = new MapElites([5, 5]);

      const archives: ArchiveSources = { mapElites };
      const archiveOptions: ArchiveRetrievalOptions = { diverseEliteCount: 3 };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).not.toContain('Quality-diverse examples from archive:');
    });
  });

  describe('NoveltyArchive Integration', () => {
    it('should include novel examples in context when NoveltyArchive is provided', () => {
      const archive = new NoveltyArchive(100, 5);
      // Add some behavior vectors
      archive.add([0.1, 0.2, 0.3]);
      archive.add([0.8, 0.9, 0.7]);
      archive.add([0.5, 0.4, 0.6]);

      const archives: ArchiveSources = { noveltyArchive: archive };
      const archiveOptions: ArchiveRetrievalOptions = { novelExampleCount: 2 };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).toContain('Novel behavior patterns from archive:');
      expect(context).toContain('Novelty:');
      expect(context).toContain('Behavior:');
    });

    it('should not include NoveltyArchive context when novelExampleCount is 0', () => {
      const archive = new NoveltyArchive(100, 5);
      archive.add([0.1, 0.2, 0.3]);

      const archives: ArchiveSources = { noveltyArchive: archive };
      const archiveOptions: ArchiveRetrievalOptions = { novelExampleCount: 0 };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).not.toContain('Novel behavior patterns from archive:');
    });

    it('should not include NoveltyArchive context when archive is empty', () => {
      const archive = new NoveltyArchive(100, 5);

      const archives: ArchiveSources = { noveltyArchive: archive };
      const archiveOptions: ArchiveRetrievalOptions = { novelExampleCount: 3 };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).not.toContain('Novel behavior patterns from archive:');
    });
  });

  describe('Multiple Archives Integration', () => {
    it('should include both MapElites and NoveltyArchive context when both are provided', () => {
      const mapElites = new MapElites([5, 5]);
      mapElites.insert('elite-1', [0.2, 0.3], 0.9);

      const noveltyArchive = new NoveltyArchive(100, 5);
      noveltyArchive.add([0.4, 0.5, 0.6]);

      const archives: ArchiveSources = { mapElites, noveltyArchive };
      const archiveOptions: ArchiveRetrievalOptions = {
        diverseEliteCount: 1,
        novelExampleCount: 1,
      };

      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 }, 'test', 'loaded', '', archives, archiveOptions);

      expect(context).toContain('Quality-diverse examples from archive:');
      expect(context).toContain('Novel behavior patterns from archive:');
    });

    it('should work with no archives provided', () => {
      ContextAccumulation.save({
        iteration: 1,
        prompt: 'test',
        usedPrompt: 'test used',
        code: 'const x = 1;',
        evaluation: { score: 0.5, issues: [] },
        timestamp: new Date().toISOString(),
        maxIterations: 5,
      });

      const context = buildContextForInjection(2, { maxIterations: 5 });

      // Should not contain any archive-related content
      expect(context).not.toContain('Quality-diverse examples');
      expect(context).not.toContain('Novel behavior patterns');
      expect(context).not.toContain('Relevant seeds');
    });
  });

  describe('formatSeedsForContext', () => {
    it('should format seeds for context inclusion', () => {
      const seeds: Seed[] = [
        {
          id: 'seed-1',
          content: 'A creative idea about flowing water',
          score: 8.5,
          source: {
            fragments: ['frag-1'],
            collisionType: 'timestamp',
            domains: ['nature', 'art'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        },
        {
          id: 'seed-2',
          content: 'Another creative idea about mountains and sky with a very long description that should definitely be truncated when displayed in the context',
          score: 9.0,
          source: {
            fragments: ['frag-2'],
            collisionType: 'semantic',
            domains: ['landscape'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        },
      ];

      const formatted = formatSeedsForContext(seeds);

      expect(formatted).toContain('Relevant seeds from archive:');
      expect(formatted).toContain('A creative idea about flowing water');
      expect(formatted).toContain('Score: 8.5');
      expect(formatted).toContain('Domains: nature, art');
      expect(formatted).toContain('...'); // Second seed should be truncated (over 100 chars)
    });

    it('should return empty string for empty seeds array', () => {
      const formatted = formatSeedsForContext([]);
      expect(formatted).toBe('');
    });
  });

  describe('SeedBank Integration', () => {
    let tmpDir: string;
    let seedBank: SeedBank;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contextbuilder-test-'));
      const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
      seedBank = new SeedBank(config);
    });

    it('should retrieve relevant seeds based on prompt keywords', async () => {
      // Add seeds with different content
      const seed1: Seed = {
        id: 'seed-water',
        content: 'Flowing water animation with blue gradients',
        score: 8.5,
        source: {
          fragments: ['frag-1'],
          collisionType: 'timestamp',
          domains: ['animation', 'nature'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      };

      const seed2: Seed = {
        id: 'seed-fire',
        content: 'Burning fire effects with orange particles',
        score: 9.0,
        source: {
          fragments: ['frag-2'],
          collisionType: 'semantic',
          domains: ['effects', 'particles'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      };

      await seedBank.add(seed1);
      await seedBank.add(seed2);

      // Retrieve seeds relevant to "water"
      const context = await retrieveSeedBankContext(seedBank, 'Create a water animation', 2);

      expect(context).toContain('Relevant seeds from archive:');
      expect(context).toContain('water');
    });

    it('should return empty string when seedBank is undefined', async () => {
      const context = await retrieveSeedBankContext(undefined, 'test prompt', 2);
      expect(context).toBe('');
    });

    it('should return empty string when topK is 0', async () => {
      const seed: Seed = {
        id: 'seed-1',
        content: 'Test seed content',
        score: 8.0,
        source: {
          fragments: ['frag-1'],
          collisionType: 'timestamp',
          domains: ['test'],
        },
        promotedAt: new Date().toISOString(),
        usedBy: [],
        useCount: 0,
      };
      await seedBank.add(seed);

      const context = await retrieveSeedBankContext(seedBank, 'test', 0);
      expect(context).toBe('');
    });
  });

  describe('Archive Retrieval Methods', () => {
    describe('MapElites.getDiverseElite', () => {
      it('should return diverse elites using tournament selection', () => {
        const mapElites = new MapElites([10, 10]);

        // Insert multiple creations with different behaviors and fitness
        for (let i = 0; i < 10; i++) {
          mapElites.insert(`creation-${i}`, [i / 10, (i * 0.7) % 1], 0.5 + i * 0.05);
        }

        const elites = mapElites.getDiverseElite(3);

        expect(elites.length).toBe(3);
        // Each elite should have unique creationId
        const ids = new Set(elites.map(e => e.creationId));
        expect(ids.size).toBe(3);
      });

      it('should return all cells if count exceeds available cells', () => {
        const mapElites = new MapElites([5, 5]);
        mapElites.insert('creation-1', [0.1, 0.2], 0.8);
        mapElites.insert('creation-2', [0.5, 0.6], 0.9);

        const elites = mapElites.getDiverseElite(10);

        expect(elites.length).toBe(2);
      });

      it('should return empty array when grid is empty', () => {
        const mapElites = new MapElites([5, 5]);
        const elites = mapElites.getDiverseElite(3);
        expect(elites).toEqual([]);
      });
    });

    describe('NoveltyArchive.retrieveNovelExamples', () => {
      it('should return novel examples sorted by novelty score', () => {
        const archive = new NoveltyArchive(100, 3);
        
        // Add distinct behavior vectors
        archive.add([0.1, 0.1, 0.1]);
        archive.add([0.9, 0.9, 0.9]);
        archive.add([0.5, 0.5, 0.5]);
        archive.add([0.2, 0.2, 0.2]);

        const examples = archive.retrieveNovelExamples(3);

        expect(examples.length).toBe(3);
        // All should have behavior vectors
        examples.forEach(ex => {
          expect(ex.behavior).not.toBeNull();
          expect(ex.noveltyScore).toBeGreaterThanOrEqual(0);
        });
      });

      it('should return empty array when archive is empty', () => {
        const archive = new NoveltyArchive(100, 5);
        const examples = archive.retrieveNovelExamples(3);
        expect(examples).toEqual([]);
      });
    });

    describe('SeedBank.retrieveRelevantSeeds', () => {
      let tmpDir: string;
      let seedBank: SeedBank;

      beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seedbank-retrieval-test-'));
        const config = mergeConfig({ seedDir: path.join(tmpDir, 'seeds') });
        seedBank = new SeedBank(config);
      });

      it('should return seeds sorted by relevance to prompt', async () => {
        const seed1: Seed = {
          id: 'seed-animation',
          content: 'Beautiful particle animation with flowing colors',
          score: 8.5,
          source: {
            fragments: ['frag-1'],
            collisionType: 'timestamp',
            domains: ['animation', 'particles'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        };

        const seed2: Seed = {
          id: 'seed-static',
          content: 'Static geometric composition with sharp lines',
          score: 7.0,
          source: {
            fragments: ['frag-2'],
            collisionType: 'semantic',
            domains: ['geometry'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        };

        await seedBank.add(seed1);
        await seedBank.add(seed2);

        // Search for animation-related seeds
        const results = await seedBank.retrieveRelevantSeeds('Create an animated particle system', 2);

        expect(results.length).toBe(2);
        // Animation seed should be more relevant
        expect(results[0].id).toBe('seed-animation');
      });

      it('should fall back to top seeds when no keywords match', async () => {
        const seed: Seed = {
          id: 'seed-high-score',
          content: 'High quality creative concept',
          score: 9.5,
          source: {
            fragments: ['frag-1'],
            collisionType: 'timestamp',
            domains: ['art'],
          },
          promotedAt: new Date().toISOString(),
          usedBy: [],
          useCount: 0,
        };

        await seedBank.add(seed);

        // Use prompt with only stop words
        const results = await seedBank.retrieveRelevantSeeds('the and a is', 1);

        expect(results.length).toBe(1);
        expect(results[0].id).toBe('seed-high-score');
      });

      it('should return empty array when seed bank is empty', async () => {
        const results = await seedBank.retrieveRelevantSeeds('test prompt', 3);
        expect(results).toEqual([]);
      });
    });
  });
});
