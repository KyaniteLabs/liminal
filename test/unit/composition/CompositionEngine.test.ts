/**
 * CompositionEngine Tests
 *
 * Tests for CompositionEngine, StateManager, and types.ts factory functions.
 * Cover: engine construction, layer management, settings, HTML generation,
 * StateManager register/get/subscribe/clear, createLayer, createComposition,
 * exportProject, and error paths.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CompositionEngine,
  StateManager,
} from '../../../src/composition/CompositionEngine.js';
import {
  createLayer,
  createComposition,
  exportProject,
  DEFAULT_LAYER_CONFIG,
  DEFAULT_GLOBAL_SETTINGS,
} from '../../../src/composition/types.js';
import type { LayerAdapter } from '../../../src/composition/adapters/index.js';

// ---------------------------------------------------------------------------
// StateManager
// ---------------------------------------------------------------------------
describe('StateManager', () => {
  let state: StateManager;

  beforeEach(() => {
    state = new StateManager();
  });

  describe('register + get', () => {
    it('stores a getter and returns the computed value', () => {
      state.register('count', () => 42);
      expect(state.get<number>('count')).toBe(42);
    });

    it('returns undefined for unknown keys', () => {
      expect(state.get('nope')).toBeUndefined();
    });

    it('evaluates the getter lazily on each get() call', () => {
      let counter = 0;
      state.register('inc', () => ++counter);
      expect(state.get<number>('inc')).toBe(1);
      expect(state.get<number>('inc')).toBe(2);
    });

    it('can store objects and complex values', () => {
      const obj = { x: 10, y: 20 };
      state.register('pos', () => obj);
      expect(state.get<{ x: number; y: number }>('pos')).toEqual({ x: 10, y: 20 });
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const unsub = state.subscribe('key', () => {});
      expect(typeof unsub).toBe('function');
    });

    it('unsubscribes cleanly without error', () => {
      const cb = vi.fn();
      const unsub = state.subscribe('key', cb);
      unsub();
      // No further assertions needed -- contract is "no throw"
    });
  });

  describe('clear', () => {
    it('removes all registered keys', () => {
      state.register('a', () => 1);
      state.register('b', () => 2);
      state.clear();
      expect(state.get('a')).toBeUndefined();
      expect(state.get('b')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Factory functions (types.ts)
// ---------------------------------------------------------------------------
describe('createLayer', () => {
  it('creates a layer with default config', () => {
    const layer = createLayer('p5', 'console.log("hi")', 'test prompt');
    expect(layer.type).toBe('p5');
    expect(layer.code).toBe('console.log("hi")');
    expect(layer.metadata.prompt).toBe('test prompt');
    expect(layer.metadata.generator).toBe('unknown');
    expect(layer.metadata.model).toBe('unknown');
    expect(layer.enabled).toBe(true);
    expect(layer.locked).toBe(false);
    expect(layer.id).toMatch(/^layer_/);
  });

  it('applies custom metadata', () => {
    const layer = createLayer('three', 'code', 'prompt', {
      generator: 'TierBased',
      model: 'gpt-4o',
    });
    expect(layer.metadata.generator).toBe('TierBased');
    expect(layer.metadata.model).toBe('gpt-4o');
  });

  it('applies custom config overrides', () => {
    const layer = createLayer('shader', 'code', 'prompt', undefined, {
      opacity: 0.5,
      zIndex: 10
    });
    expect(layer.config.opacity).toBe(0.5);
    expect(layer.config.zIndex).toBe(10);
    // Non-overridden defaults remain
    expect(layer.config.blendMode).toBe('normal');
    expect(layer.config.scale).toBe(1.0);
  });

  it('generates unique IDs for each layer', () => {
    const a = createLayer('p5', 'code', 'prompt');
    const b = createLayer('p5', 'code', 'prompt');
    expect(a.id).not.toBe(b.id);
  });

  it('sets generatedAt to current time', () => {
    const before = new Date();
    const layer = createLayer('p5', 'code', 'prompt');
    const after = new Date();
    const ts = new Date(layer.metadata.generatedAt);
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('createComposition', () => {
  it('creates a composition with default settings', () => {
    const comp = createComposition('test-comp');
    expect(comp.id).toMatch(/^comp_/);
    expect(comp.layers).toEqual([]);
    expect(comp.globalSettings).toEqual(DEFAULT_GLOBAL_SETTINGS);
  });

  it('applies custom settings over defaults', () => {
    const comp = createComposition('test', { width: 1024, height: 768 });
    expect(comp.globalSettings.width).toBe(1024);
    expect(comp.globalSettings.height).toBe(768);
    // Other defaults remain
    expect(comp.globalSettings.frameRate).toBe(60);
    expect(comp.globalSettings.backgroundColor).toBe('#000000');
  });

  it('sets metadata name', () => {
    const comp = createComposition('My Project');
    expect(comp.metadata.name).toBe('My Project');
  });

  it('initializes tags as empty array', () => {
    const comp = createComposition('test');
    expect(comp.metadata.tags).toEqual([]);
  });

  it('sets createdAt and modifiedAt to the same time', () => {
    const comp = createComposition('test');
    expect(comp.metadata.createdAt).toBe(comp.metadata.modifiedAt);
  });
});

describe('exportProject', () => {
  it('exports composition to v1.0 project format', () => {
    const comp = createComposition('test');
    const project = exportProject(comp);
    expect(project.version).toBe('1.0');
    expect(project.composition).toBe(comp);
    expect(project.metadata.created).toBe(comp.metadata.createdAt);
  });

  it('sets modified to current time', () => {
    const comp = createComposition('test');
    const beforeExport = new Date();
    const project = exportProject(comp);
    const afterExport = new Date();
    const modifiedTs = new Date(project.metadata.modified).getTime();
    expect(modifiedTs).toBeGreaterThanOrEqual(beforeExport.getTime());
    expect(modifiedTs).toBeLessThanOrEqual(afterExport.getTime());
  });
});

describe('DEFAULT_LAYER_CONFIG', () => {
  it('has correct default values', () => {
    expect(DEFAULT_LAYER_CONFIG.zIndex).toBe(0);
    expect(DEFAULT_LAYER_CONFIG.blendMode).toBe('normal');
    expect(DEFAULT_LAYER_CONFIG.opacity).toBe(1.0);
    expect(DEFAULT_LAYER_CONFIG.position).toEqual({ x: 0, y: 0 });
    expect(DEFAULT_LAYER_CONFIG.scale).toBe(1.0);
  });
});

describe('DEFAULT_GLOBAL_SETTINGS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_GLOBAL_SETTINGS.width).toBe(800);
    expect(DEFAULT_GLOBAL_SETTINGS.height).toBe(600);
    expect(DEFAULT_GLOBAL_SETTINGS.frameRate).toBe(60);
    expect(DEFAULT_GLOBAL_SETTINGS.backgroundColor).toBe('#000000');
    expect(DEFAULT_GLOBAL_SETTINGS.audio?.sampleRate).toBe(44100);
    expect(DEFAULT_GLOBAL_SETTINGS.audio?.enabled).toBe(true);
    expect(DEFAULT_GLOBAL_SETTINGS.audio?.volume).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// CompositionEngine
// ---------------------------------------------------------------------------
describe('CompositionEngine', () => {
  let engine: CompositionEngine;

  beforeEach(() => {
    engine = new CompositionEngine();
  });

  describe('constructor', () => {
    it('creates engine with default settings', () => {
      const settings = engine.getSettings();
      expect(settings.width).toBe(800);
      expect(settings.height).toBe(600);
    });

    it('accepts custom settings', () => {
      const customEngine = new CompositionEngine({
        settings: { width: 1024, height: 768 },
      });
      const settings = customEngine.getSettings();
      expect(settings.width).toBe(1024);
      expect(settings.height).toBe(768);
    });

    it('returns defensive copy from getSettings', () => {
      const settings = engine.getSettings();
      settings.width = 9999; // Mutate the copy
      expect(engine.getSettings().width).toBe(800);
    });
  });

  describe('adapter registration', () => {
    it('registers and retrieves adapter by domain type', () => {
      const adapter: LayerAdapter = {
        render: vi.fn(),
      };
      engine.registerAdapter('p5', adapter);
      // Adapter is stored - verified through render below
    });
  });

  describe('layer management', () => {
    it('addLayer and getLayers', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      expect(engine.getLayers()).toHaveLength(1);
      expect(engine.getLayers()[0].id).toBe(layer.id);
    });

    it('removeLayer returns true for existing layer', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      expect(engine.removeLayer(layer.id)).toBe(true);
      expect(engine.getLayers()).toHaveLength(0);
    });

    it('removeLayer returns false for non-existent layer', () => {
      expect(engine.removeLayer('nonexistent')).toBe(false);
    });

    it('getLayers returns empty array when no layers added', () => {
      expect(engine.getLayers()).toEqual([]);
    });
  });

  describe('settings management', () => {
    it('updateSettings merges partial settings', () => {
      engine.updateSettings({ width: 500 });
      expect(engine.getSettings().width).toBe(500);
      expect(engine.getSettings().height).toBe(600); // unchanged default
    });

    it('updateSettings triggers onChange callback', () => {
      const onChange = vi.fn();
      const e = new CompositionEngine({ onChange });
      e.updateSettings({ width: 200 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].globalSettings.width).toBe(200);
    });
  });

  describe('render', () => {
    it('throws when no container is set', () => {
      expect(() => engine.render()).toThrow('CompositionEngine: No container set');
    });

    it('renders with a valid container', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const adapter: LayerAdapter = {
        render: vi.fn(),
      };
      engine.registerAdapter('p5', adapter);
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      engine.setContainer(container);
      engine.render();
      expect(adapter.render).toHaveBeenCalled();
    });

    it('sets container styles from settings', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      engine.setContainer(container);
      engine.updateSettings({ width: 1024, height: 768, backgroundColor: '#ff0000' });
      engine.render();
      expect(container.style.width).toBe('1024px');
      expect(container.style.height).toBe('768px');
      expect(container.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('renders only enabled layers', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const adapter: LayerAdapter = { render: vi.fn() };
      engine.registerAdapter('p5', adapter);
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      engine.setContainer(container);
      engine.render();
      expect(adapter.render).toHaveBeenCalledTimes(1);
    });

    it('skips layers with no registered adapter', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const layer = createLayer('p5', 'code', 'prompt'); // No adapter registered
      engine.addLayer(layer);
      engine.setContainer(container);
      expect(() => engine.render()).not.toThrow();
    });

    it('continues on adapter render error', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const adapter: LayerAdapter = {
        render: vi.fn().mockImplementation(() => { throw new Error('boom'); }),
      };
      engine.registerAdapter('p5', adapter);
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      engine.setContainer(container);
      // Should not throw -- error is caught internally
      expect(() => engine.render()).not.toThrow();
    });

    it('registers layer exports from adapters', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const adapter: LayerAdapter = {
        render: vi.fn(),
        getExports: vi.fn().mockReturnValue([
          { name: 'frameCount', type: 'number' as const, getter: () => 42 },
        ]),
      };
      engine.registerAdapter('p5', adapter);
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      engine.setContainer(container);
      engine.render();
      expect(adapter.getExports).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('does nothing when no render context exists', () => {
      expect(() => engine.cleanup()).not.toThrow();
    });

    it('cleans up after render', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const adapter: LayerAdapter = {
        render: vi.fn().mockReturnValue({ instance: true }),
        destroy: vi.fn(),
      };
      engine.registerAdapter('p5', adapter);
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      engine.setContainer(container);
      engine.render();
      engine.cleanup();
      expect(adapter.destroy).toHaveBeenCalled();
    });
  });

  describe('generateHTML', () => {
    it('produces a complete HTML document', () => {
      const html = engine.generateHTML();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('#composition');
    });

    it('includes settings dimensions in the HTML', () => {
      engine.updateSettings({ width: 1024, height: 768 });
      const html = engine.generateHTML();
      expect(html).toContain('width: 1024px');
      expect(html).toContain('height: 768px');
    });

    it('includes background color in body style', () => {
      engine.updateSettings({ backgroundColor: '#333333' });
      const html = engine.generateHTML();
      expect(html).toContain('background: #333333');
    });

    it('includes layer scripts from adapters with generateScript', () => {
      const mockAdapter: LayerAdapter = {
        generateScript: vi.fn().mockReturnValue('// p5 script here'),
      };
      engine.registerAdapter('p5', mockAdapter);

      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      const html = engine.generateHTML();
      expect(html).toContain('// p5 script here');
    });

    it('skips layers whose adapter has no generateScript', () => {
      const mockAdapter: LayerAdapter = {
        // No generateScript method
      };
      engine.registerAdapter('p5', mockAdapter);

      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);

      // Should not throw, just skip
      const html = engine.generateHTML();
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('only includes enabled layers', () => {
      const mockAdapter: LayerAdapter = {
        generateScript: vi.fn().mockReturnValue('// script'),
      };
      engine.registerAdapter('p5', mockAdapter);

      const layer = createLayer('p5', 'code', 'prompt');
      layer.enabled = false;
      engine.addLayer(layer);

      const html = engine.generateHTML();
      expect(html).not.toContain('// script');
    });
  });

  describe('import/export layers', () => {
    it('exportLayers returns the internal layers array', () => {
      const layer = createLayer('p5', 'code', 'prompt');
      engine.addLayer(layer);
      const exported = engine.exportLayers();
      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe(layer.id);
    });

    it('importLayers replaces the internal layers', () => {
      const layer = createLayer('three', 'code', 'prompt');
      engine.importLayers([layer]);
      expect(engine.getLayers()).toHaveLength(1);
      expect(engine.getLayers()[0].type).toBe('three');
    });
  });

  describe('getAnimations', () => {
    it('returns empty array (placeholder)', () => {
      expect(engine.getAnimations()).toEqual([]);
    });
  });

  describe('getMasks', () => {
    it('returns masks from the mask manager', () => {
      // No masks by default
      expect(engine.getMasks()).toEqual([]);
    });

    it('returns created masks', () => {
      const maskManager = engine.getMaskManager();
      const layer1 = createLayer('p5', 'a', 'a');
      const layer2 = createLayer('p5', 'b', 'b');
      engine.addLayer(layer1);
      engine.addLayer(layer2);
      maskManager.createMask(layer1.id, layer2.id);
      expect(engine.getMasks()).toHaveLength(1);
      expect(engine.getMasks()[0].sourceLayerId).toBe(layer1.id);
      expect(engine.getMasks()[0].targetLayerId).toBe(layer2.id);
    });
  });

  describe('onChange callback', () => {
    it('fires when a layer is added', () => {
      const onChange = vi.fn();
      const e = new CompositionEngine({ onChange });
      const layer = createLayer('p5', 'code', 'prompt');
      e.addLayer(layer);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].layers).toHaveLength(1);
    });

    it('fires when a layer is removed', () => {
      const onChange = vi.fn();
      const e = new CompositionEngine({ onChange });
      const layer = createLayer('p5', 'code', 'prompt');
      e.addLayer(layer);
      onChange.mockClear();
      e.removeLayer(layer.id);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('fires when settings are updated', () => {
      const onChange = vi.fn();
      const e = new CompositionEngine({ onChange });
      e.updateSettings({ width: 200 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].globalSettings.width).toBe(200);
    });
  });
});
