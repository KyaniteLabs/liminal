import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for CompostMill — main orchestrator.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../src/compost/CompostMill.js';

describe('CompostMill', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let mill: CompostMill;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mill-test-'));
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

  describe('add()', () => {
    it('adds files to the heap', async () => {
      const file = path.join(tmpDir, 'input.txt');
      await fs.writeFile(file, 'hello compost');
      await mill.add([file]);

      const files = await mill.getHeapFiles();
      expect(files.length).toBe(1);
    });

    it('adds directories to the heap', async () => {
      const dir = path.join(tmpDir, 'project');
      await fs.mkdir(path.join(dir, 'src'), { recursive: true });
      await fs.writeFile(path.join(dir, 'a.txt'), 'aaa');
      await fs.writeFile(path.join(dir, 'src', 'b.ts'), 'bbb');
      await mill.add([dir]);

      const files = await mill.getHeapFiles();
      expect(files.length).toBe(2);
    });
  });

  describe('digest()', () => {
    it('runs full pipeline: heap → extract → shred → mix → mine → digest → prune', async () => {
      const file = path.join(tmpDir, 'doc.txt');
      await fs.writeFile(file, 'A creative document about ceramics and music.\n\nThe glaze frequency matches the tempo of the kiln.\n\nCross-domain idea emerges here.');
      await mill.add([file]);

      const result = await mill.digest();
      expect(result.stats.filesProcessed).toBe(1);
      expect(result.stats.fragmentCount).toBeGreaterThan(0);
      expect(result.digestPath).toBeTruthy();
    });

    it('clears heap after successful digestion', async () => {
      const file = path.join(tmpDir, 'doc.txt');
      await fs.writeFile(file, 'Content for digestion');
      await mill.add([file]);

      await mill.digest();
      const status = await mill.statusAsync();
      expect(status.heapFileCount).toBe(0);
    });

    it('saves digest markdown', async () => {
      const file = path.join(tmpDir, 'doc.txt');
      await fs.writeFile(file, 'Digest test content');
      await mill.add([file]);

      const result = await mill.digest();
      const exists = await fs.access(result.digestPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('statusAsync()', () => {
    it('returns current state', async () => {
      const status = await mill.statusAsync();
      expect(status.heapSize).toBe(0);
      expect(status.heapFileCount).toBe(0);
      expect(status.seedCount).toBe(0);
      expect(status.soupRunning).toBe(false);
    });
  });

  describe('shouldAutoDigest()', () => {
    it('returns false when heap under capacity', async () => {
      expect(await mill.shouldAutoDigest()).toBe(false);
    });
  });
});
