import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockFsReaddir, mockFsReadFile, mockEnsureDir } = vi.hoisted(() => ({
  mockFsReaddir: vi.fn(),
  mockFsReadFile: vi.fn(),
  mockEnsureDir: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: mockFsReaddir,
    readFile: mockFsReadFile,
  },
}));

vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: mockEnsureDir,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: (_ctx: string, err: unknown) => err instanceof Error ? err.message : String(err),
}));

import { PluginLoader } from '../../../src/plugins/PluginLoader.js';
import type { GeneratorPlugin, PluginManifest, PluginEvent } from '../../../src/plugins/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    entry: 'index.js',
    domains: ['p5'],
    keywords: ['sketch', 'drawing'],
    ...overrides,
  };
}

function makePlugin(overrides?: Partial<GeneratorPlugin>): GeneratorPlugin {
  return {
    manifest: makeManifest(),
    generate: vi.fn().mockResolvedValue('generated code'),
    ...overrides,
  };
}

// ===========================================================================
// PluginLoader
// ===========================================================================

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader('/test/plugins');
  });

  // ─── constructor ────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses provided plugins directory', () => {
      const custom = new PluginLoader('/custom/path');
      expect(custom).toBeDefined();
    });
  });

  // ─── registerPlugin ─────────────────────────────────────────────────

  describe('registerPlugin()', () => {
    it('registers a plugin and makes it retrievable', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getPlugin('test-plugin')).toBe(plugin);
      expect(loader.isLoaded('test-plugin')).toBe(true);
    });

    it('stores the manifest', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getManifest('test-plugin')).toEqual(plugin.manifest);
    });

    it('emits plugin:loaded event', () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      loader.registerPlugin(makePlugin());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:loaded', pluginId: 'test-plugin' }),
      );
    });
  });

  // ─── unloadPlugin ───────────────────────────────────────────────────

  describe('unloadPlugin()', () => {
    it('unloads a registered plugin', async () => {
      const destroy = vi.fn();
      const plugin = makePlugin({ destroy });
      loader.registerPlugin(plugin);

      const result = await loader.unloadPlugin('test-plugin');

      expect(result).toBe(true);
      expect(destroy).toHaveBeenCalledOnce();
      expect(loader.isLoaded('test-plugin')).toBe(false);
    });

    it('returns false for unknown plugin', async () => {
      const result = await loader.unloadPlugin('nonexistent');
      expect(result).toBe(false);
    });

    it('emits plugin:unloaded event', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);
      loader.registerPlugin(makePlugin());

      await loader.unloadPlugin('test-plugin');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:unloaded', pluginId: 'test-plugin' }),
      );
    });
  });

  // ─── getPlugin / getAllPlugins ───────────────────────────────────────

  describe('getters', () => {
    it('getPlugin returns undefined for unknown id', () => {
      expect(loader.getPlugin('nope')).toBeUndefined();
    });

    it('getAllPlugins returns empty array when nothing loaded', () => {
      expect(loader.getAllPlugins()).toEqual([]);
    });

    it('getAllPlugins returns all registered plugins', () => {
      const p1 = makePlugin({ manifest: makeManifest({ id: 'p1' }) });
      const p2 = makePlugin({ manifest: makeManifest({ id: 'p2' }) });
      loader.registerPlugin(p1);
      loader.registerPlugin(p2);

      expect(loader.getAllPlugins()).toHaveLength(2);
    });

    it('getManifest returns undefined for unknown id', () => {
      expect(loader.getManifest('nope')).toBeUndefined();
    });
  });

  // ─── findPluginForPrompt ────────────────────────────────────────────

  describe('findPluginForPrompt()', () => {
    it('uses canHandle when available', () => {
      const plugin = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.9),
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('draw something');
      expect(found).toBe(plugin);
      expect(plugin.canHandle).toHaveBeenCalledWith('draw something');
    });

    it('falls back to keyword matching', () => {
      const plugin = makePlugin({
        manifest: makeManifest({ keywords: ['sketch'], domains: ['p5'] }),
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('create a sketch');
      expect(found).toBe(plugin);
    });

    it('matches domain keywords with higher score', () => {
      const low = makePlugin({
        manifest: makeManifest({ id: 'low', keywords: ['draw'], domains: ['svg'] }),
      });
      const high = makePlugin({
        manifest: makeManifest({ id: 'high', keywords: ['create'], domains: ['p5'] }),
      });
      loader.registerPlugin(low);
      loader.registerPlugin(high);

      const found = loader.findPluginForPrompt('create a p5 sketch');
      expect(found!.manifest.id).toBe('high');
    });

    it('returns undefined when no plugin matches', () => {
      loader.registerPlugin(makePlugin());

      const found = loader.findPluginForPrompt('completely unrelated prompt xyz');
      // Keyword matching gives 0.5 for keyword matches and 0.7 for domain matches
      // If no keywords/domains match, score stays 0
      // The test plugin has keywords ['sketch', 'drawing'] and domains ['p5']
      // 'completely unrelated prompt xyz' matches none of those
      expect(found).toBeUndefined();
    });

    it('picks highest scoring plugin among multiple', () => {
      const weak = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.3),
        manifest: makeManifest({ id: 'weak' }),
      });
      const strong = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.95),
        manifest: makeManifest({ id: 'strong' }),
      });
      loader.registerPlugin(weak);
      loader.registerPlugin(strong);

      const found = loader.findPluginForPrompt('test');
      expect(found!.manifest.id).toBe('strong');
    });
  });

  // ─── event system ───────────────────────────────────────────────────

  describe('event system', () => {
    it('supports multiple event handlers', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      loader.onEvent(h1);
      loader.onEvent(h2);

      loader.registerPlugin(makePlugin());

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('offEvent removes a specific handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      loader.onEvent(h1);
      loader.onEvent(h2);
      loader.offEvent(h1);

      loader.registerPlugin(makePlugin());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('handler errors do not break other handlers', () => {
      const bad = vi.fn().mockImplementation(() => { throw new Error('oops'); });
      const good = vi.fn();
      loader.onEvent(bad);
      loader.onEvent(good);

      loader.registerPlugin(makePlugin());

      expect(good).toHaveBeenCalledOnce();
    });
  });

  // ─── loadAll ────────────────────────────────────────────────────────

  describe('loadAll()', () => {
    it('returns empty array when directory does not exist', async () => {
      const enoent = new Error('Not found') as NodeJS.ErrnoException;
      enoent.code = 'ENOENT';
      mockFsReaddir.mockRejectedValue(enoent);

      const results = await loader.loadAll();
      expect(results).toEqual([]);
    });

    it('skips non-directory entries', async () => {
      mockFsReaddir.mockResolvedValue([
        { name: 'readme.md', isDirectory: () => true },
        { name: 'config.json', isDirectory: () => false },
      ]);

      // The "readme.md" dir will fail because it has no valid manifest
      mockFsReadFile.mockRejectedValue(new Error('Not found'));

      const results = await loader.loadAll();
      expect(results).toHaveLength(1); // Only the directory entry
      expect(results[0].success).toBe(false);
    });
  });

  // ─── loadPlugin ─────────────────────────────────────────────────────

  describe('loadPlugin()', () => {
    it('returns error for invalid manifest (missing id)', async () => {
      mockFsReadFile.mockResolvedValue(JSON.stringify({ entry: 'index.js' }));

      const result = await loader.loadPlugin('/plugins/bad-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.pluginId).toBe('bad-plugin');
    });

    it('returns error for missing dependency', async () => {
      mockFsReadFile.mockResolvedValue(JSON.stringify({
        id: 'dep-plugin',
        entry: 'index.js',
        name: 'Dep Plugin',
        version: '1.0.0',
        description: 'Needs deps',
        domains: [],
        keywords: [],
        dependencies: ['missing-dep'],
      }));

      const result = await loader.loadPlugin('/plugins/dep-plugin');

      expect(result.success).toBe(false);
      expect(result.error!.error).toContain('Missing dependency');
    });
  });
});
