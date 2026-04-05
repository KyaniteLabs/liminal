/**
 * Tests for the AssetStore — content-addressable binary storage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { EventStore } from '../../../src/compost/EventStore.js';
import { AssetStore } from '../../../src/compost/AssetStore.js';

describe('AssetStore', () => {
  let tempDir: string;
  let eventStore: EventStore;
  let assetStore: AssetStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-asset-test-'));
    eventStore = new EventStore({ projectRoot: tempDir });
    eventStore.init();
    assetStore = new AssetStore(eventStore);
  });

  afterEach(() => {
    eventStore.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Store File ────────────────────────────────────────────────────────

  describe('storeFile()', () => {
    it('stores a file and returns its SHA256 hash', () => {
      const filePath = join(tempDir, 'test.js');
      writeFileSync(filePath, 'console.log("hello");');

      const result = assetStore.storeFile(filePath);

      expect(result.hash).toHaveLength(64); // SHA256 hex
      expect(result.filename).toBe('test.js');
      expect(result.type).toBe('text/javascript');
      expect(result.size).toBeGreaterThan(0);
      expect(result.isNew).toBe(true);
    });

    it('deduplicates identical files', () => {
      const content = 'same content everywhere';
      const file1 = join(tempDir, 'file1.txt');
      const file2 = join(tempDir, 'file2.txt');
      writeFileSync(file1, content);
      writeFileSync(file2, content);

      const r1 = assetStore.storeFile(file1);
      const r2 = assetStore.storeFile(file2);

      expect(r1.hash).toBe(r2.hash);
      expect(r1.isNew).toBe(true);
      expect(r2.isNew).toBe(false);
    });

    it('stores different files with different hashes', () => {
      const file1 = join(tempDir, 'a.txt');
      const file2 = join(tempDir, 'b.txt');
      writeFileSync(file1, 'content A');
      writeFileSync(file2, 'content B');

      const r1 = assetStore.storeFile(file1);
      const r2 = assetStore.storeFile(file2);

      expect(r1.hash).not.toBe(r2.hash);
    });

    it('creates the objects directory structure', () => {
      const filePath = join(tempDir, 'test.js');
      writeFileSync(filePath, 'test');

      assetStore.storeFile(filePath);

      const hash = createHash('sha256').update('test').digest('hex');
      const prefix = hash.slice(0, 2);
      const objectPath = join(eventStore.getObjectsDir(), prefix, hash.slice(2));
      expect(existsSync(objectPath)).toBe(true);
    });
  });

  describe('storeContent()', () => {
    it('stores a string as UTF-8 content', () => {
      const result = assetStore.storeContent('hello world', 'greeting.txt', 'text/plain');

      expect(result.hash).toHaveLength(64);
      expect(result.filename).toBe('greeting.txt');
      expect(result.size).toBe(11);
    });

    it('stores a Buffer directly', () => {
      const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header bytes
      const result = assetStore.storeContent(buf, 'image.png', 'image/png');

      expect(result.type).toBe('image/png');
      expect(result.size).toBe(4);
    });
  });

  // ─── Retrieve ──────────────────────────────────────────────────────────

  describe('getContent()', () => {
    it('retrieves stored content as a Buffer', () => {
      const content = 'stored content';
      const result = assetStore.storeContent(content, 'test.txt', 'text/plain');

      const retrieved = assetStore.getContent(result.hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString('utf-8')).toBe(content);
    });

    it('returns null for non-existent hash', () => {
      expect(assetStore.getContent('0'.repeat(64))).toBeNull();
    });
  });

  describe('getContentAsString()', () => {
    it('retrieves content as a UTF-8 string', () => {
      assetStore.storeContent('hello string', 'test.txt', 'text/plain');
      const hash = createHash('sha256').update('hello string').digest('hex');

      expect(assetStore.getContentAsString(hash)).toBe('hello string');
    });
  });

  // ─── Export ────────────────────────────────────────────────────────────

  describe('exportTo()', () => {
    it('copies an asset to an external path', () => {
      const result = assetStore.storeContent('export me', 'test.txt', 'text/plain');
      const exportPath = join(tempDir, 'exported.txt');

      const success = assetStore.exportTo(result.hash, exportPath);
      expect(success).toBe(true);
      expect(readFileSync(exportPath, 'utf-8')).toBe('export me');
    });

    it('returns false for non-existent hash', () => {
      expect(assetStore.exportTo('0'.repeat(64), join(tempDir, 'out.txt'))).toBe(false);
    });
  });

  // ─── Existence Checks ──────────────────────────────────────────────────

  describe('has()', () => {
    it('returns true for stored assets', () => {
      const result = assetStore.storeContent('exists', 'test.txt', 'text/plain');
      expect(assetStore.has(result.hash)).toBe(true);
    });

    it('returns false for non-existent assets', () => {
      expect(assetStore.has('0'.repeat(64))).toBe(false);
    });
  });

  // ─── Stats ─────────────────────────────────────────────────────────────

  describe('count() and getTotalSize()', () => {
    it('counts stored objects', () => {
      assetStore.storeContent('content 1', 'a.txt', 'text/plain');
      assetStore.storeContent('content 2', 'b.txt', 'text/plain');

      expect(assetStore.count()).toBe(2);
    });

    it('deduplicates in count', () => {
      assetStore.storeContent('same', 'a.txt', 'text/plain');
      assetStore.storeContent('same', 'b.txt', 'text/plain');

      expect(assetStore.count()).toBe(1);
    });

    it('tracks total storage size', () => {
      assetStore.storeContent('12345', 'a.txt', 'text/plain');

      expect(assetStore.getTotalSize()).toBe(5);
    });
  });
});
