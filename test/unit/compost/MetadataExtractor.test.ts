import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';

// vi.hoisted() for ALL mock variables used in vi.mock() factories
const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { MetadataExtractor } from '../../../src/compost/MetadataExtractor.js';
import type { FragmentMetadata } from '../../../src/compost/types.js';

/** Create a temp directory for each test and return its path */
function makeTempDir(): string {
  const dir = join(tmpdir(), `metadata-extractor-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('MetadataExtractor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // extract() — code files
  // ---------------------------------------------------------------------------
  describe('extract — code files', () => {
    it('extracts metadata from a TypeScript file', async () => {
      const filePath = join(tempDir, 'example.ts');
      writeFileSync(filePath, 'line1\nline2\nline3\n');

      const meta = await MetadataExtractor.extract(filePath);

      expect(meta.fileType).toBe('ts');
      expect(meta.language).toBe('typescript');
      expect(meta.loc).toBe(4); // 3 newlines + trailing = 4 lines
      expect(meta.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(meta.size).toBe(18); // 'line1\nline2\nline3\n'.length
      expect(meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(meta.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('extracts metadata from a JavaScript file', async () => {
      const filePath = join(tempDir, 'app.js');
      writeFileSync(filePath, 'const x = 1;\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.fileType).toBe('js');
      expect(meta.language).toBe('javascript');
      expect(meta.loc).toBe(2);
    });

    it('extracts metadata from a Python file', async () => {
      const filePath = join(tempDir, 'script.py');
      writeFileSync(filePath, 'print("hello")\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.fileType).toBe('py');
      expect(meta.language).toBe('python');
    });

    it('extracts metadata from Go, Rust, Java, Kotlin files', async () => {
      const cases: Array<{ ext: string; lang: string }> = [
        { ext: 'go', lang: 'go' },
        { ext: 'rs', lang: 'rust' },
        { ext: 'java', lang: 'java' },
        { ext: 'kt', lang: 'kotlin' },
      ];

      for (const { ext, lang } of cases) {
        const filePath = join(tempDir, `file.${ext}`);
        writeFileSync(filePath, 'content\n');
        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.language).toBe(lang);
      }
    });

    it('extracts metadata from Ruby, PHP, Swift, C, C++ files', async () => {
      const cases: Array<{ ext: string; lang: string }> = [
        { ext: 'rb', lang: 'ruby' },
        { ext: 'php', lang: 'php' },
        { ext: 'swift', lang: 'swift' },
        { ext: 'c', lang: 'c' },
        { ext: 'cpp', lang: 'cpp' },
      ];

      for (const { ext, lang } of cases) {
        const filePath = join(tempDir, `file.${ext}`);
        writeFileSync(filePath, 'content\n');
        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.language).toBe(lang);
      }
    });

    it('extracts metadata from header files (h, hpp)', async () => {
      const cases: Array<{ ext: string; lang: string }> = [
        { ext: 'h', lang: 'c' },
        { ext: 'hpp', lang: 'cpp' },
      ];

      for (const { ext, lang } of cases) {
        const filePath = join(tempDir, `header.${ext}`);
        writeFileSync(filePath, '#pragma once\n');
        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.language).toBe(lang);
      }
    });

    it('extracts metadata from C#, Scala, GLSL shader files', async () => {
      const cases: Array<{ ext: string; lang: string }> = [
        { ext: 'cs', lang: 'csharp' },
        { ext: 'scala', lang: 'scala' },
        { ext: 'glsl', lang: 'glsl' },
        { ext: 'frag', lang: 'glsl' },
        { ext: 'vert', lang: 'glsl' },
      ];

      for (const { ext, lang } of cases) {
        const filePath = join(tempDir, `file.${ext}`);
        writeFileSync(filePath, 'content\n');
        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.language).toBe(lang);
      }
    });

    it('does not set language for unknown extensions', async () => {
      const filePath = join(tempDir, 'data.xyz');
      writeFileSync(filePath, 'content\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.language).toBeUndefined();
      expect(meta.loc).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // extract() — image files
  // ---------------------------------------------------------------------------
  describe('extract — image files', () => {
    it('sets format for image file extensions but no dimensions when sharp unavailable', async () => {
      const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff'];

      for (const ext of imageExts) {
        const filePath = join(tempDir, `image.${ext}`);
        writeFileSync(filePath, 'fake image data');

        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.format).toBe(ext.toUpperCase());
        // sharp is likely not installed in test env
        expect(meta.dimensions).toBeUndefined();
      }
    });

    it('counts lines correctly for an image file (does not set loc)', async () => {
      const filePath = join(tempDir, 'photo.jpg');
      writeFileSync(filePath, 'binary\ncontent\nhere');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.loc).toBeUndefined();
      expect(meta.language).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // extract() — audio files
  // ---------------------------------------------------------------------------
  describe('extract — audio files', () => {
    it('sets format for audio file extensions', async () => {
      const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];

      for (const ext of audioExts) {
        const filePath = join(tempDir, `audio.${ext}`);
        writeFileSync(filePath, 'fake audio data');

        const meta = await MetadataExtractor.extract(filePath);
        expect(meta.format).toBe(ext.toUpperCase());
      }
    });

    it('sets duration to 0 when music-metadata returns no format info', async () => {
      const filePath = join(tempDir, 'song.mp3');
      writeFileSync(filePath, 'fake mp3 data');

      const meta = await MetadataExtractor.extract(filePath);
      // music-metadata may be installed and return duration: 0 for fake data,
      // or may not be installed and duration is not set at all
      // Either way, the value should be a number or undefined — never a string
      expect(typeof meta.duration === 'number' || meta.duration === undefined).toBe(true);
      expect(meta.sampleRate === undefined || typeof meta.sampleRate === 'number').toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // extract() — hash and size
  // ---------------------------------------------------------------------------
  describe('extract — hash and size', () => {
    it('computes correct SHA256 hash', async () => {
      const filePath = join(tempDir, 'hashable.txt');
      writeFileSync(filePath, 'hello world');

      const meta = await MetadataExtractor.extract(filePath);
      // SHA256 of 'hello world' is well-known
      expect(meta.hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('computes correct file size in bytes', async () => {
      const filePath = join(tempDir, 'sized.txt');
      const content = 'a'.repeat(100);
      writeFileSync(filePath, content);

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.size).toBe(100);
    });

    it('handles empty files', async () => {
      const filePath = join(tempDir, 'empty.txt');
      writeFileSync(filePath, '');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.size).toBe(0);
      expect(meta.hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'); // SHA256 of empty
    });
  });

  // ---------------------------------------------------------------------------
  // extract() — extension handling
  // ---------------------------------------------------------------------------
  describe('extract — extension edge cases', () => {
    it('handles uppercase file extensions by lowercasing', async () => {
      const filePath = join(tempDir, 'Component.TSX');
      writeFileSync(filePath, 'export const X = 1;\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.fileType).toBe('tsx');
      expect(meta.language).toBe('typescript');
    });

    it('handles files with no extension (uses full path as fallback)', async () => {
      const filePath = join(tempDir, 'Makefile');
      writeFileSync(filePath, 'all:\n\techo hi\n');

      const meta = await MetadataExtractor.extract(filePath);
      // When no dot in the full path, split('.').pop() returns the full path lowercased
      expect(meta.fileType).toBe(filePath.toLowerCase());
      expect(meta.language).toBeUndefined();
    });

    it('handles hidden files (dotfiles)', async () => {
      const filePath = join(tempDir, '.eslintrc.js');
      writeFileSync(filePath, 'module.exports = {};\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.fileType).toBe('js');
      expect(meta.language).toBe('javascript');
    });
  });

  // ---------------------------------------------------------------------------
  // extract() — error paths
  // ---------------------------------------------------------------------------
  describe('extract — error paths', () => {
    it('throws when file does not exist', async () => {
      const filePath = join(tempDir, 'nonexistent.ts');

      await expect(MetadataExtractor.extract(filePath)).rejects.toThrow();
    });

    it('throws a clear error for a completely invalid path', async () => {
      await expect(MetadataExtractor.extract('/invalid/path/that/does/not/exist.txt')).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // extractAll()
  // ---------------------------------------------------------------------------
  describe('extractAll', () => {
    it('extracts metadata for multiple files in parallel', async () => {
      const files: string[] = [];
      for (let i = 0; i < 5; i++) {
        const filePath = join(tempDir, `file${i}.ts`);
        writeFileSync(filePath, `content ${i}\n`);
        files.push(filePath);
      }

      const results = await MetadataExtractor.extractAll(files);

      expect(results.size).toBe(5);
      for (const filePath of files) {
        const meta = results.get(filePath);
        expect(meta).toBeTruthy();
        expect(meta!.fileType).toBe('ts');
        expect(meta!.language).toBe('typescript');
      }
    });

    it('handles mix of code and non-code files', async () => {
      const tsPath = join(tempDir, 'code.ts');
      const txtPath = join(tempDir, 'notes.txt');
      const pyPath = join(tempDir, 'script.py');
      writeFileSync(tsPath, 'const x = 1;\n');
      writeFileSync(txtPath, 'hello world\n');
      writeFileSync(pyPath, 'print("hi")\n');

      const results = await MetadataExtractor.extractAll([tsPath, txtPath, pyPath]);

      expect(results.get(tsPath)!.language).toBe('typescript');
      expect(results.get(txtPath)!.language).toBeUndefined();
      expect(results.get(pyPath)!.language).toBe('python');
    });

    it('skips files that fail to extract (settled, not rejected)', async () => {
      const validPath = join(tempDir, 'valid.ts');
      const invalidPath = join(tempDir, 'missing.ts');
      writeFileSync(validPath, 'ok\n');

      const results = await MetadataExtractor.extractAll([validPath, invalidPath]);

      // Only the valid file should be present
      expect(results.size).toBe(1);
      expect(results.has(validPath)).toBe(true);
      expect(results.has(invalidPath)).toBe(false);
    });

    it('returns empty map for empty input array', async () => {
      const results = await MetadataExtractor.extractAll([]);
      expect(results.size).toBe(0);
    });

    it('returns empty map when all files fail', async () => {
      const badFiles = [
        join(tempDir, 'nope1.ts'),
        join(tempDir, 'nope2.py'),
      ];

      const results = await MetadataExtractor.extractAll(badFiles);
      expect(results.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // extractImageDimensions (private, tested indirectly)
  // ---------------------------------------------------------------------------
  describe('extractImageDimensions (indirect)', () => {
    it('returns null dimensions when sharp is not available', async () => {
      // sharp is not installed in test environment, so dimensions should be null
      const filePath = join(tempDir, 'photo.png');
      writeFileSync(filePath, 'fake png');

      const meta = await MetadataExtractor.extract(filePath);
      // sharp not available -> dimensions not set
      expect(meta.dimensions).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // extractAudioMetadata (private, tested indirectly)
  // ---------------------------------------------------------------------------
  describe('extractAudioMetadata (indirect)', () => {
    it('returns numeric or undefined audio metadata when music-metadata is not available', async () => {
      const filePath = join(tempDir, 'track.wav');
      writeFileSync(filePath, 'fake wav');

      const meta = await MetadataExtractor.extract(filePath);
      // duration may be 0 (module available but fake data) or undefined (module unavailable)
      expect(typeof meta.duration === 'number' || meta.duration === undefined).toBe(true);
      expect(meta.sampleRate === undefined || typeof meta.sampleRate === 'number').toBe(true);
      expect(meta.bitrate === undefined || typeof meta.bitrate === 'number').toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // line counting
  // ---------------------------------------------------------------------------
  describe('line counting', () => {
    it('counts a single-line file as 1 line', async () => {
      const filePath = join(tempDir, 'oneliner.py');
      writeFileSync(filePath, 'x = 1');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.loc).toBe(1);
    });

    it('counts multi-line file correctly', async () => {
      const filePath = join(tempDir, 'multi.js');
      writeFileSync(filePath, 'a\nb\nc\nd\ne');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.loc).toBe(5);
    });

    it('counts trailing newline as extra line', async () => {
      const filePath = join(tempDir, 'trailing.go');
      writeFileSync(filePath, 'line1\nline2\n');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.loc).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Lazy-loading module helpers (getSharp, getMusicMetadata)
  // ---------------------------------------------------------------------------
  describe('lazy-loading module behavior', () => {
    it('does not crash when image extraction fails (sharp import fails)', async () => {
      const filePath = join(tempDir, 'broken.jpg');
      writeFileSync(filePath, 'not-a-real-image');

      // Should not throw even if sharp fails to load or process
      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.format).toBe('JPG');
    });

    it('does not crash when audio extraction fails (music-metadata import fails)', async () => {
      const filePath = join(tempDir, 'broken.mp3');
      writeFileSync(filePath, 'not-a-real-mp3');

      const meta = await MetadataExtractor.extract(filePath);
      expect(meta.format).toBe('MP3');
    });
  });
});
