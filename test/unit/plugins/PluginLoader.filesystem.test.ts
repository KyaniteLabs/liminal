import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests for PluginLoader filesystem-based loading
 *
 * Unlike PluginLoader.test.ts which mocks fs/import, this file uses REAL
 * fixture files in test/fixtures/plugins/ so dynamic import() actually resolves.
 * This covers the success path (lines 95-119) that mocked tests cannot reach.
 */

import { PluginLoader } from '../../../src/plugins/PluginLoader.js';
import type { PluginEvent } from '../../../src/plugins/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/plugins');

describe('PluginLoader filesystem loading', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader(FIXTURES_DIR);
  });

  // ── loadPlugin: success paths ─────────────────────────────────────────

  describe('loadPlugin (success)', () => {
    it('loads a plugin with all lifecycle methods', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(true);
      expect(result.plugin).not.toBeNull();
      expect(result.plugin!.manifest.id).toBe('good-plugin');
      expect(result.plugin!.manifest.name).toBe('Good Plugin');
      expect(result.plugin!.manifest.version).toBe('1.0.0');
      expect(result.plugin!.manifest.author).toBe('Test Author');
      expect(result.plugin!.manifest.domains).toEqual(['p5', 'shader']);
      expect(result.plugin!.manifest.keywords).toEqual(['creative', 'art', 'test']);
    });

    it('stores the plugin in the registry after loading', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');
      await loader.loadPlugin(pluginPath);

      expect(loader.isLoaded('good-plugin')).toBe(true);
      expect(loader.getPlugin('good-plugin')).not.toBeNull();
      expect(loader.getManifest('good-plugin')).not.toBeNull();
      expect(loader.getManifest('good-plugin')!.name).toBe('Good Plugin');
    });

    it('emits plugin:loaded event on success', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');
      await loader.loadPlugin(pluginPath);

      expect(handler).toHaveBeenCalledTimes(1);
      const event: PluginEvent = handler.mock.calls[0][0];
      expect(event.type).toBe('plugin:loaded');
      expect(event.pluginId).toBe('good-plugin');
      expect(event.timestamp).toBeTruthy();
    });

    it('makes plugin available via findPluginForPrompt', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');
      await loader.loadPlugin(pluginPath);

      const found = loader.findPluginForPrompt('create a test animation');
      expect(found).not.toBeNull();
      expect(found!.manifest.id).toBe('good-plugin');
    });

    it('loads a minimal plugin with only generate()', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'minimal-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(true);
      expect(result.plugin).not.toBeNull();
      expect(result.plugin!.manifest.id).toBe('minimal-plugin');
      expect(result.plugin!.canHandle).toBeUndefined();
      expect(result.plugin!.initialize).toBeUndefined();
      expect(result.plugin!.destroy).toBeUndefined();
    });
  });

  // ── loadPlugin: error paths ───────────────────────────────────────────

  describe('loadPlugin (errors)', () => {
    it('fails with parse error for malformed JSON manifest', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'bad-json-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.error!.pluginId).toBe('bad-json-plugin');
      expect(result.error!.error).toContain('PluginLoader');
    });

    it('fails when entry file does not exist', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'missing-entry-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.error!.pluginId).toBe('missing-entry-plugin');
    });

    it('fails when plugin initialize() throws', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'init-fail-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
      expect(result.error!.pluginId).toBe('init-fail-plugin');
      expect(result.error!.error).toContain('initialize failed on purpose');
    });

    it('emits plugin:error event on failure', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      const pluginPath = path.join(FIXTURES_DIR, 'bad-json-plugin');
      await loader.loadPlugin(pluginPath);

      expect(handler).toHaveBeenCalledTimes(1);
      const event: PluginEvent = handler.mock.calls[0][0];
      expect(event.type).toBe('plugin:error');
      expect(event.pluginId).toBe('bad-json-plugin');
      expect(event.data).not.toBeNull();
    });

    it('does not store plugin in registry on failure', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'bad-json-plugin');
      await loader.loadPlugin(pluginPath);

      expect(loader.isLoaded('bad-json-plugin')).toBe(false);
      expect(loader.getPlugin('bad-json-plugin')).toBeUndefined();
    });
  });

  // ── loadPlugin: dependencies ──────────────────────────────────────────

  describe('loadPlugin (dependencies)', () => {
    it('fails when dependency is not loaded', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'dep-plugin');
      const result = await loader.loadPlugin(pluginPath);

      expect(result.success).toBe(false);
      expect(result.error!.error).toContain('Missing dependency: good-plugin');
    });

    it('succeeds when dependency is already loaded', async () => {
      await loader.loadPlugin(path.join(FIXTURES_DIR, 'good-plugin'));

      const depResult = await loader.loadPlugin(path.join(FIXTURES_DIR, 'dep-plugin'));

      expect(depResult.success).toBe(true);
      expect(depResult.plugin!.manifest.id).toBe('dep-plugin');
    });

    it('both plugins appear in getAllPlugins after dependent loads', async () => {
      await loader.loadPlugin(path.join(FIXTURES_DIR, 'good-plugin'));
      await loader.loadPlugin(path.join(FIXTURES_DIR, 'dep-plugin'));

      const all = loader.getAllPlugins();
      expect(all).toHaveLength(2);
      const ids = all.map(p => p.manifest.id);
      expect(ids).toContain('good-plugin');
      expect(ids).toContain('dep-plugin');
    });
  });

  // ── loadAll ───────────────────────────────────────────────────────────

  describe('loadAll', () => {
    it('loads all plugins from the fixture directory', async () => {
      const results = await loader.loadAll();

      expect(results.length).toBeGreaterThan(0);

      const successes = results.filter(r => r.success);
      expect(successes.length).toBeGreaterThanOrEqual(2);

      const ids = successes.map(r => r.plugin!.manifest.id);
      expect(ids).toContain('good-plugin');
      expect(ids).toContain('minimal-plugin');
    });

    it('reports errors for plugins that fail to load', async () => {
      const results = await loader.loadAll();

      const failures = results.filter(r => !r.success);
      expect(failures.length).toBeGreaterThanOrEqual(1);

      const failedIds = failures.map(r => r.error!.pluginId);
      expect(failedIds).toContain('bad-json-plugin');
    });
  });

  // ── full lifecycle ────────────────────────────────────────────────────

  describe('full lifecycle', () => {
    it('load -> generate -> unload workflow', async () => {
      const events: PluginEvent[] = [];
      loader.onEvent((e) => events.push(e));

      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');
      const loadResult = await loader.loadPlugin(pluginPath);
      expect(loadResult.success).toBe(true);

      const plugin = loadResult.plugin!;
      const code = await plugin.generate('test sketch');
      expect(code).toContain('test sketch');

      const unloaded = await loader.unloadPlugin('good-plugin');
      expect(unloaded).toBe(true);
      expect(loader.isLoaded('good-plugin')).toBe(false);

      expect(events.map(e => e.type)).toEqual(
        expect.arrayContaining(['plugin:loaded', 'plugin:unloaded']),
      );
    });

    it('load -> find by prompt -> generate workflow', async () => {
      await loader.loadPlugin(path.join(FIXTURES_DIR, 'good-plugin'));
      await loader.loadPlugin(path.join(FIXTURES_DIR, 'minimal-plugin'));

      const found = loader.findPluginForPrompt('test something');
      expect(found).not.toBeNull();

      const code = await found!.generate('test prompt');
      expect(code).toBeTruthy();
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles loading same plugin twice (replaces)', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'good-plugin');

      await loader.loadPlugin(pluginPath);
      await loader.loadPlugin(pluginPath);

      expect(loader.getAllPlugins().filter(p => p.manifest.id === 'good-plugin')).toHaveLength(1);
    });

    it('empty directory returns empty results', async () => {
      const emptyLoader = new PluginLoader('/tmp/liminal-test-no-such-dir-' + Date.now());
      const results = await emptyLoader.loadAll();
      expect(results).toEqual([]);
    });

    it('offEvent stops receiving events', async () => {
      const handler = vi.fn();
      loader.onEvent(handler);

      await loader.loadPlugin(path.join(FIXTURES_DIR, 'good-plugin'));
      expect(handler).toHaveBeenCalledTimes(1);

      loader.offEvent(handler);

      const plugin = {
        manifest: {
          id: 'after-off',
          name: 'After Off',
          version: '1.0.0',
          description: '',
          entry: 'x',
          domains: [],
          keywords: [],
        },
        generate: async () => '',
      };
      loader.registerPlugin(plugin);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('event handler errors do not prevent plugin registration', () => {
      const badHandler = () => { throw new Error('event crash'); };
      loader.onEvent(badHandler);

      const plugin = {
        manifest: {
          id: 'crash-safe',
          name: 'Crash Safe',
          version: '1.0.0',
          description: '',
          entry: 'x',
          domains: [],
          keywords: [],
        },
        generate: async () => '',
      };

      expect(() => loader.registerPlugin(plugin)).not.toThrow();
      expect(loader.isLoaded('crash-safe')).toBe(true);
    });

    it('handles event handlers that throw non-Error values', () => {
      const badHandler = () => {
        throw 'string error';
      };
      loader.onEvent(badHandler);

      const plugin = {
        manifest: {
          id: 'non-error-throw',
          name: 'Non Error',
          version: '1.0.0',
          description: '',
          entry: 'x',
          domains: [],
          keywords: [],
        },
        generate: async () => '',
      };

      expect(() => loader.registerPlugin(plugin)).not.toThrow();
      expect(loader.isLoaded('non-error-throw')).toBe(true);
    });

    it('unloads a plugin without destroy() method', async () => {
      const pluginPath = path.join(FIXTURES_DIR, 'minimal-plugin');
      await loader.loadPlugin(pluginPath);
      expect(loader.isLoaded('minimal-plugin')).toBe(true);

      const result = await loader.unloadPlugin('minimal-plugin');
      expect(result).toBe(true);
      expect(loader.isLoaded('minimal-plugin')).toBe(false);
    });
  });
});
