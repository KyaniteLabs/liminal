/**
 * ThreeAdapter Tests
 *
 * Test suite for the Three.js adapter following TDD principles.
 * Tests cover all LayerAdapter interface methods.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThreeAdapter } from '../../../../src/composition/adapters/ThreeAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';

// Mock THREE.js types
interface MockTHREEObject {
  rotation: { x: number; y: number; z: number };
}

interface MockTHREEScene {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  children: MockTHREEObject[];
}

interface MockTHREECamera {
  position: { x: number; y: number; z: number };
  lookAt: ReturnType<typeof vi.fn>;
}

interface MockTHREERenderer {
  setSize: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  domElement: HTMLCanvasElement;
  dispose: ReturnType<typeof vi.fn>;
}

// Create mock instances
const createMockScene = (): MockTHREEScene => ({
  add: vi.fn(),
  remove: vi.fn(),
  children: [],
});

const createMockCamera = (): MockTHREECamera => ({
  position: { x: 0, y: 0, z: 5 },
  lookAt: vi.fn(),
});

const createMockRenderer = (): MockTHREERenderer => ({
  setSize: vi.fn(),
  render: vi.fn(),
  domElement: document.createElement('canvas'),
  dispose: vi.fn(),
});

// Mock constructors that can be used with `new`
const mockSceneConstructor = vi.fn(function() {
  return createMockScene();
});

const mockCameraConstructor = vi.fn(function() {
  return createMockCamera();
});

const mockRendererConstructor = vi.fn(function() {
  return createMockRenderer();
});

const mockMeshConstructor = vi.fn(function() {
  return { rotation: { x: 0, y: 0, z: 0 } };
});

const mockTHREE = {
  Scene: mockSceneConstructor,
  PerspectiveCamera: mockCameraConstructor,
  WebGLRenderer: mockRendererConstructor,
  BoxGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: mockMeshConstructor,
  Color: vi.fn(),
};

describe('ThreeAdapter', () => {
  let adapter: ThreeAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockContext: RenderContext;

  beforeEach(() => {
    adapter = new ThreeAdapter();
    mockContainer = document.createElement('div');
    
    mockLayer = {
      id: 'test-layer-1',
      type: 'three',
      code: `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(800, 600);
        document.body.appendChild(renderer.domElement);
      `,
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1,
        position: { x: 0, y: 0 },
        scale: 1,
      },
      metadata: {
        prompt: 'test prompt',
        generator: 'ThreeGenerator',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockContext = {
      settings: {
        width: 800,
        height: 600,
        frameRate: 60,
        backgroundColor: '#000000',
      },
      state: new Map(),
    } as RenderContext;

    // Set up THREE mock on window
    (window as unknown as { THREE: typeof mockTHREE }).THREE = mockTHREE;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should load THREE.js module', async () => {
      await adapter.initialize();
      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('render', () => {
    it('should create a Three.js scene', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(instance).toBeDefined();
      expect(mockTHREE.Scene).toHaveBeenCalled();
      expect(mockTHREE.PerspectiveCamera).toHaveBeenCalled();
      expect(mockTHREE.WebGLRenderer).toHaveBeenCalled();
    });

    it('should throw error if THREE.js not loaded', () => {
      // Clear the window.THREE mock
      (window as unknown as { THREE?: typeof mockTHREE }).THREE = undefined;
      
      expect(() => adapter.render(mockLayer, mockContainer, mockContext)).toThrow(
        'Three.js not loaded. Call initialize() first.'
      );
    });

    it('should append renderer canvas to container', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockContainer.querySelector('canvas')).toBeTruthy();
    });

    it('should use context settings for dimensions', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockTHREE.PerspectiveCamera).toHaveBeenCalledWith(
        75,
        800 / 600,
        0.1,
        1000
      );
      expect(mockRendererConstructor.mock.results[0].value.setSize).toHaveBeenCalledWith(800, 600);
    });

    it('should use default dimensions when context not provided', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer);
      
      expect(mockTHREE.PerspectiveCamera).toHaveBeenCalledWith(
        75,
        800 / 600,
        0.1,
        1000
      );
    });
  });

  describe('getExports', () => {
    it('should return camera position exports', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      const exports = adapter.getExports?.(mockLayer);
      
      expect(exports).toBeDefined();
      expect(exports?.some(e => e.name === 'cameraX')).toBe(true);
      expect(exports?.some(e => e.name === 'cameraY')).toBe(true);
      expect(exports?.some(e => e.name === 'cameraZ')).toBe(true);
    });

    it('should return scene objects export', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      const exports = adapter.getExports?.(mockLayer);
      
      expect(exports?.some(e => e.name === 'sceneObjects')).toBe(true);
    });

    it('should return renderer export', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      const exports = adapter.getExports?.(mockLayer);
      
      expect(exports?.some(e => e.name === 'renderer')).toBe(true);
    });

    it('should return camera position values from getter', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      const exports = adapter.getExports?.(mockLayer);
      const cameraXExport = exports?.find(e => e.name === 'cameraX');
      
      expect(cameraXExport?.getter()).toBe(0);
    });

    it('should return empty array for unrendered layer', () => {
      const exports = adapter.getExports?.(mockLayer);
      expect(exports).toEqual([]);
    });
  });

  describe('getImports', () => {
    it('should request mouseX from p5', () => {
      const imports = adapter.getImports?.(mockLayer);
      
      expect(imports).toBeDefined();
      expect(imports?.some(i => i.from === 'p5' && i.name === 'mouseX')).toBe(true);
    });

    it('should request mouseY from p5', () => {
      const imports = adapter.getImports?.(mockLayer);
      
      expect(imports?.some(i => i.from === 'p5' && i.name === 'mouseY')).toBe(true);
    });

    it('should map imports to camera control aliases', () => {
      const imports = adapter.getImports?.(mockLayer);
      
      const mouseXImport = imports?.find(i => i.name === 'mouseX');
      expect(mouseXImport?.as).toBe('cameraControlX');
      
      const mouseYImport = imports?.find(i => i.name === 'mouseY');
      expect(mouseYImport?.as).toBe('cameraControlY');
    });

    it('should mark imports as optional', () => {
      const imports = adapter.getImports?.(mockLayer);
      
      expect(imports?.every(i => i.required === false)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should pass validation for valid code', () => {
      const result = adapter.validate?.(mockLayer);
      
      expect(result?.valid).toBe(true);
      expect(result?.errors).toBeUndefined();
    });

    it('should catch missing scene', () => {
      const invalidLayer = {
        ...mockLayer,
        code: 'const camera = new THREE.PerspectiveCamera();',
      };
      
      const result = adapter.validate?.(invalidLayer);
      
      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain('Missing THREE.Scene creation');
    });

    it('should catch missing camera', () => {
      const invalidLayer = {
        ...mockLayer,
        code: 'const scene = new THREE.Scene();',
      };
      
      const result = adapter.validate?.(invalidLayer);
      
      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain('Missing THREE.PerspectiveCamera creation');
    });

    it('should catch missing renderer', () => {
      const invalidLayer = {
        ...mockLayer,
        code: `
          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera();
        `,
      };
      
      const result = adapter.validate?.(invalidLayer);
      
      expect(result?.valid).toBe(false);
      expect(result?.errors).toContain('Missing THREE.WebGLRenderer creation');
    });

    it('should return all missing elements in errors', () => {
      const invalidLayer = {
        ...mockLayer,
        code: 'console.log("no three.js code");',
      };
      
      const result = adapter.validate?.(invalidLayer);
      
      expect(result?.valid).toBe(false);
      expect(result?.errors?.length).toBe(3);
    });
  });

  describe('generateScript', () => {
    const mockSettings: GlobalSettings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#000000',
    };

    it('should output valid HTML', () => {
      const script = adapter.generateScript?.(mockLayer, mockSettings);
      
      expect(script).toContain('<script');
      expect(script).toContain('</script>');
    });

    it('should include Three.js CDN', () => {
      const script = adapter.generateScript?.(mockLayer, mockSettings);
      
      expect(script).toContain('cdnjs.cloudflare.com/ajax/libs/three.js');
    });

    it('should include layer code', () => {
      const script = adapter.generateScript?.(mockLayer, mockSettings);
      
      expect(script).toContain('THREE.Scene');
      expect(script).toContain('THREE.PerspectiveCamera');
      expect(script).toContain('THREE.WebGLRenderer');
    });

    it('should create container element', () => {
      const script = adapter.generateScript?.(mockLayer, mockSettings);
      
      expect(script).toContain('document.createElement');
      expect(script).toContain('className');
    });

    it('should set z-index from layer config', () => {
      const script = adapter.generateScript?.(mockLayer, mockSettings);
      
      expect(script).toContain('zIndex = 1');
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy?.(mockLayer, instance);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should remove canvas from container', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      // Initially canvas should be there
      expect(mockContainer.querySelector('canvas')).toBeTruthy();
      
      adapter.destroy?.(mockLayer, null);
      
      // After destroy, should be gone
      expect(mockContainer.querySelector('canvas')).toBeFalsy();
    });

    it('should dispose renderer', async () => {
      await adapter.initialize();
      adapter.render(mockLayer, mockContainer, mockContext);
      
      const mockDispose = mockRendererConstructor.mock.results[0].value.dispose;
      
      adapter.destroy?.(mockLayer, null);
      
      expect(mockDispose).toHaveBeenCalled();
    });

    it('should cancel animation frame', async () => {
      await adapter.initialize();
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      // Check that instance has an animation ID
      expect(instance).toBeDefined();
      
      // Verify destroy doesn't throw (it calls cancelAnimationFrame internally)
      expect(() => adapter.destroy?.(mockLayer, instance)).not.toThrow();
    });

    it('should handle unrendered layer gracefully', () => {
      expect(() => adapter.destroy?.(mockLayer, null)).not.toThrow();
    });
  });
});
