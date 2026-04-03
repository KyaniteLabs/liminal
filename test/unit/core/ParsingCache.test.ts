import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ParsingCache } from '../../../src/core/parsing/ParsingCache.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_CACHE_DIR = path.join(os.tmpdir(), 'liminal-parsing-cache-test');

describe('ParsingCache', () => {
  let cache: ParsingCache;

  beforeEach(async () => {
    await fs.mkdir(TEST_CACHE_DIR, { recursive: true });
    cache = new ParsingCache(TEST_CACHE_DIR);
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('set() - error handling', () => {
    it('should catch fs operations errors and throw with context (RED)', async () => {
      // Mock fs.mkdir to simulate failure
      const mkdirSpy = vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(
        new Error('Permission denied')
      );

      const testFile = path.join(TEST_CACHE_DIR, 'test.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      // Should throw with context about cache operation
      await expect(
        cache.set(testFile, { type: 'text', content: 'test' })
      ).rejects.toThrow(/cache|Cache/);

      mkdirSpy.mockRestore();
    });

    it('should catch writeFile errors and throw with context (RED)', async () => {
      // Mock fs.writeFile to simulate failure  
      const writeFileSpy = vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(
        new Error('Disk full')
      );

      const testFile = path.join(TEST_CACHE_DIR, 'test.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      // Should throw with context about cache write
      await expect(
        cache.set(testFile, { type: 'text', content: 'test' })
      ).rejects.toThrow(/cache|Cache|write|Write/);

      writeFileSpy.mockRestore();
    });

    it('should handle JSON serialization errors gracefully (RED)', async () => {
      const testFile = path.join(TEST_CACHE_DIR, 'test.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      // Create token with circular reference that can't be serialized
      const circularToken = {
        type: 'test',
        content: 'test',
        self: null as unknown,
      };
      circularToken.self = circularToken;

      // Should throw when trying to serialize
      await expect(
        cache.set(testFile, circularToken as any)
      ).rejects.toThrow();
    });
  });
});
