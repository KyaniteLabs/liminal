import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    it('should throw error with cache context when file does not exist', async () => {
      // Try to cache a non-existent file
      const nonExistentFile = '/nonexistent/path/file.ts';

      // Should throw with cache context
      await expect(
        cache.set(nonExistentFile, { type: 'text', content: 'test' })
      ).rejects.toThrow(/cache|Cache/);
    });

    it('should handle JSON serialization errors gracefully', async () => {
      const testFile = path.join(TEST_CACHE_DIR, 'test.ts');
      await fs.writeFile(testFile, 'const x = 1;');

      // Create token with circular reference that can't be serialized
      const circularToken = {
        type: 'test',
        content: 'test',
        self: null as unknown,
      };
      circularToken.self = circularToken;

      // Should throw when trying to serialize with cache context
      await expect(
        cache.set(testFile, circularToken as any)
      ).rejects.toThrow(/cache|Cache/);
    });
  });
});
