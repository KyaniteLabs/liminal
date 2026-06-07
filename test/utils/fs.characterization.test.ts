import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Characterization tests for FS patterns used across the codebase.
 * These tests document the current behavior before refactoring.
 */
describe('FS pattern characterization', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `sinter-fs-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('mkdirSync with recursive: true', () => {
    it('creates a single directory', () => {
      const dir = path.join(tmpDir, 'single');
      fs.mkdirSync(dir, { recursive: true });
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    });

    it('creates nested directories', () => {
      const dir = path.join(tmpDir, 'a', 'b', 'c');
      fs.mkdirSync(dir, { recursive: true });
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    });

    it('does not throw if directory already exists', () => {
      const dir = path.join(tmpDir, 'exists');
      fs.mkdirSync(dir, { recursive: true });
      expect(() => fs.mkdirSync(dir, { recursive: true })).not.toThrow();
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('does not throw if parent directory already exists', () => {
      const parent = path.join(tmpDir, 'parent');
      fs.mkdirSync(parent, { recursive: true });
      const child = path.join(parent, 'child');
      expect(() => fs.mkdirSync(child, { recursive: true })).not.toThrow();
      expect(fs.existsSync(child)).toBe(true);
    });
  });

  describe('Pattern: if (!existsSync(dir)) mkdirSync(dir)', () => {
    it('creates directory when it does not exist', () => {
      const dir = path.join(tmpDir, 'conditional');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('skips creation when directory exists', () => {
      const dir = path.join(tmpDir, 'skip-create');
      fs.mkdirSync(dir, { recursive: true });
      
      // Should not throw
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe('Pattern: mkdirSync(path.dirname(filePath)) + writeFileSync', () => {
    it('creates parent directory and writes file', () => {
      const filePath = path.join(tmpDir, 'nested', 'dir', 'file.txt');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'content', 'utf-8');
      
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('content');
    });

    it('overwrites existing file', () => {
      const filePath = path.join(tmpDir, 'nested', 'dir', 'file.txt');
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, 'original', 'utf-8');
      fs.writeFileSync(filePath, 'updated', 'utf-8');
      
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('updated');
    });
  });

  describe('Pattern: mkdirSync with relative paths', () => {
    it('creates directories relative to cwd', () => {
      const originalCwd = process.cwd();
      const testDir = path.join(os.tmpdir(), `sinter-cwd-test-${Date.now()}`);
      const relativeDir = 'test-temp-relative-dir';
      
      try {
        fs.mkdirSync(testDir, { recursive: true });
        process.chdir(testDir);
        fs.mkdirSync(relativeDir, { recursive: true });
        expect(fs.existsSync(relativeDir)).toBe(true);
      } finally {
        process.chdir(originalCwd);
        if (fs.existsSync(testDir)) {
          fs.rmSync(testDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Pattern: existsSync checks for files', () => {
    it('returns true for existing file', () => {
      const filePath = path.join(tmpDir, 'file.txt');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(filePath, 'content', 'utf-8');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('returns false for non-existing file', () => {
      const filePath = path.join(tmpDir, 'nonexistent.txt');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('returns true for existing directory', () => {
      const dir = path.join(tmpDir, 'subdir');
      fs.mkdirSync(dir, { recursive: true });
      expect(fs.existsSync(dir)).toBe(true);
    });
  });
});
