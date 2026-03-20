/**
 * Path sanitization tests - path traversal prevention
 * Malicious project name or output path with ".." is rejected or resolved inside base.
 */

import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import { normalizePath, assertSafeSegment } from '../../src/utils/normalizePath.js';
import { run, runFromArgs } from '../../src/index.js';
import { Gallery } from '../../src/gallery/Gallery.js';
import { SeedArchive } from '../../src/gallery/SeedArchive.js';

describe('normalizePath', () => {
  const base = path.join(os.tmpdir(), 'atelier-path-test-' + Date.now());

  beforeAll(async () => {
    await fs.mkdir(base, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(base, { recursive: true, force: true }).catch(() => {});
  });

  it('returns path under base when subPath is safe', () => {
    const result = normalizePath(base, 'foo/bar');
    const baseCanonical = fsSync.realpathSync(path.resolve(base));
    const resultNorm = path.resolve(result);
    const rel = path.relative(baseCanonical, resultNorm);
    expect(rel).not.toMatch(/^\.\./);
    expect(resultNorm.startsWith(baseCanonical)).toBe(true);
  });

  it('throws when subPath escapes base with ..', () => {
    expect(() => normalizePath(base, '../etc')).toThrow('Path traversal or escape not allowed');
    expect(() => normalizePath(base, 'a/../../etc')).toThrow('Path traversal or escape not allowed');
  });

  it('throws when subPath is absolute', () => {
    expect(() => normalizePath(base, '/etc/passwd')).toThrow('Path traversal or escape not allowed');
  });
});

describe('assertSafeSegment', () => {
  it('allows safe names', () => {
    expect(() => assertSafeSegment('my-project')).not.toThrow();
    expect(() => assertSafeSegment('2026-03-07--foo')).not.toThrow();
  });

  it('throws on ".."', () => {
    expect(() => assertSafeSegment('..')).toThrow('must not contain ".."');
    expect(() => assertSafeSegment('a/../b')).toThrow('must not contain ".."');
  });

  it('throws on path separators', () => {
    expect(() => assertSafeSegment('a/b')).toThrow('must not contain path separators');
  });
});

describe('run() path sanitization', () => {
  const testDir = path.join(os.tmpdir(), 'atelier-run-path-' + Date.now());

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('rejects or contains project name with ".." so output stays inside base', async () => {
    const output = path.join(testDir, 'out');
    await fs.mkdir(output, { recursive: true }).catch(() => {});
    await expect(
      run('test', { output, project: '../../etc', maxIterations: 1 })
    ).rejects.toThrow();
  });

  it('rejects output path that would escape cwd', async () => {
    const cwd = process.cwd();
    await expect(
      run('test', { output: path.join(cwd, 'out', '..', '..', 'etc'), maxIterations: 1 })
    ).rejects.toThrow();
  });
});

describe('runFromArgs() path sanitization', () => {
  it('rejects malicious project in runFromArgs', async () => {
    const testOut = path.join(os.tmpdir(), 'atelier-args-' + Date.now());
    await fs.mkdir(testOut, { recursive: true }).catch(() => {});
    await expect(
      runFromArgs({ prompt: 'x', output: testOut, project: '../../evil' })
    ).rejects.toThrow();
  });
});

describe('Gallery path sanitization', () => {
  const galleryBase = path.join(os.tmpdir(), 'atelier-gallery-path-' + Date.now());

  beforeAll(async () => {
    await fs.mkdir(galleryBase, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(galleryBase, { recursive: true, force: true }).catch(() => {});
  });

  it('rejects project name with ".." in saveIteration', async () => {
    const gallery = new Gallery(galleryBase);
    await expect(gallery.saveIteration('../../etc', 1, 'code')).rejects.toThrow();
  });

  it('rejects project name with ".." in loadHistory', async () => {
    const gallery = new Gallery(galleryBase);
    await expect(gallery.loadHistory('../../etc')).rejects.toThrow();
  });

  it('loadHistoryFromDir returns empty or rejects for traversal', async () => {
    const gallery = new Gallery(galleryBase);
    const iterations = await gallery.loadHistoryFromDir('../../../etc');
    expect(iterations).toEqual([]);
  });
});

describe('SeedArchive path sanitization', () => {
  const archiveDir = path.join(os.tmpdir(), 'atelier-seed-path-' + Date.now());

  beforeAll(async () => {
    await fs.mkdir(archiveDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(archiveDir, { recursive: true, force: true }).catch(() => {});
  });

  it('rejects seed containing ".." in saveSeed', async () => {
    const archive = new SeedArchive(archiveDir);
    await expect(archive.saveSeed('../../etc', {})).rejects.toThrow();
  });

  it('rejects seed containing ".." in loadSeed', async () => {
    const archive = new SeedArchive(archiveDir);
    await expect(archive.loadSeed('../../etc')).rejects.toThrow();
  });

  it('rejects seed containing path separator in saveSeed', async () => {
    const archive = new SeedArchive(archiveDir);
    await expect(archive.saveSeed('a/b', {})).rejects.toThrow();
  });
});
