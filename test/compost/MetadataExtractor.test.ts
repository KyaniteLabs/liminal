import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for MetadataExtractor — structured metadata extraction.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MetadataExtractor } from '../../src/compost/MetadataExtractor.js';

describe('MetadataExtractor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('extract()', () => {
    it('returns structured metadata with system-level fields', async () => {
      const file = path.join(tmpDir, 'test.txt');
      await fs.writeFile(file, 'hello world');
      const meta = await MetadataExtractor.extract(file);
      expect(meta.fileType).toBe('txt');
      expect(meta.size).toBe(11);
      expect(meta.hash).toHaveLength(64);
      expect(meta.extractedAt).toBeTruthy();
      expect(meta.timestamp).toBeTruthy();
    });

    it('extracts code metadata: LOC and language', async () => {
      const file = path.join(tmpDir, 'code.ts');
      await fs.writeFile(file, 'function foo() {\n  return 1;\n}');
      const meta = await MetadataExtractor.extract(file);
      expect(meta.language).toBe('typescript');
      expect(meta.loc).toBe(3);
    });

    it('detects language from extension', async () => {
      const pyFile = path.join(tmpDir, 'script.py');
      await fs.writeFile(pyFile, 'print("hello")');
      const meta = await MetadataExtractor.extract(pyFile);
      expect(meta.language).toBe('python');
    });

    it('handles unsupported formats gracefully', async () => {
      const file = path.join(tmpDir, 'data.xyz');
      await fs.writeFile(file, 'binary data here');
      const meta = await MetadataExtractor.extract(file);
      expect(meta.fileType).toBe('xyz');
      expect(meta.size).not.toBeNull();
    });
  });

  describe('extractAll()', () => {
    it('processes batch in parallel', async () => {
      const files = [
        path.join(tmpDir, 'a.txt'),
        path.join(tmpDir, 'b.txt'),
      ];
      await Promise.all([
        fs.writeFile(files[0], 'aaa'),
        fs.writeFile(files[1], 'bbb'),
      ]);
      const results = await MetadataExtractor.extractAll(files);
      expect(results.size).toBe(2);
      expect(results.get(files[0])?.size).toBe(3);
      expect(results.get(files[1])?.size).toBe(3);
    });

    it('returns empty map for empty input', async () => {
      const results = await MetadataExtractor.extractAll([]);
      expect(results.size).toBe(0);
    });
  });
});
