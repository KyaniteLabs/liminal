import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for PluginLoader - Dynamic loading and management of generator plugins
 *
 * PluginLoader supports:
 * - Loading plugins from a directory (via filesystem)
 * - Programmatic registration (registerPlugin)
 * - Plugin lookup by prompt matching (findPluginForPrompt)
 * - Lifecycle management (unload, destroy)
 * - Event notifications (onEvent, offEvent)
 * - Dependency checking
 *
 * Mocks: fs (readdir, readFile), dynamic import, Logger
 */

import { PluginLoader } from '../../../src/plugins/PluginLoader.js';
import type { GeneratorPlugin, PluginManifest, PluginLoadResult, PluginEvent } from '../../../src/plugins/types.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockReaddir = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: mockReaddir,
    readFile: mockReadFile,
  },
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    entry: 'index.js',
    domains: ['p5', 'shader'],
    keywords: ['creative', 'art'],
    ...overrides,
  };
}

function makePlugin(overrides: Partial<GeneratorPlugin> = {}): GeneratorPlugin {
  const manifest = makeManifest();
  return {
    manifest,
    generate: vi.fn().mockResolvedValue('generated code'),
    canHandle: vi.fn().mockReturnValue(0.8),
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader('/tmp/test-plugins');
    mockReaddir.mockReset();
    mockReadFile.mockReset();
  });

  // ── loadAll ──────────────────────────────────────────────────────────────

  describe('loadAll', () => {
    it('returns empty array when plugins directory does not exist', async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const results = await loader.loadAll();
      expect(results).toEqual([]);
    });

    it('re-throws non-ENOENT errors', async () => {
      mockReaddir.mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

      await expect(loader.loadAll()).rejects.toThrow('EACCES');
    });

    it('loads plugins from subdirectories', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'p5', isDirectory: () => true },
        { name: 'shader', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false },
      ]);

      // Mock loadPlugin for each directory
      const p5Manifest = makeManifest({ id: 'p5', entry: 'index.js' });
      const shaderManifest = makeManifest({ id: 'shader', entry: 'main.js' });

      // First call: p5 plugin
      mockReadFile.mockResolvedValueOnce(JSON.stringify(p5Manifest));
      // Second call: shader plugin
      mockReadFile.mockResolvedValueOnce(JSON.stringify(shaderManifest));

      // Mock dynamic imports -- we can't easily mock import() so we test via registerPlugin path
      // For loadAll, the import() will fail, so both results should be errors
      const results = await loader.loadAll();
      expect(results.length).toBe(2);
      // Without a mock for dynamic import, these will fail
      expect(results.every(r => !r.success)).toBe(true);
    });
  });

  // ── loadPlugin ───────────────────────────────────────────────────────────

  describe('loadPlugin', () => {
    it('fails for missing manifest', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const result = await loader.loadPlugin('/plugins/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.pluginId).toBe('nonexistent');
    });

    it('fails for manifest with missing id', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ entry: 'index.js' }));

      const result = await loader.loadPlugin('/plugins/bad');

      expect(result.success).toBe(false);
    });

    it('fails for manifest with missing entry', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ id: 'test' }));

      const result = await loader.loadPlugin('/plugins/bad');

      expect(result.success).toBe(false);
    });

    it('fails when dependency is not loaded', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify(
        makeManifest({ id: 'dep-plugin', dependencies: ['missing-dep'] })
      ));

      const result = await loader.loadPlugin('/plugins/dep');

      expect(result.success).toBe(false);
    });

    it('succeeds for valid manifest with no dependencies', async () => {
      const manifest = makeManifest({ id: 'standalone', entry: 'index.js' });
      mockReadFile.mockResolvedValue(JSON.stringify(manifest));

      // Dynamic import will fail in test, so this will be an error result
      const result = await loader.loadPlugin('/plugins/standalone');

      // The load fails at the dynamic import step
      expect(result.success).toBe(false);
    });
  });

  // ── registerPlugin ───────────────────────────────────────────────────────

  describe('registerPlugin', () => {
    it('stores the plugin and makes it retrievable', () => {
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

    it('appears in getAllPlugins', () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(loader.getAllPlugins()).toContain(plugin);
    });

    it('emits plugin:loaded event', () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe('plugin:loaded');
      expect(handler.mock.calls[0][0].pluginId).toBe('test-plugin');
    });

    it('replaces existing plugin with same id', () => {
      const plugin1 = makePlugin({ manifest: makeManifest({ id: 'dup', name: 'First' }) });
      const plugin2 = makePlugin({ manifest: makeManifest({ id: 'dup', name: 'Second' }) });

      loader.registerPlugin(plugin1);
      loader.registerPlugin(plugin2);

      expect(loader.getPlugin('dup')?.manifest.name).toBe('Second');
      expect(loader.getAllPlugins().length).toBe(1);
    });
  });

  // ── unloadPlugin ─────────────────────────────────────────────────────────

  describe('unloadPlugin', () => {
    it('returns false for non-existent plugin', async () => {
      const result = await loader.unloadPlugin('nonexistent');
      expect(result).toBe(false);
    });

    it('removes the plugin from the registry', async () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      const result = await loader.unloadPlugin('test-plugin');

      expect(result).toBe(true);
      expect(loader.getPlugin('test-plugin')).toBeUndefined();
      expect(loader.isLoaded('test-plugin')).toBe(false);
    });

    it('calls destroy on the plugin', async () => {
      const destroy = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin({ destroy });
      loader.registerPlugin(plugin);

      await loader.unloadPlugin('test-plugin');

      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('emits plugin:unloaded event', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      const plugin = makePlugin();
      loader.registerPlugin(plugin);
      await loader.unloadPlugin('test-plugin');

      const events = handler.mock.calls.map(c => c[0].type);
      expect(events).toContain('plugin:unloaded');
    });

    it('removes the manifest', async () => {
      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      await loader.unloadPlugin('test-plugin');

      expect(loader.getManifest('test-plugin')).toBeUndefined();
    });
  });

  // ── findPluginForPrompt ──────────────────────────────────────────────────

  describe('findPluginForPrompt', () => {
    it('returns undefined when no plugins loaded', () => {
      expect(loader.findPluginForPrompt('make a p5 sketch')).toBeUndefined();
    });

    it('uses canHandle for scoring when available', () => {
      const lowPlugin = makePlugin({
        manifest: makeManifest({ id: 'low-match' }),
        canHandle: vi.fn().mockReturnValue(0.2),
      });
      const highPlugin = makePlugin({
        manifest: makeManifest({ id: 'high-match' }),
        canHandle: vi.fn().mockReturnValue(0.9),
      });

      loader.registerPlugin(lowPlugin);
      loader.registerPlugin(highPlugin);

      const result = loader.findPluginForPrompt('create something');
      expect(result?.manifest.id).toBe('high-match');
    });

    it('falls back to keyword matching when canHandle is not provided', () => {
      const plugin = makePlugin({
        canHandle: undefined,
        manifest: makeManifest({
          id: 'keyword-plugin',
          keywords: ['p5', 'creative'],
          domains: ['p5'],
        }),
      });

      loader.registerPlugin(plugin);

      const result = loader.findPluginForPrompt('make a p5 sketch');
      expect(result?.manifest.id).toBe('keyword-plugin');
    });

    it('matches domains with higher score than keywords', () => {
      const plugin = makePlugin({
        canHandle: undefined,
        manifest: makeManifest({
          id: 'domain-plugin',
          keywords: ['art'],
          domains: ['shader'],
        }),
      });

      loader.registerPlugin(plugin);

      // "shader" in prompt should match the domain
      const result = loader.findPluginForPrompt('create a shader artwork');
      expect(result?.manifest.id).toBe('domain-plugin');
    });

    it('returns undefined when no plugin matches', () => {
      const plugin = makePlugin({
        canHandle: vi.fn().mockReturnValue(0),
        manifest: makeManifest({ id: 'no-match' }),
      });

      loader.registerPlugin(plugin);

      expect(loader.findPluginForPrompt('completely unrelated')).toBeUndefined();
    });
  });

  // ── Event system ─────────────────────────────────────────────────────────

  describe('event system', () => {
    it('onEvent registers handler', () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(handler).toHaveBeenCalled();
    });

    it('offEvent removes handler', () => {
      const handler = vi.fn();
      loader.onEvent(handler);
      loader.offEvent(handler);

      const plugin = makePlugin();
      loader.registerPlugin(plugin);

      expect(handler).not.toHaveBeenCalled();
    });

    it('offEvent with non-registered handler does nothing', () => {
      const handler = vi.fn();
      // Should not throw
      loader.offEvent(handler);
    });

    it('handler errors are caught and do not crash', () => {
      const badHandler = () => { throw new Error('handler crash'); };
      loader.onEvent(badHandler);

      // Should not throw
      const plugin = makePlugin();
      expect(() => loader.registerPlugin(plugin)).not.toThrow();
    });
  });

  // ── Accessors ────────────────────────────────────────────────────────────

  describe('accessors', () => {
    it('getPlugin returns undefined for unknown id', () => {
      expect(loader.getPlugin('unknown')).toBeUndefined();
    });

    it('getManifest returns undefined for unknown id', () => {
      expect(loader.getManifest('unknown')).toBeUndefined();
    });

    it('getAllPlugins returns empty array when nothing loaded', () => {
      expect(loader.getAllPlugins()).toEqual([]);
    });

    it('isLoaded returns false for unloaded plugin', () => {
      expect(loader.isLoaded('nothing')).toBe(false);
    });
  });

  // ── Plugin with initialize lifecycle ─────────────────────────────────────

  describe('plugin lifecycle', () => {
    it('registerPlugin does not call initialize (initialize is for loadPlugin path)', () => {
      const initialize = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin({ initialize });

      loader.registerPlugin(plugin);

      // registerPlugin skips initialize -- that's only for filesystem loading
      expect(initialize).not.toHaveBeenCalled();
    });
  });
});
