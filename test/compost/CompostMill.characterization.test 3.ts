/**
 * Characterization tests for CompostMill promise behavior
 * Captures current behavior before async/await refactoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../src/compost/CompostMill.js';

describe('CompostMill Promise Characterization', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let mill: CompostMill;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mill-char-test-'));
    const heapDir = path.join(tmpDir, 'heap');
    const digestDir = path.join(tmpDir, 'digest');
    const seedDir = path.join(tmpDir, 'seeds');
    const soupStatePath = path.join(tmpDir, 'soup-state.json');

    const mockFn: any = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Generated content' });
    mockLLM = { generate: mockFn };

    mill = new CompostMill(mockLLM, {
      heapDir,
      digestDir,
      seedDir,
      soupStatePath,
      maxHeapSizeBytes: 1024 * 1024,
      soupEnabled: false,
    });
  });

  afterEach(async () => {
    mill.stopSoup();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('statusAsync() promise behavior', () => {
    it('should return a Promise that resolves to MillStatus', async () => {
      const result = mill.statusAsync();
      
      // Verify it returns a Promise
      expect(result).toBeInstanceOf(Promise);
      
      // Verify it resolves to expected shape
      const status = await result;
      expect(status).toHaveProperty('heapSize');
      expect(status).toHaveProperty('heapFileCount');
      expect(status).toHaveProperty('seedCount');
      expect(status).toHaveProperty('soupRunning');
      expect(status).toHaveProperty('soupGeneration');
      expect(status).toHaveProperty('lastDigestAt');
    });

    it('should correctly count heap files using internal .then() transformation', async () => {
      // Add some files to heap
      const file1 = path.join(tmpDir, 'file1.txt');
      const file2 = path.join(tmpDir, 'file2.txt');
      await fs.writeFile(file1, 'content1');
      await fs.writeFile(file2, 'content2');
      await mill.add([file1, file2]);

      const status = await mill.statusAsync();
      
      // This verifies the .then(f => f.length) behavior is working
      expect(status.heapFileCount).toBe(2);
    });

    it('should handle empty heap correctly', async () => {
      const status = await mill.statusAsync();
      
      // When heap is empty, .then(f => f.length) should return 0
      expect(status.heapFileCount).toBe(0);
      expect(status.heapSize).toBe(0);
    });

    it('should resolve all status fields in parallel via Promise.all', async () => {
      // This test characterizes that statusAsync uses Promise.all for parallel resolution
      const startTime = Date.now();
      const status = await mill.statusAsync();
      const duration = Date.now() - startTime;
      
      // Should resolve quickly (parallel, not sequential)
      expect(duration).toBeLessThan(100);
      expect(status.heapSize).toBe(0);
      expect(status.heapFileCount).toBe(0);
      expect(status.seedCount).toBe(0);
    });

    it('should maintain consistent state between calls', async () => {
      const status1 = await mill.statusAsync();
      const status2 = await mill.statusAsync();
      
      // Multiple calls should return consistent results for same state
      expect(status1.heapFileCount).toBe(status2.heapFileCount);
      expect(status1.seedCount).toBe(status2.seedCount);
      expect(status1.heapSize).toBe(status2.heapSize);
    });
  });

  describe('add() promise behavior with .catch()', () => {
    it('should handle non-existent files gracefully via .catch() pattern', async () => {
      // Adding a non-existent file should not throw
      const nonExistentPath = path.join(tmpDir, 'does-not-exist.txt');
      
      // Should not throw
      await expect(mill.add([nonExistentPath])).resolves.not.toThrow();
      
      // Heap should remain empty
      const files = await mill.getHeapFiles();
      expect(files).toHaveLength(0);
    });

    it('should continue processing when one path is invalid', async () => {
      const validFile = path.join(tmpDir, 'valid.txt');
      const invalidPath = path.join(tmpDir, 'invalid');
      await fs.writeFile(validFile, 'valid content');

      // Mix of valid and invalid paths
      await mill.add([validFile, invalidPath]);

      // Should have processed the valid file
      const files = await mill.getHeapFiles();
      expect(files).toHaveLength(1);
    });
  });

  describe('digest() result promise behavior', () => {
    it('should return Promise<DigestResult> with proper structure', async () => {
      const file = path.join(tmpDir, 'test.txt');
      await fs.writeFile(file, 'Test content for digestion');
      await mill.add([file]);

      const resultPromise = mill.digest();
      expect(resultPromise).toBeInstanceOf(Promise);

      const result = await resultPromise;
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('seeds');
      expect(result).toHaveProperty('digestPath');
      expect(Array.isArray(result.seeds)).toBe(true);
    });
  });
});
