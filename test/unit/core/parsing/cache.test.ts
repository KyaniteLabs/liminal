/**
 * Unit tests for ParsingCache
 *
 * Tests file-hash-keyed parse cache that stores parsed LIR tokens.
 * Cache is keyed by SHA256 hash of file content to detect modifications.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'path';
import * as os from 'node:os';
import { ParsingCache } from '../../../../src/core/parsing/ParsingCache.js';
import type { LIRCodeToken } from '../../../../src/core/lir/types.js';

describe('ParsingCache', () => {
  let cacheDir: string;
  let cache: ParsingCache;
  let testFilePath: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sinter-cache-test-'));
    cache = new ParsingCache(cacheDir);
    testFilePath = path.join(cacheDir, 'test-file.ts');
  });

  afterEach(async () => {
    // Clean up the temporary directory
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  describe('get()', () => {
    it('should return null for uncached file', async () => {
      const result = await cache.get('/nonexistent/file.ts');

      expect(result).toBeNull();
    });

    it('should return null for file that does not exist on disk', async () => {
      const result = await cache.get('/some/path/that/does/not/exist.ts');

      expect(result).toBeNull();
    });
  });

  describe('set() and get()', () => {
    it('should store and retrieve token for same file', async () => {
      // Create a test file with some content
      const content = 'export function test() { return 42; }';
      await fs.writeFile(testFilePath, content);

      // Create a sample LIR token
      const token: LIRCodeToken = {
        id: 'test-token-id',
        type: 'code',
        domain: 'test-domain',
        layer: 'test-layer',
        metadata: {},
        tags: ['test'],
        name: 'test',
        kind: 'function',
        signature: 'test()',
        summary: 'Test function',
        source: content,
        language: 'typescript',
        location: {
          file: testFilePath,
          startLine: 1,
          endLine: 1,
        },
        relationships: {
          calls: [],
          imports: [],
          exports: ['test'],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 1,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      // Store the token
      await cache.set(testFilePath, token);

      // Retrieve it
      const result = await cache.get(testFilePath);

      expect(result).not.toBeNull();
      expect(result).toEqual(token);
    });

    it('should handle multiple tokens for different files', async () => {
      const file1 = path.join(cacheDir, 'file1.ts');
      const file2 = path.join(cacheDir, 'file2.ts');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const token1: LIRCodeToken = {
        id: 'token1',
        type: 'code',
        domain: 'd1',
        layer: 'l1',
        metadata: {},
        tags: [],
        name: 'f1',
        kind: 'function',
        signature: 'f1()',
        summary: 'Function 1',
        source: 'content1',
        language: 'typescript',
        location: { file: file1, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      const token2: LIRCodeToken = {
        id: 'token2',
        type: 'code',
        domain: 'd2',
        layer: 'l2',
        metadata: {},
        tags: [],
        name: 'f2',
        kind: 'function',
        signature: 'f2()',
        summary: 'Function 2',
        source: 'content2',
        language: 'typescript',
        location: { file: file2, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(file1, token1);
      await cache.set(file2, token2);

      const result1 = await cache.get(file1);
      const result2 = await cache.get(file2);

      expect(result1).toEqual(token1);
      expect(result2).toEqual(token2);
    });
  });

  describe('file modification detection', () => {
    it('should return null when file content has changed', async () => {
      const content = 'original content';
      await fs.writeFile(testFilePath, content);

      const token: LIRCodeToken = {
        id: 'test-token',
        type: 'code',
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
        name: 'test',
        kind: 'function',
        signature: 'test()',
        summary: 'Test',
        source: content,
        language: 'typescript',
        location: { file: testFilePath, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(testFilePath, token);

      // Modify the file
      await fs.writeFile(testFilePath, 'modified content');

      // Cache should not return the old token
      const result = await cache.get(testFilePath);
      expect(result).toBeNull();
    });

    it('should return token when file content is unchanged', async () => {
      const content = 'stable content';
      await fs.writeFile(testFilePath, content);

      const token: LIRCodeToken = {
        id: 'test-token',
        type: 'code',
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
        name: 'test',
        kind: 'function',
        signature: 'test()',
        summary: 'Test',
        source: content,
        language: 'typescript',
        location: { file: testFilePath, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(testFilePath, token);

      // File content unchanged
      const result = await cache.get(testFilePath);
      expect(result).toEqual(token);
    });
  });

  describe('persistence', () => {
    it('should persist cache to disk and survive re-instantiation', async () => {
      const content = 'persistent content';
      await fs.writeFile(testFilePath, content);

      const token: LIRCodeToken = {
        id: 'persistent-token',
        type: 'code',
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: ['persistent'],
        name: 'persistent',
        kind: 'function',
        signature: 'persistent()',
        summary: 'Persistent token',
        source: content,
        language: 'typescript',
        location: { file: testFilePath, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      // Store token in first cache instance
      await cache.set(testFilePath, token);

      // Create a new cache instance with same cache directory
      const newCache = new ParsingCache(cacheDir);

      // Should retrieve the persisted token
      const result = await newCache.get(testFilePath);
      expect(result).toEqual(token);
    });

    it('should load cached entries from disk on initialization', async () => {
      const file1 = path.join(cacheDir, 'disk1.ts');
      const file2 = path.join(cacheDir, 'disk2.ts');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const token1: LIRCodeToken = {
        id: 'disk1',
        type: 'code',
        domain: 'd1',
        layer: 'l1',
        metadata: {},
        tags: [],
        name: 'disk1',
        kind: 'function',
        signature: 'disk1()',
        summary: 'Disk 1',
        source: 'content1',
        language: 'typescript',
        location: { file: file1, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      const token2: LIRCodeToken = {
        id: 'disk2',
        type: 'code',
        domain: 'd2',
        layer: 'l2',
        metadata: {},
        tags: [],
        name: 'disk2',
        kind: 'function',
        signature: 'disk2()',
        summary: 'Disk 2',
        source: 'content2',
        language: 'typescript',
        location: { file: file2, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(file1, token1);
      await cache.set(file2, token2);

      // Create new cache instance
      const newCache = new ParsingCache(cacheDir);

      // Both tokens should be available
      const result1 = await newCache.get(file1);
      const result2 = await newCache.get(file2);

      expect(result1).toEqual(token1);
      expect(result2).toEqual(token2);
    });
  });

  describe('clear()', () => {
    it('should remove all cached entries', async () => {
      const file1 = path.join(cacheDir, 'clear1.ts');
      const file2 = path.join(cacheDir, 'clear2.ts');

      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');

      const token1: LIRCodeToken = {
        id: 'clear1',
        type: 'code',
        domain: 'd1',
        layer: 'l1',
        metadata: {},
        tags: [],
        name: 'clear1',
        kind: 'function',
        signature: 'clear1()',
        summary: 'Clear 1',
        source: 'content1',
        language: 'typescript',
        location: { file: file1, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      const token2: LIRCodeToken = {
        id: 'clear2',
        type: 'code',
        domain: 'd2',
        layer: 'l2',
        metadata: {},
        tags: [],
        name: 'clear2',
        kind: 'function',
        signature: 'clear2()',
        summary: 'Clear 2',
        source: 'content2',
        language: 'typescript',
        location: { file: file2, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(file1, token1);
      await cache.set(file2, token2);

      // Clear the cache
      await cache.clear();

      // All entries should be gone
      const result1 = await cache.get(file1);
      const result2 = await cache.get(file2);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should remove cache directory files', async () => {
      const content = 'test content';
      await fs.writeFile(testFilePath, content);

      const token: LIRCodeToken = {
        id: 'test',
        type: 'code',
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
        name: 'test',
        kind: 'function',
        signature: 'test()',
        summary: 'Test',
        source: content,
        language: 'typescript',
        location: { file: testFilePath, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await cache.set(testFilePath, token);
      await cache.clear();

      // Cache directory should be empty or not exist
      const cacheFiles = await fs.readdir(cacheDir).catch(() => []);
      const cacheJsonFiles = cacheFiles.filter((f) => f.endsWith('.json'));

      expect(cacheJsonFiles).toHaveLength(0);
    });
  });

  describe('cache directory management', () => {
    it('should create cache directory if it does not exist', async () => {
      const nonExistentDir = path.join(os.tmpdir(), `sinter-test-${Date.now()}`);
      const newCache = new ParsingCache(nonExistentDir);

      // Should not throw when setting
      const content = 'test';
      const testFile = path.join(cacheDir, 'test.ts');
      await fs.writeFile(testFile, content);

      const token: LIRCodeToken = {
        id: 'test',
        type: 'code',
        domain: 'test',
        layer: 'test',
        metadata: {},
        tags: [],
        name: 'test',
        kind: 'function',
        signature: 'test()',
        summary: 'Test',
        source: content,
        language: 'typescript',
        location: { file: testFile, startLine: 1, endLine: 1 },
        relationships: {
          calls: [],
          imports: [],
          exports: [],
          extends: [],
          importGraph: [],
        },
        metrics: {
          loc: 1,
          cyclomaticComplexity: 1,
          paramCount: 0,
          importCount: 0,
          exportCount: 0,
          callCount: 0,
          classDepth: 0,
          nestingDepth: 0,
        },
      };

      await newCache.set(testFile, token);

      // Clean up
      await fs.rm(nonExistentDir, { recursive: true, force: true });
    });
  });
});
