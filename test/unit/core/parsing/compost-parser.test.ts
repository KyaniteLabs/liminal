/**
 * Unit tests for CompostParser
 *
 * Tests the dispatcher that routes files to appropriate parsers based on extension
 * and integrates ParsingCache for performance optimization.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CompostParser } from '../../../../src/core/parsing/CompostParser.js';
import { LIRParseError } from '../../../../src/core/lir/errors.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'path';

describe('CompostParser', () => {
  let tempDir: string;
  let parser: CompostParser;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compost-parser-test-'));
    const cacheDir = path.join(tempDir, 'cache');
    parser = new CompostParser(cacheDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('File extension routing', () => {
    it('should route .ts files to CodeParser', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      const result = await parser.parseFile(tsFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
      expect(result[0].name).toBe('test');
    });

    it('should route .tsx files to CodeParser', async () => {
      const tsxFile = path.join(tempDir, 'test.tsx');
      await fs.writeFile(
        tsxFile,
        'function test() { return <div>Hello</div>; }'
      );

      const result = await parser.parseFile(tsxFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
    });

    it('should route .js files to CodeParser', async () => {
      const jsFile = path.join(tempDir, 'test.js');
      await fs.writeFile(jsFile, 'function test() { return 42; }');

      const result = await parser.parseFile(jsFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
      expect(result[0].name).toBe('test');
    });

    it('should route .jsx files to CodeParser', async () => {
      const jsxFile = path.join(tempDir, 'test.jsx');
      await fs.writeFile(
        jsxFile,
        'function test() { return <div>Hello</div>; }'
      );

      const result = await parser.parseFile(jsxFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
    });

    it('should route .md files to DocParser', async () => {
      const mdFile = path.join(tempDir, 'test.md');
      await fs.writeFile(
        mdFile,
        '# Test Header\n\nThis is test content.'
      );

      const result = await parser.parseFile(mdFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('doc');
      expect(result[0].heading).toBe('Test Header');
    });

    it('should route .markdown files to DocParser', async () => {
      const markdownFile = path.join(tempDir, 'test.markdown');
      await fs.writeFile(
        markdownFile,
        '# Test Header\n\nThis is test content.'
      );

      const result = await parser.parseFile(markdownFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('doc');
    });

    it('should route .txt files to TextParser', async () => {
      const txtFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(txtFile, 'This is plain text content.');

      const result = await parser.parseFile(txtFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('This is plain text content.');
    });

    it('should route .csv files to TextParser', async () => {
      const csvFile = path.join(tempDir, 'test.csv');
      await fs.writeFile(csvFile, 'name,age\nJohn,30\nJane,25');

      const result = await parser.parseFile(csvFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('text');
    });

    it('should route unknown file extensions to TextParser', async () => {
      const unknownFile = path.join(tempDir, 'test.unknown');
      await fs.writeFile(unknownFile, 'Some unknown file content.');

      const result = await parser.parseFile(unknownFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('text');
    });
  });

  describe('Caching behavior', () => {
    it('should return cached token on cache hit', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      // First parse - should cache the result
      const firstResult = await parser.parseFile(tsFile);
      const firstId = firstResult[0].id;

      // Second parse - should return cached result
      const secondResult = await parser.parseFile(tsFile);
      const secondId = secondResult[0].id;

      expect(firstId).toBe(secondId);
    });

    it('should re-parse and cache on cache miss (file modified)', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      // First parse
      const firstResult = await parser.parseFile(tsFile);
      const firstId = firstResult[0].id;

      // Modify the file
      await fs.writeFile(tsFile, 'function test() { return 100; }');

      // Second parse - should get different result (cache invalidated)
      const secondResult = await parser.parseFile(tsFile);
      const secondId = secondResult[0].id;

      expect(firstId).not.toBe(secondId);
    });

    it('should cache result after parsing', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      // Parse the file
      await parser.parseFile(tsFile);

      // Verify the cache file was created
      const cacheDir = path.join(tempDir, 'cache');
      const cacheFiles = await fs.readdir(cacheDir);
      expect(cacheFiles.length).toBeGreaterThan(0);
      expect(cacheFiles[0]).toMatch(/\.json$/);
    });
  });

  describe('Cache management', () => {
    it('should delegate clearCache to ParsingCache', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      // Parse to create cache
      await parser.parseFile(tsFile);

      // Clear cache
      await parser.clearCache();

      // Verify cache directory is empty
      const cacheDir = path.join(tempDir, 'cache');
      const cacheFiles = await fs.readdir(cacheDir).catch(() => []);
      expect(cacheFiles.length).toBe(0);
    });

    it('should allow parsing after cache is cleared', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(tsFile, 'function test() { return 42; }');

      // Parse
      const firstResult = await parser.parseFile(tsFile);
      expect(firstResult.length).toBeGreaterThan(0);

      // Clear cache
      await parser.clearCache();

      // Parse again - should work
      const secondResult = await parser.parseFile(tsFile);
      expect(secondResult.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should throw LIRParseError for unreadable files', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');

      await expect(parser.parseFile(nonExistentFile)).rejects.toThrow(
        LIRParseError
      );
    });

    it('should throw LIRParseError for files with syntax errors', async () => {
      const tsFile = path.join(tempDir, 'broken.ts');
      await fs.writeFile(tsFile, 'function broken() {'); // Missing closing brace

      await expect(parser.parseFile(tsFile)).rejects.toThrow(LIRParseError);
    });

    it('should include file path in error details', async () => {
      const nonExistentFile = path.join(tempDir, 'missing.txt');

      try {
        await parser.parseFile(nonExistentFile);
        expect.fail('Should have thrown LIRParseError');
      } catch (error) {
        expect(error).toBeInstanceOf(LIRParseError);
        expect((error as LIRParseError).source).toBe(nonExistentFile);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty files', async () => {
      const tsFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(tsFile, '');

      const result = await parser.parseFile(tsFile);

      expect(result).toBeDefined();
      // CodeParser returns empty array for files with no symbols
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle files with only whitespace', async () => {
      const txtFile = path.join(tempDir, 'whitespace.txt');
      await fs.writeFile(txtFile, '   \n\n   \n   ');

      const result = await parser.parseFile(txtFile);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle files without extensions', async () => {
      const noExtFile = path.join(tempDir, 'Makefile');
      await fs.writeFile(noExtFile, 'build:\n\techo "Building"');

      const result = await parser.parseFile(noExtFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('text');
    });

    it('should handle case-insensitive extensions', async () => {
      const upperCaseFile = path.join(tempDir, 'test.TS');
      await fs.writeFile(upperCaseFile, 'function test() { return 42; }');

      const result = await parser.parseFile(upperCaseFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
    });

    it('should handle mixed case extensions', async () => {
      const mixedCaseFile = path.join(tempDir, 'test.Js');
      await fs.writeFile(mixedCaseFile, 'function test() { return 42; }');

      const result = await parser.parseFile(mixedCaseFile);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
    });
  });

  describe('Parser integration', () => {
    it('should preserve all CodeParser token properties', async () => {
      const tsFile = path.join(tempDir, 'test.ts');
      await fs.writeFile(
        tsFile,
        'function test(x: number): number { return x * 2; }'
      );

      const result = await parser.parseFile(tsFile);

      expect(result[0].id).toBeDefined();
      expect(result[0].type).toBe('code');
      expect(result[0].name).toBe('test');
      expect(result[0].kind).toBe('function');
      expect(result[0].signature).toBeDefined();
      expect(result[0].source).toBeDefined();
      expect(result[0].language).toBe('typescript');
      expect(result[0].location).toBeDefined();
      expect(result[0].relationships).toBeDefined();
      expect(result[0].metrics).toBeDefined();
    });

    it('should preserve all DocParser token properties', async () => {
      const mdFile = path.join(tempDir, 'test.md');
      await fs.writeFile(
        mdFile,
        '# Test\n\nContent here.'
      );

      const result = await parser.parseFile(mdFile);

      expect(result[0].id).toBeDefined();
      expect(result[0].type).toBe('doc');
      expect(result[0].heading).toBe('Test');
      expect(result[0].level).toBe(1);
      expect(result[0].content).toBeDefined();
      expect(result[0].hierarchy).toBeDefined();
      expect(result[0].metrics).toBeDefined();
    });

    it('should preserve all TextParser token properties', async () => {
      const txtFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(txtFile, 'Plain text content here.');

      const result = await parser.parseFile(txtFile);

      expect(result[0].id).toBeDefined();
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Plain text content here.');
      expect(result[0].structure).toBeDefined();
      expect(result[0].metrics).toBeDefined();
    });
  });
});
