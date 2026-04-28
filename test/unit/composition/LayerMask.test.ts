/**
 * LayerMask tests - TDD for layer masking system
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerMaskManager, LayerMaskGroup } from '../../../src/composition/LayerMask.js';
import type { LayerMask, MaskMode } from '../../../src/composition/types.js';

describe('LayerMaskManager', () => {
  let manager: LayerMaskManager;

  beforeEach(() => {
    manager = new LayerMaskManager();
  });

  describe('createMask', () => {
    it('should create a mask with default mode (alpha)', () => {
      const mask = manager.createMask('layer-1', 'layer-2');

      expect(mask?.id).toMatch(/^mask_/);
      expect(mask.sourceLayerId).toBe('layer-1');
      expect(mask.targetLayerId).toBe('layer-2');
      expect(mask.mode).toBe('alpha');
      expect(mask.invert).toBe(false);
      expect(mask.feather).toBe(0);
    });

    it('should create a mask with specified mode', () => {
      const mask = manager.createMask('layer-1', 'layer-2', 'luminance');

      expect(mask.mode).toBe('luminance');
    });

    it('should create a mask with inverse-alpha mode', () => {
      const mask = manager.createMask('layer-1', 'layer-2', 'inverse-alpha');

      expect(mask.mode).toBe('inverse-alpha');
    });

    it('should create unique IDs for multiple masks', () => {
      const mask1 = manager.createMask('layer-1', 'layer-2');
      const mask2 = manager.createMask('layer-1', 'layer-3');

      expect(mask1.id).not.toBe(mask2.id);
    });
  });

  describe('removeMask', () => {
    it('should remove an existing mask', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      
      const result = manager.removeMask(mask.id);

      expect(result).toBe(true);
      expect(manager.getMasksForLayer('layer-2')).toHaveLength(0);
    });

    it('should return false for non-existent mask', () => {
      const result = manager.removeMask('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('updateMask', () => {
    it('should update mask mode', () => {
      const mask = manager.createMask('layer-1', 'layer-2', 'alpha');
      
      const result = manager.updateMask(mask.id, { mode: 'luminance' });

      expect(result).toBe(true);
      const updated = manager.getMasksForLayer('layer-2')[0];
      expect(updated.mode).toBe('luminance');
    });

    it('should update mask invert flag', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      
      const result = manager.updateMask(mask.id, { invert: true });

      expect(result).toBe(true);
      const updated = manager.getMasksForLayer('layer-2')[0];
      expect(updated.invert).toBe(true);
    });

    it('should update mask feather value', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      
      const result = manager.updateMask(mask.id, { feather: 5 });

      expect(result).toBe(true);
      const updated = manager.getMasksForLayer('layer-2')[0];
      expect(updated.feather).toBe(5);
    });

    it('should return false for non-existent mask', () => {
      const result = manager.updateMask('non-existent-id', { mode: 'luminance' });

      expect(result).toBe(false);
    });

    it('should not modify id during update', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      const originalId = mask.id;
      
      manager.updateMask(mask.id, { mode: 'luminance', feather: 10 });

      const updated = manager.getMasksForLayer('layer-2')[0];
      expect(updated.id).toBe(originalId);
    });
  });

  describe('getMasksForLayer', () => {
    it('should return empty array when no masks exist', () => {
      const masks = manager.getMasksForLayer('layer-1');

      expect(masks).toEqual([]);
    });

    it('should return masks targeting a specific layer', () => {
      manager.createMask('mask-source-1', 'layer-target');
      manager.createMask('mask-source-2', 'layer-target');
      manager.createMask('other-source', 'other-target');

      const masks = manager.getMasksForLayer('layer-target');

      expect(masks).toHaveLength(2);
      expect(masks.every(m => m.targetLayerId === 'layer-target')).toBe(true);
    });

    it('should return masks where layer is the source', () => {
      manager.createMask('layer-source', 'layer-target-1');
      manager.createMask('layer-source', 'layer-target-2');

      const masks = manager.getMasksForSourceLayer('layer-source');

      expect(masks).toHaveLength(2);
      expect(masks.every(m => m.sourceLayerId === 'layer-source')).toBe(true);
    });

    it('should return immutable copies of masks', () => {
      manager.createMask('layer-1', 'layer-2');
      const masks = manager.getMasksForLayer('layer-2');
      
      masks[0].mode = 'luminance' as MaskMode;

      const masksAgain = manager.getMasksForLayer('layer-2');
      expect(masksAgain[0].mode).toBe('alpha');
    });
  });

  describe('generateCSSMask', () => {
    it('should generate CSS mask with alpha mode', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 0,
      };

      const css = manager.generateCSSMask(mask);

      expect(css).toContain('mask-image');
      expect(css).toContain('mask-mode: alpha');
    });

    it('should generate CSS mask with luminance mode', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'luminance',
        invert: false,
        feather: 0,
      };

      const css = manager.generateCSSMask(mask);

      expect(css).toContain('mask-mode: luminance');
    });

    it('should include mask-composite for inverted mask', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: true,
        feather: 0,
      };

      const css = manager.generateCSSMask(mask);

      expect(css).toContain('mask-composite: exclude');
    });

    it('should include mask-composite for inverse-alpha mode', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'inverse-alpha',
        invert: false,
        feather: 0,
      };

      const css = manager.generateCSSMask(mask);

      expect(css).toContain('mask-composite: exclude');
    });

    it('should include feather blur in CSS', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 5,
      };

      const css = manager.generateCSSMask(mask);

      expect(css).toContain('blur(5px)');
    });
  });

  describe('generateCanvasMask', () => {
    it('should use destination-in for alpha masking', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 0,
      };

      const compositeSpy = vi.fn();
      const ctx = {
        globalCompositeOperation: 'source-over',
        drawImage: vi.fn(),
        filter: 'none',
      } as unknown as CanvasRenderingContext2D;
      
      // Use Object.defineProperty to spy on the setter
      Object.defineProperty(ctx, 'globalCompositeOperation', {
        get: () => 'source-over',
        set: compositeSpy,
        configurable: true,
      });

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      expect(compositeSpy).toHaveBeenCalledWith('destination-in');
    });

    it('should use destination-out for inverse-alpha masking', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'inverse-alpha',
        invert: false,
        feather: 0,
      };

      const compositeSpy = vi.fn();
      const ctx = {
        drawImage: vi.fn(),
        filter: 'none',
      } as unknown as CanvasRenderingContext2D;
      
      Object.defineProperty(ctx, 'globalCompositeOperation', {
        get: () => 'source-over',
        set: compositeSpy,
        configurable: true,
      });

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      expect(compositeSpy).toHaveBeenCalledWith('destination-out');
    });

    it('should use destination-out for inverted alpha mask', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: true,
        feather: 0,
      };

      const compositeSpy = vi.fn();
      const ctx = {
        drawImage: vi.fn(),
        filter: 'none',
      } as unknown as CanvasRenderingContext2D;
      
      Object.defineProperty(ctx, 'globalCompositeOperation', {
        get: () => 'source-over',
        set: compositeSpy,
        configurable: true,
      });

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      expect(compositeSpy).toHaveBeenCalledWith('destination-out');
    });

    it('should apply filter for feather effect', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 10,
      };

      const filterSpy = vi.fn();
      const ctx = {
        globalCompositeOperation: 'source-over',
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      
      Object.defineProperty(ctx, 'filter', {
        get: () => 'none',
        set: filterSpy,
        configurable: true,
      });

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      expect(filterSpy).toHaveBeenCalledWith('blur(10px)');
    });

    it('should restore previous context state after masking', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 5,
      };

      const compositeSpy = vi.fn();
      const filterSpy = vi.fn();
      
      const ctx = {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      
      Object.defineProperty(ctx, 'globalCompositeOperation', {
        get: () => 'source-over',
        set: compositeSpy,
        configurable: true,
      });
      
      Object.defineProperty(ctx, 'filter', {
        get: () => 'none',
        set: filterSpy,
        configurable: true,
      });

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      // Last call should be restoring the original value
      const calls = compositeSpy.mock.calls;
      expect(calls[calls.length - 1]).toEqual(['source-over']);
      
      const filterCalls = filterSpy.mock.calls;
      expect(filterCalls[filterCalls.length - 1]).toEqual(['none']);
    });

    it('should draw the mask source canvas', () => {
      const mask: LayerMask = {
        id: 'test-mask',
        sourceLayerId: 'layer-1',
        targetLayerId: 'layer-2',
        mode: 'alpha',
        invert: false,
        feather: 0,
      };

      const drawImageMock = vi.fn();
      const ctx = {
        globalCompositeOperation: 'source-over',
        drawImage: drawImageMock,
        filter: 'none',
      } as unknown as CanvasRenderingContext2D;

      const mockCanvas = {
        width: 100,
        height: 100,
      } as HTMLCanvasElement;
      
      manager.generateCanvasMask(mask, ctx, mockCanvas);

      expect(drawImageMock).toHaveBeenCalledWith(mockCanvas, 0, 0);
    });
  });

  describe('applyMask', () => {
    it('should apply mask styles to container element', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      const container = document.createElement('div');
      const sourceCanvas = document.createElement('canvas');

      manager.applyMask(container, mask, sourceCanvas);

      expect(container.style.maskImage).toBeTruthy();
      expect(container.style.webkitMaskImage).toBeTruthy();
    });

    it('should handle missing canvas gracefully', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      const container = document.createElement('div');

      // Should not throw even without canvas
      expect(() => {
        manager.applyMask(container, mask, null as unknown as HTMLCanvasElement);
      }).not.toThrow();
    });

    it('should set mask mode in CSS', () => {
      const mask = manager.createMask('layer-1', 'layer-2', 'luminance');
      const container = document.createElement('div');
      const sourceCanvas = document.createElement('canvas');

      manager.applyMask(container, mask, sourceCanvas);

      expect(container.style.maskMode).toBe('luminance');
      expect(container.style.webkitMaskMode).toBe('luminance');
    });
  });

  describe('getAllMasks', () => {
    it('should return all registered masks', () => {
      manager.createMask('layer-1', 'layer-2');
      manager.createMask('layer-3', 'layer-4');

      const allMasks = manager.getAllMasks();

      expect(allMasks).toHaveLength(2);
    });

    it('should return empty array when no masks', () => {
      const allMasks = manager.getAllMasks();

      expect(allMasks).toEqual([]);
    });
  });

  describe('clearMasks', () => {
    it('should remove all masks', () => {
      manager.createMask('layer-1', 'layer-2');
      manager.createMask('layer-3', 'layer-4');

      manager.clearMasks();

      expect(manager.getAllMasks()).toHaveLength(0);
    });
  });

  describe('hasMask', () => {
    it('should return true for existing mask', () => {
      const mask = manager.createMask('layer-1', 'layer-2');

      expect(manager.hasMask(mask.id)).toBe(true);
    });

    it('should return false for non-existent mask', () => {
      expect(manager.hasMask('non-existent')).toBe(false);
    });
  });

  describe('getMask', () => {
    it('should return a copy of the mask', () => {
      const mask = manager.createMask('layer-1', 'layer-2');
      const retrieved = manager.getMask(mask.id);

      expect(retrieved).toEqual(mask);
      expect(retrieved).not.toBe(mask); // Should be a different object
    });

    it('should return undefined for non-existent mask', () => {
      expect(manager.getMask('non-existent')).toBeUndefined();
    });
  });
});

describe('LayerMask Types', () => {
  it('should support all mask modes', () => {
    const modes: MaskMode[] = ['alpha', 'luminance', 'inverse-alpha'];
    
    modes.forEach(mode => {
      const mask: LayerMask = {
        id: 'test',
        sourceLayerId: 'source',
        targetLayerId: 'target',
        mode,
        invert: false,
        feather: 0,
      };
      expect(mask.mode).toBe(mode);
    });
  });

  it('should have correct LayerMask structure', () => {
    const mask: LayerMask = {
      id: 'mask-123',
      sourceLayerId: 'layer-a',
      targetLayerId: 'layer-b',
      mode: 'alpha',
      invert: true,
      feather: 3,
    };

    expect(mask).toHaveProperty('id');
    expect(mask).toHaveProperty('sourceLayerId');
    expect(mask).toHaveProperty('targetLayerId');
    expect(mask).toHaveProperty('mode');
    expect(mask).toHaveProperty('invert');
    expect(mask).toHaveProperty('feather');
  });
});

describe('LayerMaskGroup', () => {
  it('should mask multiple layers with single source', () => {
    const groupManager = new LayerMaskManager();
    const group = new LayerMaskGroup(groupManager);

    const maskIds = group.maskMultipleLayers('source-layer', ['target-1', 'target-2', 'target-3']);

    expect(maskIds).toHaveLength(3);
    maskIds.forEach(id => {
      expect(groupManager.hasMask(id)).toBe(true);
    });
  });

  it('should clear all masks in group', () => {
    const groupManager = new LayerMaskManager();
    const group = new LayerMaskGroup(groupManager);

    group.maskMultipleLayers('source', ['target-1', 'target-2']);
    group.clear();

    expect(groupManager.getAllMasks()).toHaveLength(0);
  });

  it('should update all masks in group', () => {
    const groupManager = new LayerMaskManager();
    const group = new LayerMaskGroup(groupManager);

    const maskIds = group.maskMultipleLayers('source', ['target-1', 'target-2'], 'alpha');
    group.updateAll({ mode: 'luminance', feather: 5 });

    maskIds.forEach(id => {
      const mask = groupManager.getMask(id);
      expect(mask?.mode).toBe('luminance');
      expect(mask?.feather).toBe(5);
    });
  });
});
