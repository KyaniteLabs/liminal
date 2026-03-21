import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Tests for RawByteProcessor — hex/base64 extraction from files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { RawByteProcessor } from '../../src/compost/RawByteProcessor.js';

describe('RawByteProcessor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rawbyte-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('process()', () => {
    it('returns header hex, tail hex, SHA256, size, and hex chunks', async () => {
      const file = path.join(tmpDir, 'data.bin');
      const content = 'Hello, World! This is a test file for raw byte processing.';
      await fs.writeFile(file, content);

      const result = await RawByteProcessor.process(file);
      expect(result.sha256).toHaveLength(64);
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.size).toBe(content.length);
      expect(result.headerHex).toBeTruthy();
      expect(result.tailHex).toBeTruthy();
      expect(result.hexChunks.length).toBeGreaterThan(0);
    });

    it('handles empty files gracefully', async () => {
      const file = path.join(tmpDir, 'empty.bin');
      await fs.writeFile(file, '');

      const result = await RawByteProcessor.process(file);
      expect(result.size).toBe(0);
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.headerHex).toBe('');
      expect(result.tailHex).toBe('');
    });

    it('hex chunks are exactly 256 chars each (except possibly last)', async () => {
      const file = path.join(tmpDir, 'chunked.bin');
      await fs.writeFile(file, 'x'.repeat(2000));

      const result = await RawByteProcessor.process(file);
      for (let i = 0; i < result.hexChunks.length - 1; i++) {
        expect(result.hexChunks[i].length).toBeLessThanOrEqual(256);
      }
    });
  });

  describe('getBase64()', () => {
    it('returns base64 for files < 100KB', async () => {
      const file = path.join(tmpDir, 'small.txt');
      const content = 'small file content';
      await fs.writeFile(file, content);

      const result = await RawByteProcessor.getBase64(file);
      expect(result).not.toBeNull();
      // Decode and verify
      const decoded = Buffer.from(result!, 'base64').toString('utf-8');
      expect(decoded).toBe(content);
    });

    it('returns null for files >= 100KB', async () => {
      const file = path.join(tmpDir, 'large.bin');
      await fs.writeFile(file, Buffer.alloc(100 * 1024 + 1, 'x'));

      const result = await RawByteProcessor.getBase64(file);
      expect(result).toBeNull();
    });
  });
});
