import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for SemanticExtractor — LLM-based semantic content extraction.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SemanticExtractor } from '../../src/compost/SemanticExtractor.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import '../../src/prompts/compost.js'; // Register compost prompt templates

describe('SemanticExtractor', () => {
  let tmpDir: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGenerate: any;
  let extractor: SemanticExtractor;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'semantic-test-'));
    mockGenerate = vi.fn();
    const config = mergeConfig();
    extractor = new SemanticExtractor(config, { generate: mockGenerate } as any);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('extractText()', () => {
    it('returns semantic summary for text content', async () => {
      const result = await extractor.extractText('Hello world. This is a test.', '/test/file.txt');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles empty content', async () => {
      const result = await extractor.extractText('', '/test/empty.txt');
      expect(result).toBeDefined();
    });
  });

  describe('extractCode()', () => {
    it('extracts semantic info from code files', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        code: 'A function that calculates factorial',
      });
      const file = path.join(tmpDir, 'code.ts');
      await fs.writeFile(file, 'function factorial(n: number): number { return n <= 1 ? 1 : n * factorial(n - 1); }');

      const result = await extractor.extractCode(file);
      expect(result).toContain('factorial');
    });
  });

  describe('extractImage()', () => {
    it('returns stub message for image files', async () => {
      const file = path.join(tmpDir, 'photo.jpg');
      await fs.writeFile(file, Buffer.alloc(100, 0xff));

      const result = await extractor.extractImage(file);
      expect(result).toContain('[Image: photo.jpg');
      expect(result).toContain('KB');
      expect(result).toContain('vision');
    });
  });

  describe('extractAudio()', () => {
    it('returns transcription/summary stub', async () => {
      const file = path.join(tmpDir, 'audio.m4a');
      await fs.writeFile(file, Buffer.alloc(100));

      const result = await extractor.extractAudio(file);
      expect(result).toContain('audio');
    });
  });

  describe('extractVideo()', () => {
    it('returns frame description stub', async () => {
      const file = path.join(tmpDir, 'video.mp4');
      await fs.writeFile(file, Buffer.alloc(100));

      const result = await extractor.extractVideo(file);
      expect(result).toContain('video');
    });
  });

  describe('caching', () => {
    it('returns cached result for same file', async () => {
      mockGenerate.mockResolvedValue({
        success: true,
        code: 'cached summary',
      });
      const file = path.join(tmpDir, 'cached.txt');
      await fs.writeFile(file, 'test content');

      await extractor.extractCode(file);
      await extractor.extractCode(file);
      // LLM should only be called once due to caching
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });
  });
});
