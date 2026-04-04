/**
 * Tests for HydraAdapter
 * 
 * Following TDD: RED, GREEN, REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HydraAdapter } from '../../../../src/composition/adapters/HydraAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';
import { StateManager } from '../../../../src/composition/CompositionEngine.js';

// Mock Hydra synth for testing
class MockHydraSynth {
  canvas: HTMLCanvasElement;
  width = 800;
  height = 600;
  stopped = false;
  o0 = { src: vi.fn() };
  o1 = { src: vi.fn() };
  o2 = { src: vi.fn() };
  o3 = { src: vi.fn() };

  constructor(options: { canvas: HTMLCanvasElement; width?: number; height?: number }) {
    this.canvas = options.canvas;
    if (options.width) this.width = options.width;
    if (options.height) this.height = options.height;
  }

  stop() {
    this.stopped = true;
  }

  start() {
    this.stopped = false;
  }

  setResolution(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  src(_input: unknown) {
    return this;
  }
}

// Mock global Hydra
const mockHydraConstructor = vi.fn((options) => new MockHydraSynth(options));

describe('HydraAdapter', () => {
  let adapter: HydraAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockSettings: GlobalSettings;

  beforeEach(() => {
    // Reset adapter
    adapter = new HydraAdapter();

    // Setup mock layer
    mockLayer = {
      id: 'test-hydra-layer',
      type: 'hydra',
      code: 'osc(10, 0.1, 0.5).out()',
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'Test hydra layer',
        generator: 'HydraGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    // Setup mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'test-container';

    // Setup mock settings
    mockSettings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#000000',
    };

    // Setup mock window.Hydra
    (globalThis as unknown as { window: { Hydra: typeof mockHydraConstructor } }).window = {
      Hydra: mockHydraConstructor,
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should load Hydra module from window global', async () => {
      await adapter.initialize();

      // After initialization, render should work without throwing
      const container = document.createElement('div');
      expect(() => adapter.render(mockLayer, container)).not.toThrow('Hydra not loaded');
    });

    it('should not reload if already initialized', async () => {
      await adapter.initialize();
      const firstInit = adapter;
      
      await adapter.initialize();
      
      // Should be the same instance
      expect(adapter).toBe(firstInit);
    });
  });

  describe('render()', () => {
    it('should throw error if Hydra is not loaded', () => {
      // Create fresh adapter without initialization
      const freshAdapter = new HydraAdapter();
      
      expect(() => {
        freshAdapter.render(mockLayer, mockContainer);
      }).toThrow('Hydra not loaded. Call initialize() first.');
    });

    it('should create a canvas element in the container', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const canvas = mockContainer.querySelector('canvas');
      expect(canvas).toBeTruthy();
    });

    it('should create canvas with correct dimensions from settings', async () => {
      await adapter.initialize();
      
      const stateManager = new StateManager();
      const context: RenderContext = {
        state: stateManager,
        container: mockContainer,
        settings: mockSettings,
        layerInstances: new Map(),
      };

      adapter.render(mockLayer, mockContainer, context);

      const canvas = mockContainer.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('should use default dimensions when settings not provided', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const canvas = mockContainer.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('should initialize Hydra with correct options', async () => {
      await adapter.initialize();
      
      const context: RenderContext = {
        state: new StateManager(),
        container: mockContainer,
        settings: mockSettings,
        layerInstances: new Map(),
      };

      adapter.render(mockLayer, mockContainer, context);

      expect(mockHydraConstructor).toHaveBeenCalledWith({
        canvas: expect.any(HTMLCanvasElement),
        autoLoop: true,
        makeGlobal: true,
        width: 800,
        height: 600,
      });
    });

    it('should store instance for later retrieval', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer);

      // Instance should be returned
      expect(instance).toBeTruthy();
      expect(instance.canvas).toBeTruthy();
    });

    it('should execute user code in a function context', async () => {
      await adapter.initialize();
      
      const codeWithLog = 'console.log("test"); osc(10).out()';
      const layerWithLog = { ...mockLayer, code: codeWithLog };
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      adapter.render(layerWithLog, mockContainer);
      
      consoleSpy.mockRestore();
    });

    it('should handle errors in user code gracefully', async () => {
      await adapter.initialize();
      
      const layerWithError = { ...mockLayer, code: 'invalid syntax {{' };
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Should not throw, just log error
      expect(() => adapter.render(layerWithError, mockContainer)).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should set up imports from context if available', async () => {
      await adapter.initialize();
      
      const stateManager = new StateManager();
      const importProxy = { mouseX: 100 };
      stateManager.register(`__imports_${mockLayer.id}`, () => importProxy);
      
      const context: RenderContext = {
        state: stateManager,
        container: mockContainer,
        settings: mockSettings,
        layerInstances: new Map(),
      };

      // Should not throw when setting up imports
      expect(() => adapter.render(mockLayer, mockContainer, context)).not.toThrow();
    });
  });

  describe('getExports()', () => {
    it('should return empty array if layer not rendered', () => {
      const exports = adapter.getExports(mockLayer);
      expect(exports).toEqual([]);
    });

    it('should return canvas export', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const canvasExport = exports.find(e => e.name === 'canvas');
      
      expect(canvasExport).toBeTruthy();
      expect(canvasExport?.type).toBe('canvas');
      expect(canvasExport?.getter()).toBeTruthy();
    });

    it('should return width export', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const widthExport = exports.find(e => e.name === 'width');
      
      expect(widthExport).toBeTruthy();
      expect(widthExport?.type).toBe('number');
      expect(widthExport?.getter()).toBe(800);
    });

    it('should return height export', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      const heightExport = exports.find(e => e.name === 'height');
      
      expect(heightExport).toBeTruthy();
      expect(heightExport?.type).toBe('number');
      expect(heightExport?.getter()).toBe(600);
    });

    it('should return output references (o0, o1, o2, o3)', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      
      const o0Export = exports.find(e => e.name === 'o0');
      const o1Export = exports.find(e => e.name === 'o1');
      const o2Export = exports.find(e => e.name === 'o2');
      const o3Export = exports.find(e => e.name === 'o3');
      
      expect(o0Export).toBeTruthy();
      expect(o1Export).toBeTruthy();
      expect(o2Export).toBeTruthy();
      expect(o3Export).toBeTruthy();
      
      expect(o0Export?.type).toBe('object');
      expect(o1Export?.type).toBe('object');
      expect(o2Export?.type).toBe('object');
      expect(o3Export?.type).toBe('object');
    });

    it('should have descriptions for all exports', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);

      const exports = adapter.getExports(mockLayer);
      
      for (const exp of exports) {
        expect(exp.description).toBeTruthy();
        expect(exp.description?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getImports()', () => {
    it('should return imports array', () => {
      const imports = adapter.getImports();
      expect(Array.isArray(imports)).toBe(true);
    });

    it('should import canvas from p5 layers', () => {
      const imports = adapter.getImports();
      const p5Import = imports.find(i => i.from === 'p5' && i.name === 'canvas');
      
      expect(p5Import).toBeTruthy();
      expect(p5Import?.as).toBe('p5Canvas');
      expect(p5Import?.required).toBe(false);
    });

    it('should import canvas from three layers', () => {
      const imports = imports = adapter.getImports();
      const threeImport = imports.find(i => i.from === 'three' && i.name === 'canvas');
      
      expect(threeImport).toBeTruthy();
      expect(threeImport?.as).toBe('threeCanvas');
      expect(threeImport?.required).toBe(false);
    });
  });

  describe('validate()', () => {
    it('should validate valid Hydra code with osc()', () => {
      const layer = { ...mockLayer, code: 'osc(10, 0.1, 0.5).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate valid Hydra code with noise()', () => {
      const layer = { ...mockLayer, code: 'noise(3, 0.1).color(0.5, 0.8, 1).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate valid Hydra code with gradient()', () => {
      const layer = { ...mockLayer, code: 'gradient(0.5).color(1, 0, 0).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject empty code', () => {
      const layer = { ...mockLayer, code: '' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code without .out()', () => {
      const layer = { ...mockLayer, code: 'osc(10, 0.1, 0.5)' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code MUST end with .out() to render');
    });

    it('should reject code without source function', () => {
      const layer = { ...mockLayer, code: '.color(1, 0, 0).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hydra code should use a source function: osc(), src(), noise(), shape(), gradient(), solid(), voronoi()');
    });

    it('should reject code with invalid .sin() method', () => {
      const layer = { ...mockLayer, code: 'osc(10).sin(2).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('.sin('))).toBe(true);
    });

    it('should reject code with invalid .cos() method', () => {
      const layer = { ...mockLayer, code: 'osc(10).cos(2).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('.cos('))).toBe(true);
    });

    it('should reject code with invalid .tan() method', () => {
      const layer = { ...mockLayer, code: 'osc(10).tan(2).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('.tan('))).toBe(true);
    });

    it('should validate complex Hydra composition', () => {
      const code = `
osc(60, 0.1, 0.8)
  .rotate(0.5)
  .scale(1.5)
  .color(1, 0.2, 0.5)
  .modulate(noise(3))
  .out()
      `;
      const layer = { ...mockLayer, code };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra code with multiple outputs', () => {
      const code = `
osc(10).out(o0)
noise(5).out(o1)
render()
      `;
      const layer = { ...mockLayer, code };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra code with src() and initCam()', () => {
      const code = `
s0.initCam()
src(s0).modulate(osc(5, 0.1)).out()
      `;
      const layer = { ...mockLayer, code };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra code with voronoi()', () => {
      const layer = { ...mockLayer, code: 'voronoi(5, 0.3, 0.1).color(0.2, 0.8, 1).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra code with shape()', () => {
      const layer = { ...mockLayer, code: 'shape(3, 0.5, 0.01).color(1, 0.5, 0).repeat(3, 3).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra code with solid()', () => {
      const layer = { ...mockLayer, code: 'solid(1, 0, 0, 1).out()' };
      const result = adapter.validate(layer);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('generateScript()', () => {
    it('should generate HTML script', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('<script');
      expect(script).toContain('</script>');
    });

    it('should include Hydra CDN URL', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('https://unpkg.com/hydra-synth');
    });

    it('should create a layer container div', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain("className = 'layer'");
      expect(script).toContain("document.createElement('div')");
    });

    it('should set correct z-index from layer config', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('zIndex = 1');
    });

    it('should create a canvas element', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain("document.createElement('canvas')");
    });

    it('should initialize Hydra with correct options', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('new Hydra({');
      expect(script).toContain('autoLoop: true');
      expect(script).toContain('makeGlobal: true');
    });

    it('should include the layer code', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain(mockLayer.code);
    });

    it('should wrap code in IIFE', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('(function() {');
      expect(script).toContain('})();');
    });

    it('should append container to composition element', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain("document.getElementById('composition')");
    });
  });

  describe('destroy()', () => {
    it('should stop the Hydra instance', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer);
      
      adapter.destroy(mockLayer, instance);
      
      expect((instance as MockHydraSynth).stopped).toBe(true);
    });

    it('should remove canvas from DOM', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer);
      
      expect(mockContainer.querySelector('canvas')).toBeTruthy();
      
      adapter.destroy(mockLayer, instance);
      
      expect(mockContainer.querySelector('canvas')).toBeFalsy();
    });

    it('should handle destroying non-existent layer gracefully', () => {
      // Should not throw when destroying layer that was never rendered
      expect(() => adapter.destroy(mockLayer, null)).not.toThrow();
    });

    it('should remove instance from internal tracking', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer);
      
      // First verify instance is tracked
      expect(adapter.getExports(mockLayer).length).toBeGreaterThan(0);
      
      adapter.destroy(mockLayer, instance);
      
      // After destroy, exports should be empty
      expect(adapter.getExports(mockLayer)).toEqual([]);
    });
  });
});

// Singleton export test
describe('hydraAdapter singleton', () => {
  it('should be exported as singleton', async () => {
    const { hydraAdapter } = await import('../../../../src/composition/adapters/HydraAdapter.js');
    expect(hydraAdapter).toBeInstanceOf(HydraAdapter);
  });
});
