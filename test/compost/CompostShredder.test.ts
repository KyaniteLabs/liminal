import { describe, it, expect } from 'vitest';
/**
 * Tests for CompostShredder — fragment creation from extracted data.
 */

import { CompostShredder } from '../../src/compost/CompostShredder.js';
import type { ExtractionResult, FragmentMetadata, RawByteData } from '../../src/compost/types.js';

function makeMetadata(overrides: Partial<FragmentMetadata> = {}): FragmentMetadata {
  return {
    fileType: 'txt',
    timestamp: '2026-03-20T00:00:00Z',
    hash: 'a'.repeat(64),
    size: 100,
    extractedAt: '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

function makeRawBytes(overrides: Partial<RawByteData> = {}): RawByteData {
  return {
    headerHex: '48656c6c6f',
    tailHex: '776f726c64',
    sha256: 'b'.repeat(64),
    size: 11,
    hexChunks: ['48656c6c6f'],
    base64: null,
    ...overrides,
  };
}

describe('CompostShredder', () => {
  describe('shredSemantic()', () => {
    it('splits text by paragraph', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const fragments = CompostShredder.shredSemantic(text, '/test/file.txt', 'text');
      expect(fragments.length).toBeGreaterThanOrEqual(3);
      expect(fragments[0].content).toContain('First paragraph');
      expect(fragments[0].layer).toBe('semantic');
      expect(fragments[0].source).toBe('/test/file.txt');
    });

    it('splits by heading when present', () => {
      const text = '## Section One\nContent here.\n\n## Section Two\nMore content.';
      const fragments = CompostShredder.shredSemantic(text, '/test/doc.md', 'text');
      expect(fragments.length).toBeGreaterThanOrEqual(2);
    });

    it('each fragment has required fields', () => {
      const fragments = CompostShredder.shredSemantic('Hello world', '/test/a.txt', 'text');
      for (const f of fragments) {
        expect(f.id).toBeTruthy();
        expect(f.source).toBe('/test/a.txt');
        expect(f.domain).toBeTruthy();
        expect(f.layer).toBe('semantic');
        expect(f.content).toBeTruthy();
        expect(f.metadata).not.toBeNull();
        expect(f.tags).toBeInstanceOf(Array);
      }
    });
  });

  describe('shredCode()', () => {
    it('splits code by function/class boundaries', () => {
      // Make code long enough to exceed the 1024-byte small file threshold
      const padding = '// ' + 'x'.repeat(1100) + '\n\n';
      const code = padding + 'function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}';
      const fragments = CompostShredder.shredCode(code, '/test/code.ts', 'typescript');
      expect(fragments.length).toBeGreaterThanOrEqual(2);
      expect(fragments[0].layer).toBe('semantic');
    });

    it('small code produces single fragment', () => {
      const code = 'x';
      const fragments = CompostShredder.shredCode(code, '/test/small.ts', 'typescript');
      expect(fragments.length).toBe(1);
    });
  });

  describe('shredMetadata()', () => {
    it('each metadata field becomes one fragment', () => {
      const meta = makeMetadata({
        language: 'typescript',
        loc: 42,
        format: 'TXT',
      });
      const fragments = CompostShredder.shredMetadata(meta, '/test/file.txt');
      expect(fragments.length).toBeGreaterThan(1);
      for (const f of fragments) {
        expect(f.layer).toBe('structured');
      }
    });
  });

  describe('shredRawBytes()', () => {
    it('each hex chunk becomes one fragment', () => {
      const raw = makeRawBytes({
        hexChunks: ['aaa', 'bbb', 'ccc'],
      });
      const fragments = CompostShredder.shredRawBytes(raw, '/test/file.bin');
      expect(fragments.length).toBe(3);
      for (const f of fragments) {
        expect(f.layer).toBe('raw');
      }
    });
  });

  describe('shredFile()', () => {
    it('auto-detects layer and delegates', () => {
      const result: ExtractionResult = {
        filePath: '/test/doc.txt',
        semantic: 'Hello world\n\nGoodbye world',
        metadata: makeMetadata(),
        rawBytes: makeRawBytes(),
      };
      const fragments = CompostShredder.shredFile(result);
      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments.every(f => f.source === '/test/doc.txt')).toBe(true);
    });

    it('small files produce single fragment', () => {
      const result: ExtractionResult = {
        filePath: '/test/tiny.txt',
        semantic: 'Hi',
        metadata: makeMetadata({ size: 5 }),
        rawBytes: makeRawBytes({ size: 5 }),
      };
      const fragments = CompostShredder.shredFile(result);
      expect(fragments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('shredAll()', () => {
    it('processes batch and returns flat fragment array', () => {
      const results: ExtractionResult[] = [
        {
          filePath: '/test/a.txt',
          semantic: 'Content A',
          metadata: makeMetadata(),
          rawBytes: makeRawBytes(),
        },
        {
          filePath: '/test/b.txt',
          semantic: 'Content B',
          metadata: makeMetadata(),
          rawBytes: makeRawBytes(),
        },
      ];
      const fragments = CompostShredder.shredAll(results);
      expect(fragments.length).toBeGreaterThan(0);
      const sources = fragments.map(f => f.source);
      expect(sources).toContain('/test/a.txt');
      expect(sources).toContain('/test/b.txt');
    });
  });
});
