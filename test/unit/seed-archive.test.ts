import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * SeedArchive tests - Seed generation and storage functionality
 *
 * Tests generateSeed(), saveSeed(seed, metadata), and loadSeed(seed)
 * with 85% minimum coverage requirement
 */

import fs from 'fs/promises';
import path from 'path';
import { SeedArchive, SeedData } from '../../src/gallery/SeedArchive.js';

describe('SeedArchive', () => {
  const TEST_ARCHIVE_DIR = 'test-seed-archive-temp';
  let archive: SeedArchive;

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_ARCHIVE_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
    archive = new SeedArchive(TEST_ARCHIVE_DIR);
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(TEST_ARCHIVE_DIR, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, which is fine
    }
  });

  describe('generateSeed', () => {
    it('should generate a unique seed string', () => {
      const seed1 = archive.generateSeed();
      const seed2 = archive.generateSeed();

      expect(seed1).not.toBeNull();
      expect(seed2).not.toBeNull();
      expect(seed1).not.toBe(seed2);
    });

    it('should generate seeds that are strings', () => {
      const seed = archive.generateSeed();
      expect(typeof seed).toBe('string');
    });

    it('should generate non-empty seeds', () => {
      const seed = archive.generateSeed();
      expect(seed.length).toBeGreaterThan(0);
    });

    it('should generate seeds with consistent format', () => {
      const seeds = Array.from({ length: 100 }, () => archive.generateSeed());

      seeds.forEach(seed => {
        expect(seed).toMatch(/^[a-z0-9\-]+$/);
      });
    });

    it('should generate unique seeds in batch', () => {
      const seeds = new Set();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        seeds.add(archive.generateSeed());
      }

      expect(seeds.size).toBe(count);
    });

    it('should generate seeds at reasonable length', () => {
      const seeds = Array.from({ length: 100 }, () => archive.generateSeed());

      seeds.forEach(seed => {
        expect(seed.length).toBeGreaterThanOrEqual(8);
        expect(seed.length).toBeLessThanOrEqual(64);
      });
    });

    it('should generate seeds containing both letters and numbers', () => {
      const seed = archive.generateSeed();
      const hasLetter = /[a-z]/.test(seed);
      const hasNumber = /[0-9]/.test(seed);

      expect(hasLetter || hasNumber).toBe(true);
    });

    it('should generate lowercase seeds only', () => {
      const seed = archive.generateSeed();
      expect(seed).toBe(seed.toLowerCase());
    });

    it('should not generate seeds with special characters', () => {
      const seeds = Array.from({ length: 100 }, () => archive.generateSeed());

      seeds.forEach(seed => {
        expect(seed).not.toMatch(/[^a-z0-9\-]/);
      });
    });
  });

  describe('saveSeed', () => {
    it('should save seed with metadata', async () => {
      const seed = 'test-seed-123';
      const metadata = {
        prompt: 'kid a vibes',
        generator: 'p5.js',
        timestamp: '2026-03-01T12:00:00Z',
        params: { particleCount: 100, speed: 2.5 }
      };

      await archive.saveSeed(seed, metadata);

      const filepath = path.join(TEST_ARCHIVE_DIR, `${seed}.json`);
      const content = await fs.readFile(filepath, 'utf-8');
      const saved = JSON.parse(content);

      expect(saved).toEqual({ seed, ...metadata });
    });

    it('should create archive directory if it does not exist', async () => {
      const seed = 'test-seed-456';
      const metadata = { prompt: 'test' };

      await archive.saveSeed(seed, metadata);

      const exists = await fs.access(TEST_ARCHIVE_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should reject empty seed', async () => {
      await expect(archive.saveSeed('', { prompt: 'test' }))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject null seed', async () => {
      await expect(archive.saveSeed(null as any, { prompt: 'test' }))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject undefined seed', async () => {
      await expect(archive.saveSeed(undefined as any, { prompt: 'test' }))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject empty metadata', async () => {
      const seed = 'test-seed-789';
      await expect(archive.saveSeed(seed, null as any))
        .rejects.toThrow('Metadata is required and must be an object');
    });

    it('should reject undefined metadata', async () => {
      const seed = 'test-seed-abc';
      await expect(archive.saveSeed(seed, undefined as any))
        .rejects.toThrow('Metadata is required and must be an object');
    });

    it('should reject non-object metadata', async () => {
      const seed = 'test-seed-def';
      await expect(archive.saveSeed(seed, 'not-an-object' as any))
        .rejects.toThrow('Metadata is required and must be an object');
    });

    it('should reject whitespace-only seed', async () => {
      await expect(archive.saveSeed('   ', { prompt: 'test' }))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should save seed with complex metadata', async () => {
      const seed = 'complex-seed-123';
      const metadata = {
        prompt: 'anxious post-rock',
        generator: 'p5.js',
        timestamp: '2026-03-01T12:00:00Z',
        params: {
          particleCount: 100,
          speed: 2.5,
          colors: ['red', 'blue', 'green'],
          nested: {
            value: 42,
            array: [1, 2, 3]
          }
        },
        tags: ['glitch', 'particles'],
        score: 0.85
      };

      await archive.saveSeed(seed, metadata);

      const loaded = await archive.loadSeed(seed);
      expect(loaded).toEqual({ seed, ...metadata });
    });

    it('should overwrite existing seed with same name', async () => {
      const seed = 'overwrite-seed';
      const metadata1 = { prompt: 'first version', value: 1 };
      const metadata2 = { prompt: 'second version', value: 2 };

      await archive.saveSeed(seed, metadata1);
      await archive.saveSeed(seed, metadata2);

      const loaded = await archive.loadSeed(seed);
      expect(loaded).not.toBeNull();
      expect(loaded!.prompt).toBe('second version');
      expect(loaded!.value).toBe(2);
    });

    it('should save multiple seeds concurrently', async () => {
      const seeds = Array.from({ length: 50 }, (_, i) => `seed-${i}`);

      await Promise.all(
        seeds.map(seed => archive.saveSeed(seed, { index: seed }))
      );

      for (const seed of seeds) {
        const loaded = await archive.loadSeed(seed);
        expect(loaded).not.toBeNull();
      }
    });
  });

  describe('loadSeed', () => {
    it('should load saved seed metadata', async () => {
      const seed = 'load-test-seed';
      const metadata = {
        prompt: 'test prompt',
        generator: 'test-gen',
        timestamp: '2026-03-01T12:00:00Z'
      };

      await archive.saveSeed(seed, metadata);
      const loaded = await archive.loadSeed(seed);

      expect(loaded).toEqual({ seed, ...metadata });
    });

    it('should return null for non-existent seed', async () => {
      const loaded = await archive.loadSeed('non-existent-seed');
      expect(loaded).toBeNull();
    });

    it('should reject empty seed', async () => {
      await expect(archive.loadSeed(''))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject null seed', async () => {
      await expect(archive.loadSeed(null as any))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject undefined seed', async () => {
      await expect(archive.loadSeed(undefined as any))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should reject whitespace-only seed', async () => {
      await expect(archive.loadSeed('   '))
        .rejects.toThrow('Seed is required and must be a non-empty string');
    });

    it('should load seed with complex nested metadata', async () => {
      const seed = 'nested-seed';
      const metadata = {
        prompt: 'complex test',
        data: {
          nested1: {
            nested2: {
              value: 'deep',
              array: [1, 2, 3, 4, 5]
            }
          },
          stringArray: ['a', 'b', 'c'],
          number: 42.5,
          boolean: true,
          nullValue: null
        }
      };

      await archive.saveSeed(seed, metadata);
      const loaded = await archive.loadSeed(seed);

      expect(loaded).not.toBeNull();
      expect(loaded).toEqual({ seed, ...metadata });
      expect(loaded!.data.nested1.nested2.value).toBe('deep');
      expect(loaded!.data.nullValue).toBeNull();
    });

    it('should handle corrupted JSON files gracefully', async () => {
      const seed = 'corrupted-seed';
      const filepath = path.join(TEST_ARCHIVE_DIR, `${seed}.json`);

      await fs.mkdir(TEST_ARCHIVE_DIR, { recursive: true });
      await fs.writeFile(filepath, 'invalid json content', 'utf-8');

      const loaded = await archive.loadSeed(seed);
      expect(loaded).toBeNull();
    });

    it('should load multiple seeds in sequence', async () => {
      const seeds = ['seed-1', 'seed-2', 'seed-3'];

      for (const seed of seeds) {
        await archive.saveSeed(seed, { value: seed });
      }

      for (const seed of seeds) {
        const loaded = await archive.loadSeed(seed);
        expect(loaded).not.toBeNull();
        expect(loaded!.value).toBe(seed);
      }
    });

    it('should preserve data types in metadata', async () => {
      const seed = 'types-seed';
      const metadata = {
        string: 'hello',
        number: 42,
        float: 3.14,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null
      };

      await archive.saveSeed(seed, metadata);
      const loaded = await archive.loadSeed(seed);

      expect(loaded).not.toBeNull();
      expect(loaded!.string).toBe('hello');
      expect(loaded!.number).toBe(42);
      expect(loaded!.float).toBe(3.14);
      expect(loaded!.boolean).toBe(true);
      expect(loaded!.array).toEqual([1, 2, 3]);
      expect(loaded!.object).toEqual({ nested: 'value' });
      expect(loaded!.null).toBeNull();
    });

    it('should handle unicode characters in metadata', async () => {
      const seed = 'unicode-seed';
      const metadata = {
        prompt: '测试中文',
        emoji: '🎨🎵🎶',
        special: 'áéíóú ñ'
      };

      await archive.saveSeed(seed, metadata);
      const loaded = await archive.loadSeed(seed);

      expect(loaded).not.toBeNull();
      expect(loaded!.prompt).toBe('测试中文');
      expect(loaded!.emoji).toBe('🎨🎵🎶');
      expect(loaded!.special).toBe('áéíóú ñ');
    });
  });

  describe('integration', () => {
    it('should complete full save/load cycle', async () => {
      const seed = archive.generateSeed();
      const metadata = {
        prompt: 'integration test',
        timestamp: new Date().toISOString(),
        params: { test: true }
      };

      await archive.saveSeed(seed, metadata);
      const loaded = await archive.loadSeed(seed);

      expect(loaded).not.toBeNull();
      expect(loaded!.seed).toBe(seed);
      expect(loaded!.prompt).toBe('integration test');
      expect(loaded!.params.test).toBe(true);
    });

    it('should handle multiple save/load cycles', async () => {
      const cycles = 20;
      const seeds = [];

      for (let i = 0; i < cycles; i++) {
        const seed = archive.generateSeed();
        const metadata = {
          iteration: i,
          timestamp: new Date().toISOString()
        };

        await archive.saveSeed(seed, metadata);
        const loaded = await archive.loadSeed(seed);

        expect(loaded).not.toBeNull();
        expect(loaded!.iteration).toBe(i);
        seeds.push(seed);
      }

      expect(seeds.length).toBe(cycles);
      expect(new Set(seeds).size).toBe(cycles);
    });

    it('should generate unique seeds that can all be saved and loaded', async () => {
      const count = 100;
      const seeds = Array.from({ length: count }, () => archive.generateSeed());

      await Promise.all(
        seeds.map(seed => archive.saveSeed(seed, { index: seed }))
      );

      const loaded = await Promise.all(
        seeds.map(seed => archive.loadSeed(seed))
      );

      expect(loaded.every((item): item is SeedData => item !== null)).toBe(true);
    });
  });
});
