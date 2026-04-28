import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for CompostHeap — file management and capacity tracking.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostHeap } from '../../src/compost/CompostHeap.js';

describe('CompostHeap', () => {
  let tmpDir: string;
  let heap: CompostHeap;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'compost-heap-test-'));
    heap = new CompostHeap({ heapDir: tmpDir, maxHeapSizeBytes: 1024 });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('addFile()', () => {
    it('copies a file to the heap directory', async () => {
      const srcFile = path.join(tmpDir, 'source.txt');
      await fs.writeFile(srcFile, 'hello world');

      const heapPath = await heap.addFile(srcFile);
      expect(heapPath).not.toBeNull();
      const content = await fs.readFile(heapPath, 'utf-8');
      expect(content).toBe('hello world');
    });

    it('preserves original filename', async () => {
      const srcFile = path.join(tmpDir, 'my-file.txt');
      await fs.writeFile(srcFile, 'data');

      const heapPath = await heap.addFile(srcFile);
      expect(path.basename(heapPath)).toBe('my-file.txt');
    });
  });

  describe('addDirectory()', () => {
    it('recursively copies a directory into the heap', async () => {
      const srcDir = path.join(tmpDir, 'src-project');
      await fs.mkdir(path.join(srcDir, 'sub'), { recursive: true });
      await fs.writeFile(path.join(srcDir, 'a.txt'), 'a');
      await fs.writeFile(path.join(srcDir, 'sub', 'b.txt'), 'b');

      const copiedPaths = await heap.addDirectory(srcDir);
      expect(copiedPaths).toHaveLength(2);
      expect(copiedPaths.some(p => p.endsWith('a.txt'))).toBe(true);
      expect(copiedPaths.some(p => p.endsWith('b.txt'))).toBe(true);
    });
  });

  describe('getHeapSize()', () => {
    it('returns total bytes of all files in heap', async () => {
      const srcFile = path.join(tmpDir, 'source.txt');
      await fs.writeFile(srcFile, 'hello'); // 5 bytes

      await heap.addFile(srcFile);
      const size = await heap.getHeapSize();
      expect(size).toBe(5);
    });

    it('returns 0 for empty heap', async () => {
      const size = await heap.getHeapSize();
      expect(size).toBe(0);
    });
  });

  describe('isOverCapacity()', () => {
    it('returns true when heap exceeds 80% of max', async () => {
      const bigFile = path.join(tmpDir, 'big.txt');
      // maxHeapSizeBytes=1024, 80% = 819.2, write 900 bytes
      await fs.writeFile(bigFile, 'x'.repeat(900));

      await heap.addFile(bigFile);
      expect(await heap.isOverCapacity()).toBe(true);
    });

    it('returns false when heap under 80%', async () => {
      const smallFile = path.join(tmpDir, 'small.txt');
      await fs.writeFile(smallFile, 'x'.repeat(100)); // well under 819.2

      await heap.addFile(smallFile);
      expect(await heap.isOverCapacity()).toBe(false);
    });
  });

  describe('listFiles()', () => {
    it('returns relative paths of heap files', async () => {
      const srcFile = path.join(tmpDir, 'test.txt');
      await fs.writeFile(srcFile, 'data');

      await heap.addFile(srcFile);
      const files = await heap.listFiles();
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('test.txt');
    });
  });

  describe('clear()', () => {
    it('removes all files from heap', async () => {
      const srcFile = path.join(tmpDir, 'test.txt');
      await fs.writeFile(srcFile, 'data');
      await heap.addFile(srcFile);

      await heap.clear();
      expect(await heap.listFiles()).toHaveLength(0);
    });

    it('preserves the heap directory itself', async () => {
      await heap.clear();
      await fs.access(tmpDir); // should not throw
    });
  });

  describe('purge()', () => {
    it('removes all files (same as clear)', async () => {
      const srcFile = path.join(tmpDir, 'test.txt');
      await fs.writeFile(srcFile, 'data');
      await heap.addFile(srcFile);

      await heap.purge();
      expect(await heap.listFiles()).toHaveLength(0);
      expect(await heap.getHeapSize()).toBe(0);
    });
  });

  describe('auto-creation', () => {
    it('creates heap directory on first access', async () => {
      const newDir = path.join(tmpDir, 'nonexistent-heap');
      const newHeap = new CompostHeap({ heapDir: newDir, maxHeapSizeBytes: 1024 });
      await newHeap.listFiles(); // trigger access
      await fs.access(newDir); // should not throw
    });
  });
});
