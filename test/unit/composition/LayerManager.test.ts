/**
 * LayerManager unit tests — CRUD operations, animations, import/export.
 * Tests public API not covered by LayerGroups.test.ts.
 * Covers: addLayer, removeLayer, updateLayer, updateLayerConfig, moveLayer,
 *   reorderLayers, toggleLayer, toggleLocked, duplicateLayer, getLayersByType,
 *   getEnabledLayers, clear, count, exportLayers, importLayers, animation operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayerManager } from '../../../src/composition/LayerManager.js';
import { createLayer, Layer } from '../../../src/composition/types.js';

// Mock KeyframeAnimation to isolate LayerManager logic
const { mockCreateAnim, mockPlay, mockPause, mockStop, mockGenCSS, mockGenJS, mockInterp } = vi.hoisted(() => ({
  mockCreateAnim: vi.fn(),
  mockPlay: vi.fn(),
  mockPause: vi.fn(),
  mockStop: vi.fn(),
  mockGenCSS: vi.fn(),
  mockGenJS: vi.fn(),
  mockInterp: vi.fn(),
}));

vi.mock('../../../src/composition/KeyframeAnimation.js', () => ({
  KeyframeAnimation: class MockKeyframeAnimation {
    createAnimation = mockCreateAnim;
    play = mockPlay;
    pause = mockPause;
    stop = mockStop;
    generateCSS = mockGenCSS;
    generateJS = mockGenJS;
    interpolate = mockInterp;
  },
}));

describe('LayerManager', () => {
  let manager: LayerManager;
  let layer1: Layer;
  let layer2: Layer;
  let layer3: Layer;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LayerManager();
    layer1 = createLayer('p5', 'code1', 'prompt1');
    layer2 = createLayer('three', 'code2', 'prompt2');
    layer3 = createLayer('shader', 'code3', 'prompt3');
  });

  describe('addLayer + getLayers', () => {
    it('adds a layer and retrieves it sorted by z-index', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      manager.addLayer(layer3);

      const layers = manager.getLayers();
      expect(layers).toHaveLength(3);
    });

    it('auto-assigns z-index when layer z-index is 0 and others exist', () => {
      manager.addLayer(layer1); // zIndex 0 (first, stays 0)
      manager.addLayer(layer2); // auto zIndex 1

      const layers = manager.getLayers();
      expect(layers[0].config.zIndex).toBe(0);
      expect(layers[1].config.zIndex).toBe(1);
    });

    it('fires onChange callback when a layer is added', () => {
      const onChange = vi.fn();
      const mgr = new LayerManager({ onChange });
      mgr.addLayer(layer1);

      expect(onChange).toHaveBeenCalledTimes(1);
      const emittedLayers = onChange.mock.calls[0][0];
      expect(emittedLayers).toHaveLength(1);
    });
  });

  describe('getLayer()', () => {
    it('returns the layer by ID', () => {
      manager.addLayer(layer1);
      expect(manager.getLayer(layer1.id)).toBe(layer1);
    });

    it('returns undefined for unknown ID', () => {
      expect(manager.getLayer('nonexistent')).toBeUndefined();
    });
  });

  describe('removeLayer()', () => {
    it('removes a layer by ID and returns true', () => {
      manager.addLayer(layer1);
      const result = manager.removeLayer(layer1.id);
      expect(result).toBe(true);
      expect(manager.count).toBe(0);
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.removeLayer('nonexistent')).toBe(false);
    });

    it('unparents children when removing a group', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      const group = manager.createGroup('TestGroup', [layer1.id, layer2.id]);

      manager.removeLayer(group!.id);

      expect(manager.getLayer(layer1.id)?.parentLayerId).toBeUndefined();
      expect(manager.getLayer(layer2.id)?.parentLayerId).toBeUndefined();
    });

    it('removes child from parent group when removing a child layer', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      const group = manager.createGroup('TestGroup', [layer1.id, layer2.id]);

      manager.removeLayer(layer1.id);

      const updatedGroup = manager.getLayer(group!.id);
      expect(updatedGroup?.children).not.toContain(layer1.id);
      expect(updatedGroup?.children).toContain(layer2.id);
    });
  });

  describe('updateLayer()', () => {
    it('updates code', () => {
      manager.addLayer(layer1);
      const result = manager.updateLayer(layer1.id, { code: 'new code' });
      expect(result).toBe(true);
      expect(manager.getLayer(layer1.id)?.code).toBe('new code');
    });

    it('updates enabled state', () => {
      manager.addLayer(layer1);
      manager.updateLayer(layer1.id, { enabled: false });
      expect(manager.getLayer(layer1.id)?.enabled).toBe(false);
    });

    it('updates locked state', () => {
      manager.addLayer(layer1);
      manager.updateLayer(layer1.id, { locked: true });
      expect(manager.getLayer(layer1.id)?.locked).toBe(true);
    });

    it('merges metadata partially', () => {
      manager.addLayer(layer1);
      manager.updateLayer(layer1.id, { metadata: { aestheticScore: 0.85 } });
      const updated = manager.getLayer(layer1.id);
      expect(updated?.metadata.aestheticScore).toBe(0.85);
      expect(updated?.metadata.prompt).toBe('prompt1'); // Original preserved
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.updateLayer('nonexistent', { code: 'x' })).toBe(false);
    });
  });

  describe('updateLayerConfig()', () => {
    it('updates layer configuration', () => {
      manager.addLayer(layer1);
      const result = manager.updateLayerConfig(layer1.id, { opacity: 0.3, scale: 2.0 });
      expect(result).toBe(true);
      const config = manager.getLayer(layer1.id)?.config;
      expect(config?.opacity).toBe(0.3);
      expect(config?.scale).toBe(2.0);
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.updateLayerConfig('nonexistent', { opacity: 0 })).toBe(false);
    });
  });

  describe('moveLayer()', () => {
    it('moves a layer to new z-index', () => {
      manager.addLayer(layer1);
      manager.moveLayer(layer1.id, 42);
      expect(manager.getLayer(layer1.id)?.config.zIndex).toBe(42);
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.moveLayer('nonexistent', 5)).toBe(false);
    });
  });

  describe('reorderLayers()', () => {
    it('reorders layers by array of IDs', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      manager.addLayer(layer3);

      // Reverse the order
      const result = manager.reorderLayers([layer3.id, layer2.id, layer1.id]);
      expect(result).toBe(true);

      const layers = manager.getLayers();
      expect(layers[0].id).toBe(layer3.id);
      expect(layers[0].config.zIndex).toBe(0);
      expect(layers[2].id).toBe(layer1.id);
      expect(layers[2].config.zIndex).toBe(2);
    });

    it('returns false when array length does not match layer count', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      expect(manager.reorderLayers([layer1.id])).toBe(false);
    });

    it('returns false when IDs do not match current layers', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      expect(manager.reorderLayers([layer1.id, 'nonexistent'])).toBe(false);
    });
  });

  describe('toggleLayer()', () => {
    it('toggles enabled state from true to false', () => {
      manager.addLayer(layer1);
      expect(layer1.enabled).toBe(true);
      manager.toggleLayer(layer1.id);
      expect(manager.getLayer(layer1.id)?.enabled).toBe(false);
    });

    it('toggles enabled state back to true', () => {
      manager.addLayer(layer1);
      manager.toggleLayer(layer1.id);
      manager.toggleLayer(layer1.id);
      expect(manager.getLayer(layer1.id)?.enabled).toBe(true);
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.toggleLayer('nonexistent')).toBe(false);
    });
  });

  describe('toggleLocked()', () => {
    it('toggles locked state', () => {
      manager.addLayer(layer1);
      expect(layer1.locked).toBe(false);
      manager.toggleLocked(layer1.id);
      expect(manager.getLayer(layer1.id)?.locked).toBe(true);
    });

    it('returns false for nonexistent ID', () => {
      expect(manager.toggleLocked('nonexistent')).toBe(false);
    });
  });

  describe('duplicateLayer()', () => {
    it('duplicates a layer with new ID and incremented z-index', () => {
      manager.addLayer(layer1);
      const dup = manager.duplicateLayer(layer1.id);

      expect(dup).not.toBeNull();
      expect(dup!.id).not.toBe(layer1.id);
      expect(dup!.code).toBe('code1');
      expect(dup!.config.zIndex).toBe(layer1.config.zIndex + 1);
      expect(manager.count).toBe(2);
    });

    it('returns null for nonexistent ID', () => {
      expect(manager.duplicateLayer('nonexistent')).toBeNull();
    });

    it('preserves metadata but updates generatedAt', () => {
      manager.addLayer(layer1);
      // Fix timestamp so duplicate creates a different one
      layer1.metadata.generatedAt = '2024-01-01T00:00:00.000Z';
      const dup = manager.duplicateLayer(layer1.id);
      expect(dup!.metadata.prompt).toBe('prompt1');
      expect(dup!.metadata.generatedAt).not.toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('getLayersByType()', () => {
    it('filters layers by domain type', () => {
      manager.addLayer(layer1); // p5
      manager.addLayer(layer2); // three
      manager.addLayer(layer3); // shader

      const p5Layers = manager.getLayersByType('p5');
      expect(p5Layers).toHaveLength(1);
      expect(p5Layers[0].id).toBe(layer1.id);
    });

    it('returns empty array for type with no layers', () => {
      manager.addLayer(layer1);
      expect(manager.getLayersByType('tone')).toEqual([]);
    });
  });

  describe('getEnabledLayers()', () => {
    it('returns only enabled layers', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      manager.updateLayer(layer2.id, { enabled: false });

      const enabled = manager.getEnabledLayers();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe(layer1.id);
    });

    it('returns empty when all layers are disabled', () => {
      manager.addLayer(layer1);
      manager.updateLayer(layer1.id, { enabled: false });
      expect(manager.getEnabledLayers()).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('removes all layers', () => {
      manager.addLayer(layer1);
      manager.addLayer(layer2);
      manager.clear();
      expect(manager.count).toBe(0);
      expect(manager.getLayers()).toEqual([]);
    });

    it('fires onChange callback', () => {
      const onChange = vi.fn();
      const mgr = new LayerManager({ onChange });
      mgr.addLayer(layer1);
      onChange.mockClear();
      mgr.clear();
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('count', () => {
    it('returns current layer count', () => {
      expect(manager.count).toBe(0);
      manager.addLayer(layer1);
      expect(manager.count).toBe(1);
      manager.addLayer(layer2);
      expect(manager.count).toBe(2);
    });
  });

  describe('exportLayers / importLayers', () => {
    it('exports a shallow copy of the layers array', () => {
      manager.addLayer(layer1);
      const exported = manager.exportLayers();
      expect(exported).toHaveLength(1);
      // Mutating exported should not affect manager
      exported.push(layer2);
      expect(manager.count).toBe(1);
    });

    it('imports layers and fires onChange', () => {
      const onChange = vi.fn();
      const mgr = new LayerManager({ onChange });
      mgr.importLayers([layer1, layer2]);

      expect(mgr.count).toBe(2);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== ANIMATION OPERATIONS ====================

  describe('createAnimation()', () => {
    it('creates an animation for an existing layer', () => {
      manager.addLayer(layer1);

      const fakeAnim = { id: 'anim-1', layerId: layer1.id, duration: 1000, keyframes: [] };
      mockCreateAnim.mockReturnValue(fakeAnim);

      const result = manager.createAnimation(layer1.id, 1000, [
        { time: 0, properties: { opacity: 0 } },
        { time: 1, properties: { opacity: 1 } },
      ]);

      expect(result).toEqual(fakeAnim);
      expect(manager.getAnimations(layer1.id)).toHaveLength(1);
    });

    it('returns null for nonexistent layer', () => {
      const result = manager.createAnimation('nonexistent', 1000, []);
      expect(result).toBeNull();
    });

    it('stores multiple animations per layer', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValueOnce({ id: 'anim-1' });
      mockCreateAnim.mockReturnValueOnce({ id: 'anim-2' });

      manager.createAnimation(layer1.id, 1000, []);
      manager.createAnimation(layer1.id, 2000, []);

      expect(manager.getAnimations(layer1.id)).toHaveLength(2);
    });
  });

  describe('getAnimations()', () => {
    it('returns empty array for layer with no animations', () => {
      manager.addLayer(layer1);
      expect(manager.getAnimations(layer1.id)).toEqual([]);
    });

    it('returns empty array for nonexistent layer', () => {
      expect(manager.getAnimations('nonexistent')).toEqual([]);
    });
  });

  describe('removeAnimation()', () => {
    it('removes an animation by ID', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      manager.createAnimation(layer1.id, 1000, []);

      const result = manager.removeAnimation('anim-1');
      expect(result).toBe(true);
      expect(manager.getAnimations(layer1.id)).toHaveLength(0);
    });

    it('returns false for nonexistent animation ID', () => {
      expect(manager.removeAnimation('nonexistent')).toBe(false);
    });

    it('cleans up empty animation map entry', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      manager.createAnimation(layer1.id, 1000, []);

      manager.removeAnimation('anim-1');
      expect(manager.getAnimations(layer1.id)).toEqual([]);
    });
  });

  describe('playAnimation()', () => {
    it('plays an existing animation', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      manager.createAnimation(layer1.id, 1000, []);

      const result = manager.playAnimation('anim-1');
      expect(result).toBe(true);
      expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it('returns false for nonexistent animation', () => {
      expect(manager.playAnimation('nonexistent')).toBe(false);
    });
  });

  describe('pauseAnimation()', () => {
    it('pauses an existing animation', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      manager.createAnimation(layer1.id, 1000, []);

      const result = manager.pauseAnimation('anim-1');
      expect(result).toBe(true);
      expect(mockPause).toHaveBeenCalledTimes(1);
    });

    it('returns false for nonexistent animation', () => {
      expect(manager.pauseAnimation('nonexistent')).toBe(false);
    });
  });

  describe('stopAnimation()', () => {
    it('stops an existing animation', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      manager.createAnimation(layer1.id, 1000, []);

      const result = manager.stopAnimation('anim-1');
      expect(result).toBe(true);
      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('returns false for nonexistent animation', () => {
      expect(manager.stopAnimation('nonexistent')).toBe(false);
    });
  });

  describe('generateAnimationCSS()', () => {
    it('generates CSS for an existing animation', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      mockGenCSS.mockReturnValue('@keyframes liminal-anim-1 { ... }');
      manager.createAnimation(layer1.id, 1000, []);

      const css = manager.generateAnimationCSS('anim-1');
      expect(css).toBe('@keyframes liminal-anim-1 { ... }');
    });

    it('returns null for nonexistent animation', () => {
      expect(manager.generateAnimationCSS('nonexistent')).toBeNull();
    });
  });

  describe('generateAnimationJS()', () => {
    it('generates JS for an existing animation', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      mockGenJS.mockReturnValue('// Liminal Animation: anim-1');
      manager.createAnimation(layer1.id, 1000, []);

      const js = manager.generateAnimationJS('anim-1');
      expect(js).toBe('// Liminal Animation: anim-1');
    });

    it('returns null for nonexistent animation', () => {
      expect(manager.generateAnimationJS('nonexistent')).toBeNull();
    });
  });

  describe('interpolateAnimation()', () => {
    it('interpolates at a given time position', () => {
      manager.addLayer(layer1);
      mockCreateAnim.mockReturnValue({ id: 'anim-1' });
      mockInterp.mockReturnValue({ opacity: 0.5 });
      manager.createAnimation(layer1.id, 1000, []);

      const result = manager.interpolateAnimation('anim-1', 0.5);
      expect(result).toEqual({ opacity: 0.5 });
      expect(mockInterp).toHaveBeenCalledWith(expect.anything(), 0.5);
    });

    it('returns null for nonexistent animation', () => {
      expect(manager.interpolateAnimation('nonexistent', 0.5)).toBeNull();
    });
  });
});
