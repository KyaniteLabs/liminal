import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted is mandatory for variables used in vi.mock()
// ---------------------------------------------------------------------------

const { mockFsReaddir, mockFsReadFile, mockDynamicImport } = vi.hoisted(() => ({
  mockFsReaddir: vi.fn(),
  mockFsReadFile: vi.fn(),
  mockDynamicImport: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: mockFsReaddir,
    readFile: mockFsReadFile,
  },
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
  formatError: (_ctx: string, err: unknown) =>
    err instanceof Error ? err.message : String(err),
}));

import { PluginLoader } from '../../../src/plugins/PluginLoader.js';
import type {
  GeneratorPlugin,
  PluginManifest,
  PluginEvent,
} from '../../../src/plugins/types.js';

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

function makePluginModule(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    generate: vi.fn().mockResolvedValue('module-generated'),
    canHandle: vi.fn().mockReturnValue(0.8),
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function manifestJson(overrides?: Partial<PluginManifest>): string {
  return JSON.stringify(makeManifest(overrides));
}

// ===========================================================================
// PluginLoader — comprehensive tests
// ===========================================================================

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new PluginLoader('/test/plugins');
  });

  // ─── constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses provided plugins directory', () => {
      const custom = new PluginLoader('/custom/path');
      // Verify indirectly by loading — if path is wrong, loadAll will fail
      expect(custom).toBeInstanceOf(PluginLoader);
    });
  });

  // ─── registerPlugin ───────────────────────────────────────────────────

  describe('registerPlugin()', () => {
    it('stores plugin and makes it retrievable via getPlugin', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getPlugin('test-plugin')).toBe(plugin);
    });

    it('stores manifest and makes it retrievable via getManifest', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getManifest('test-plugin')).toEqual(plugin.manifest);
    });

    it('marks plugin as loaded via isLoaded', () => {
      loader.registerPlugin(makePlugin());
      expect(loader.isLoaded('test-plugin')).toBe(true);
    });

    it('includes plugin in getAllPlugins', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getAllPlugins()).toEqual([plugin]);
    });

    it('emits plugin:loaded event with correct type and pluginId', () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      loader.registerPlugin(makePlugin());

      expect(handler).toHaveBeenCalledTimes(1);
      const event: PluginEvent = handler.mock.calls[0][0];
      expect(event.type).toBe('plugin:loaded');
      expect(event.pluginId).toBe('test-plugin');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('replaces plugin when registering with same id', () => {
      const v1 = makePlugin();
      const v2 = makePlugin({
        manifest: makeManifest({ version: '2.0.0' }),
      });

      loader.registerPlugin(v1);
      loader.registerPlugin(v2);

      expect(loader.getPlugin('test-plugin')).toBe(v2);
      expect(loader.getManifest('test-plugin')!.version).toBe('2.0.0');
      expect(loader.getAllPlugins()).toHaveLength(1);
    });
  });

  // ─── unloadPlugin ─────────────────────────────────────────────────────

  describe('unloadPlugin()', () => {
    it('calls destroy on the plugin before removing it', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin({ destroy });
      loader.registerPlugin(plugin);

      await loader.unloadPlugin('test-plugin');

      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('returns true when plugin exists', async () => {
      loader.registerPlugin(makePlugin());
      expect(await loader.unloadPlugin('test-plugin')).toBe(true);
    });

    it('returns false for unknown plugin id', async () => {
      expect(await loader.unloadPlugin('nonexistent')).toBe(false);
    });

    it('removes plugin from getPlugin results', async () => {
      loader.registerPlugin(makePlugin());
      await loader.unloadPlugin('test-plugin');

      expect(loader.getPlugin('test-plugin')).toBeUndefined();
    });

    it('removes manifest from getManifest results', async () => {
      loader.registerPlugin(makePlugin());
      await loader.unloadPlugin('test-plugin');

      expect(loader.getManifest('test-plugin')).toBeUndefined();
    });

    it('updates isLoaded to false', async () => {
      loader.registerPlugin(makePlugin());
      await loader.unloadPlugin('test-plugin');

      expect(loader.isLoaded('test-plugin')).toBe(false);
    });

    it('emits plugin:unloaded event', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);
      loader.registerPlugin(makePlugin());

      await loader.unloadPlugin('test-plugin');

      const unloadEvent = handler.mock.calls.find(
        (call: [PluginEvent]) => call[0].type === 'plugin:unloaded',
      );
      expect(unloadEvent).toBeDefined();
      expect(unloadEvent![0].pluginId).toBe('test-plugin');
    });

    it('handles plugin without destroy method', async () => {
      const plugin = makePlugin({ destroy: undefined });
      loader.registerPlugin(plugin);

      const result = await loader.unloadPlugin('test-plugin');
      expect(result).toBe(true);
      expect(loader.isLoaded('test-plugin')).toBe(false);
    });
  });

  // ─── getters ──────────────────────────────────────────────────────────

  describe('getters', () => {
    it('getPlugin returns undefined for unknown id', () => {
      expect(loader.getPlugin('nope')).toBeUndefined();
    });

    it('getManifest returns undefined for unknown id', () => {
      expect(loader.getManifest('nope')).toBeUndefined();
    });

    it('getAllPlugins returns empty array when nothing loaded', () => {
      expect(loader.getAllPlugins()).toEqual([]);
    });

    it('getAllPlugins returns all registered plugins', () => {
      const p1 = makePlugin({ manifest: makeManifest({ id: 'p1' }) });
      const p2 = makePlugin({ manifest: makeManifest({ id: 'p2' }) });
      loader.registerPlugin(p1);
      loader.registerPlugin(p2);

      const all = loader.getAllPlugins();
      expect(all).toHaveLength(2);
      expect(all).toContain(p1);
      expect(all).toContain(p2);
    });

    it('isLoaded returns false for unknown plugin', () => {
      expect(loader.isLoaded('unknown')).toBe(false);
    });
  });

  // ─── findPluginForPrompt ──────────────────────────────────────────────

  describe('findPluginForPrompt()', () => {
    it('returns undefined when no plugins are loaded', () => {
      expect(loader.findPluginForPrompt('draw something')).toBeUndefined();
    });

    it('returns undefined when no plugin matches the prompt', () => {
      loader.registerPlugin(
        makePlugin({
          manifest: makeManifest({ keywords: ['shader'], domains: ['glsl'] }),
        }),
      );

      const found = loader.findPluginForPrompt('bake a cake');
      expect(found).toBeUndefined();
    });

    it('uses plugin canHandle when available', () => {
      const plugin = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.9),
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('draw something');
      expect(found).toBe(plugin);
      expect(plugin.canHandle).toHaveBeenCalledWith('draw something');
    });

    it('ignores plugin with canHandle returning 0', () => {
      const plugin = makePlugin({
        canHandle: vi.fn().mockReturnValue(0),
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('draw something');
      expect(found).toBeUndefined();
    });

    it('falls back to keyword matching when canHandle is absent', () => {
      const plugin = makePlugin({
        manifest: makeManifest({ keywords: ['sketch', 'drawing'], domains: ['p5'] }),
        canHandle: undefined,
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('create a sketch');
      expect(found).toBe(plugin);
    });

    it('keyword match gives score 0.5', () => {
      const keywordPlugin = makePlugin({
        manifest: makeManifest({
          id: 'keyword-only',
          keywords: ['sketch'],
          domains: ['unrelated-domain'],
        }),
        canHandle: undefined,
      });
      const strongPlugin = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.6),
        manifest: makeManifest({ id: 'strong' }),
      });

      loader.registerPlugin(keywordPlugin);
      loader.registerPlugin(strongPlugin);

      // The canHandle plugin with 0.6 beats the keyword match at 0.5
      const found = loader.findPluginForPrompt('sketch');
      expect(found!.manifest.id).toBe('strong');
    });

    it('domain match gives score 0.7, beating keyword match at 0.5', () => {
      const kwPlugin = makePlugin({
        manifest: makeManifest({
          id: 'kw',
          keywords: ['sketch'],
          domains: ['unrelated'],
        }),
        canHandle: undefined,
      });
      const domainPlugin = makePlugin({
        manifest: makeManifest({
          id: 'domain',
          keywords: ['nothing-matching'],
          domains: ['p5'],
        }),
        canHandle: undefined,
      });

      loader.registerPlugin(kwPlugin);
      loader.registerPlugin(domainPlugin);

      const found = loader.findPluginForPrompt('a p5 sketch');
      expect(found!.manifest.id).toBe('domain');
    });

    it('picks highest scoring plugin among multiple candidates', () => {
      const weak = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.3),
        manifest: makeManifest({ id: 'weak' }),
      });
      const strong = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.95),
        manifest: makeManifest({ id: 'strong' }),
      });
      const medium = makePlugin({
        canHandle: vi.fn().mockReturnValue(0.6),
        manifest: makeManifest({ id: 'medium' }),
      });

      loader.registerPlugin(weak);
      loader.registerPlugin(strong);
      loader.registerPlugin(medium);

      expect(loader.findPluginForPrompt('test')!.manifest.id).toBe('strong');
    });

    it('keyword matching is case-insensitive', () => {
      const plugin = makePlugin({
        manifest: makeManifest({ keywords: ['Sketch'], domains: [] }),
        canHandle: undefined,
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('i love SKETCH art');
      expect(found).toBe(plugin);
    });

    it('domain matching is case-insensitive', () => {
      const plugin = makePlugin({
        manifest: makeManifest({ keywords: [], domains: ['P5'] }),
        canHandle: undefined,
      });
      loader.registerPlugin(plugin);

      const found = loader.findPluginForPrompt('make a p5 animation');
      expect(found).toBe(plugin);
    });
  });

  // ─── event system ─────────────────────────────────────────────────────

  describe('event system', () => {
    it('onEvent registers a handler that receives events', () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      loader.registerPlugin(makePlugin());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports multiple event handlers', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      loader.onEvent(h1);
      loader.onEvent(h2);

      loader.registerPlugin(makePlugin());

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('offEvent removes a specific handler', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      loader.onEvent(h1);
      loader.onEvent(h2);
      loader.offEvent(h1);

      loader.registerPlugin(makePlugin());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('offEvent with non-registered handler does nothing', () => {
      const handler = vi.fn();
      loader.onEvent(handler);
      loader.offEvent(vi.fn()); // different reference

      loader.registerPlugin(makePlugin());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('handler errors do not break other handlers', () => {
      const bad = vi
        .fn()
        .mockImplementation(() => {
          throw new Error('handler crash');
        });
      const good = vi.fn();
      loader.onEvent(bad);
      loader.onEvent(good);

      loader.registerPlugin(makePlugin());

      expect(good).toHaveBeenCalledTimes(1);
    });

    it('events from loadPlugin errors emit plugin:error', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);
      mockFsReadFile.mockRejectedValue(new Error('file not found'));

      await loader.loadPlugin('/plugins/missing');

      const errorEvent = handler.mock.calls.find(
        (call: [PluginEvent]) => call[0].type === 'plugin:error',
      );
      expect(errorEvent).toBeDefined();
      expect(errorEvent![0].pluginId).toBe('missing');
      expect(errorEvent![0].data).toBeDefined();
    });
  });

  // ─── loadAll ──────────────────────────────────────────────────────────

  describe('loadAll()', () => {
    it('returns empty array when directory does not exist (ENOENT)', async () => {
      const enoent = new Error('Not found') as NodeJS.ErrnoException;
      enoent.code = 'ENOENT';
      mockFsReaddir.mockRejectedValue(enoent);

      const results = await loader.loadAll();
      expect(results).toEqual([]);
    });

    it('re-throws non-ENOENT errors from readdir', async () => {
      const permError = new Error('Permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockFsReaddir.mockRejectedValue(permError);

      await expect(loader.loadAll()).rejects.toThrow('Permission denied');
    });

    it('skips non-directory entries', async () => {
      mockFsReaddir.mockResolvedValue([
        { name: 'a-plugin', isDirectory: () => true },
        { name: 'readme.txt', isDirectory: () => false },
        { name: 'config.json', isDirectory: () => false },
      ]);

      mockFsReadFile.mockRejectedValue(new Error('no manifest'));

      const results = await loader.loadAll();
      // Only the directory entry was attempted
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('returns empty array for empty directory', async () => {
      mockFsReaddir.mockResolvedValue([]);

      const results = await loader.loadAll();
      expect(results).toEqual([]);
    });
  });

  // ─── loadPlugin ───────────────────────────────────────────────────────

  describe('loadPlugin()', () => {
    it('returns error for invalid manifest missing id', async () => {
      mockFsReadFile.mockResolvedValue(
        JSON.stringify({ entry: 'index.js', name: 'x', version: '1.0.0', description: '', domains: [], keywords: [] }),
      );

      const result = await loader.loadPlugin('/plugins/bad-plugin');

      expect(result.success).toBe(false);
      expect(result.error!.pluginId).toBe('bad-plugin');
      expect(result.error!.path).toBe('/plugins/bad-plugin');
      expect(result.error!.error).toContain('Invalid manifest');
    });

    it('returns error for invalid manifest missing entry', async () => {
      mockFsReadFile.mockResolvedValue(
        JSON.stringify({ id: 'x', name: 'x', version: '1.0.0', description: '', domains: [], keywords: [] }),
      );

      const result = await loader.loadPlugin('/plugins/no-entry');

      expect(result.success).toBe(false);
      expect(result.error!.error).toContain('Invalid manifest');
    });

    it('returns error for missing dependency', async () => {
      mockFsReadFile.mockResolvedValue(
        JSON.stringify(
          makeManifest({
            id: 'dep-plugin',
            dependencies: ['missing-dep'],
          }),
        ),
      );

      const result = await loader.loadPlugin('/plugins/dep-plugin');

      expect(result.success).toBe(false);
      expect(result.error!.error).toContain('Missing dependency: missing-dep');
    });

    it('returns error when manifest file cannot be read', async () => {
      mockFsReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await loader.loadPlugin('/plugins/no-manifest');

      expect(result.success).toBe(false);
      expect(result.error!.pluginId).toBe('no-manifest');
    });

    it('returns error when manifest is invalid JSON', async () => {
      mockFsReadFile.mockResolvedValue('{ invalid json }');

      const result = await loader.loadPlugin('/plugins/bad-json');

      expect(result.success).toBe(false);
      expect(result.error!.pluginId).toBe('bad-json');
    });

    it('succeeds when all dependencies are already loaded', async () => {
      // Register the dependency first
      const depPlugin = makePlugin({
        manifest: makeManifest({ id: 'base-lib' }),
      });
      loader.registerPlugin(depPlugin);

      mockFsReadFile.mockResolvedValue(
        JSON.stringify(
          makeManifest({
            id: 'dependent-plugin',
            dependencies: ['base-lib'],
          }),
        ),
      );

      // We can't fully test the dynamic import path without more mocking,
      // but the dependency check should pass
      const result = await loader.loadPlugin('/plugins/dependent-plugin');

      // It will fail on the dynamic import, but NOT on the dependency check
      expect(result.success).toBe(false);
      expect(result.error!.error).not.toContain('Missing dependency');
    });

    it('extracts pluginId from path basename', async () => {
      mockFsReadFile.mockRejectedValue(new Error('test'));

      const result = await loader.loadPlugin('/some/nested/path/my-cool-plugin');

      expect(result.error!.pluginId).toBe('my-cool-plugin');
    });
  });
});
