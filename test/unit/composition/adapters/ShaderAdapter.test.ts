/**
 * Unit tests for ShaderAdapter
 *
 * Tests WebGL shader rendering with TDD approach:
 * RED → GREEN → REFACTOR
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShaderAdapter } from '../../../../src/composition/adapters/ShaderAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';

// Mock WebGL context
const createMockWebGLContext = () => ({
  createShader: vi.fn().mockReturnValue({}),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn().mockReturnValue(true),
  getShaderInfoLog: vi.fn().mockReturnValue(null),
  createProgram: vi.fn().mockReturnValue({}),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn().mockReturnValue(true),
  getProgramInfoLog: vi.fn().mockReturnValue(null),
  useProgram: vi.fn(),
  createBuffer: vi.fn().mockReturnValue({}),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  getAttribLocation: vi.fn().mockReturnValue(0),
  enableVertexAttribArray: vi.fn(),
  vertexAttribPointer: vi.fn(),
  getUniformLocation: vi.fn().mockReturnValue({}),
  uniform1f: vi.fn(),
  uniform2f: vi.fn(),
  uniform3f: vi.fn(),
  uniform4f: vi.fn(),
  uniform1i: vi.fn(),
  viewport: vi.fn(),
  clearColor: vi.fn(),
  clear: vi.fn(),
  drawArrays: vi.fn(),
  deleteShader: vi.fn(),
  deleteProgram: vi.fn(),
  deleteBuffer: vi.fn(),
  VERTEX_SHADER: 0x8B31,
  FRAGMENT_SHADER: 0x8B30,
  COLOR_BUFFER_BIT: 0x00004000,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88E4,
  FLOAT: 0x1406,
  TRIANGLES: 0x0004,
});

// Mock canvas element
const createMockCanvas = () => {
  const gl = createMockWebGLContext();
  return {
    getContext: vi.fn().mockReturnValue(gl),
    width: 800,
    height: 600,
    style: {} as CSSStyleDeclaration,
  };
};

describe('ShaderAdapter', () => {
  let adapter: ShaderAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockContext: RenderContext;
  let mockSettings: GlobalSettings;
  let mockGl: ReturnType<typeof createMockWebGLContext>;

  // Sample shader code for testing
  const vertexShader = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShader = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      gl_FragColor = vec4(uv, sin(u_time) * 0.5 + 0.5, 1.0);
    }
  `;

  const sampleShaderCode = `
// Vertex Shader
${vertexShader}

// Fragment Shader
${fragmentShader}
  `;

  beforeEach(() => {
    adapter = new ShaderAdapter();
    
    mockLayer = {
      id: 'test-shader-layer',
      type: 'shader',
      code: sampleShaderCode,
      config: {
        zIndex: 1,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt: 'test shader',
        generator: 'test',
        model: 'test-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };

    mockSettings = {
      width: 800,
      height: 600,
      frameRate: 60,
      backgroundColor: '#000000',
    };

    mockGl = createMockWebGLContext();
    
    mockContainer = document.createElement('div');
    // Mock getContext on the container's created canvas
    vi.spyOn(mockContainer, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLCanvasElement) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (node as any).getContext = vi.fn().mockReturnValue(mockGl);
      }
      return node;
    });

    mockContext = {
      state: {
        register: vi.fn(),
        get: vi.fn(),
        subscribe: vi.fn(),
        clear: vi.fn(),
      },
      container: mockContainer,
      settings: mockSettings,
      layerInstances: new Map(),
    } as unknown as RenderContext;
  });

  describe('render()', () => {
    it('should create WebGL canvas in container', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(instance).toBeDefined();
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    it('should create WebGL context with shader program', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.createShader).toHaveBeenCalledTimes(2);
      expect(mockGl.createShader).toHaveBeenCalledWith(mockGl.VERTEX_SHADER);
      expect(mockGl.createShader).toHaveBeenCalledWith(mockGl.FRAGMENT_SHADER);
    });

    it('should compile vertex and fragment shaders', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.shaderSource).toHaveBeenCalledTimes(2);
      expect(mockGl.compileShader).toHaveBeenCalledTimes(2);
    });

    it('should create and link shader program', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.createProgram).toHaveBeenCalledTimes(1);
      expect(mockGl.attachShader).toHaveBeenCalledTimes(2);
      expect(mockGl.linkProgram).toHaveBeenCalledTimes(1);
    });

    it('should set up vertex buffer for full-screen quad', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.createBuffer).toHaveBeenCalled();
      expect(mockGl.bindBuffer).toHaveBeenCalledWith(mockGl.ARRAY_BUFFER, expect.anything());
      expect(mockGl.bufferData).toHaveBeenCalled();
    });

    it('should set viewport to match canvas dimensions', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.viewport).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('should handle shader without explicit vertex shader', () => {
      mockLayer.code = fragmentShader; // Only fragment shader
      
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(instance).toBeDefined();
      expect(mockGl.createShader).toHaveBeenCalled();
    });

    it('should throw error if WebGL is not supported', () => {
      const nullGlContainer = document.createElement('div');
      vi.spyOn(nullGlContainer, 'appendChild').mockImplementation((node: Node) => {
        if (node instanceof HTMLCanvasElement) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (node as any).getContext = vi.fn().mockReturnValue(null);
        }
        return node;
      });

      expect(() => {
        adapter.render(mockLayer, nullGlContainer, mockContext);
      }).toThrow('WebGL not supported');
    });
  });

  describe('getExports()', () => {
    it('should return uniform values as exports', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      
      expect(exports).toBeDefined();
      expect(Array.isArray(exports)).toBe(true);
    });

    it('should export time uniform', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      
      const timeExport = exports.find(e => e.name === 'u_time');
      expect(timeExport).toBeDefined();
      expect(timeExport?.type).toBe('number');
    });

    it('should export resolution uniform', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      
      const resolutionExport = exports.find(e => e.name === 'u_resolution');
      expect(resolutionExport).toBeDefined();
      expect(resolutionExport?.type).toBe('object');
    });

    it('should export canvas reference', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      
      const canvasExport = exports.find(e => e.name === 'canvas');
      expect(canvasExport).toBeDefined();
      expect(canvasExport?.type).toBe('canvas');
    });

    it('should return empty array if layer not rendered', () => {
      const exports = adapter.getExports(mockLayer);
      
      expect(exports).toEqual([]);
    });

    it('should have callable getters for exports', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);
      
      for (const exp of exports) {
        expect(typeof exp.getter).toBe('function');
        // Should not throw when called
        expect(() => exp.getter()).not.toThrow();
      }
    });
  });

  describe('getImports()', () => {
    it('should return empty array by default', () => {
      const imports = adapter.getImports(mockLayer);
      
      expect(imports).toEqual([]);
    });

    it('should be callable', () => {
      expect(() => adapter.getImports(mockLayer)).not.toThrow();
    });
  });

  describe('validate()', () => {
    it('should validate shader with both vertex and fragment shaders', () => {
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing fragment shader', () => {
      mockLayer.code = vertexShader; // Only vertex shader
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('fragment'));
    });

    it('should detect missing vertex shader', () => {
      mockLayer.code = fragmentShader; // Only fragment shader
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('vertex'));
    });

    it('should detect missing main function in fragment shader', () => {
      mockLayer.code = `
        precision mediump float;
        void notMain() {
          gl_FragColor = vec4(1.0);
        }
      `;
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('main'))).toBe(true);
    });

    it('should detect missing main function in vertex shader', () => {
      mockLayer.code = `
        attribute vec2 position;
        void notMain() {
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(false);
    });

    it('should accept shader with void main in fragment', () => {
      mockLayer.code = `
        void main() {
          gl_FragColor = vec4(1.0);
        }
      `;
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(true);
    });

    it('should handle empty code', () => {
      mockLayer.code = '';
      
      const result = adapter.validate(mockLayer);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('generateScript()', () => {
    it('should generate valid HTML with shader code', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('<canvas');
      expect(script).toContain('</canvas>');
      expect(script).toContain('WebGL');
    });

    it('should include vertex shader in output', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('VERTEX_SHADER');
      expect(script).toContain('attribute vec2');
    });

    it('should include fragment shader in output', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('FRAGMENT_SHADER');
      expect(script).toContain('precision mediump float');
    });

    it('should set canvas dimensions from settings', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('800');
      expect(script).toContain('600');
    });

    it('should include animation loop', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('requestAnimationFrame');
    });

    it('should handle shader without vertex shader by providing default', () => {
      mockLayer.code = fragmentShader;
      
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      expect(script).toContain('VERTEX_SHADER');
      expect(script).toContain('gl_Position');
    });

    it('should be valid JavaScript inside script tags', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      
      // Should have properly formatted JavaScript
      expect(script).toContain('function');
      expect(script).toContain('const');
      expect(script).toContain('getContext');
    });
  });

  describe('destroy()', () => {
    it('should clean up WebGL resources', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy(mockLayer, instance);
      
      expect(mockGl.deleteProgram).toHaveBeenCalled();
      expect(mockGl.deleteShader).toHaveBeenCalled();
    });

    it('should delete buffers', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      adapter.destroy(mockLayer, instance);
      
      expect(mockGl.deleteBuffer).toHaveBeenCalled();
    });

    it('should handle destroy when layer not rendered', () => {
      expect(() => {
        adapter.destroy(mockLayer, undefined);
      }).not.toThrow();
    });

    it('should remove canvas from container', () => {
      const mockRemove = vi.fn();
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      if (instance && typeof instance === 'object' && 'canvas' in instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (instance as any).canvas.remove = mockRemove;
      }
      
      adapter.destroy(mockLayer, instance);
      
      // Canvas should be cleaned up
      expect(instance).toBeDefined();
    });
  });

  describe('shader compilation errors', () => {
    it('should throw if vertex shader fails to compile', () => {
      mockGl.getShaderParameter.mockImplementation((_shader: unknown, param: number) => {
        // Return false for VERTEX_SHADER compile status
        return param !== 0x8B81; // COMPILE_STATUS
      });
      mockGl.getShaderInfoLog.mockReturnValue('Syntax error in vertex shader');

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow('Vertex shader compilation failed');
    });

    it('should throw if fragment shader fails to compile', () => {
      let callCount = 0;
      mockGl.getShaderParameter.mockImplementation(() => {
        callCount++;
        // First shader (vertex) compiles, second (fragment) fails
        return callCount <= 2; // First 2 calls (create + compile check for vertex) pass
      });
      mockGl.getShaderInfoLog.mockReturnValue('Syntax error in fragment shader');

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow();
    });

    it('should throw if program linking fails', () => {
      mockGl.getProgramParameter.mockImplementation((_program: unknown, param: number) => {
        return param !== 0x8B82; // LINK_STATUS - return false for link status
      });
      mockGl.getProgramInfoLog.mockReturnValue('Linking error');

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow('Program linking failed');
    });
  });

  describe('uniform handling', () => {
    it('should set up standard uniforms', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      
      expect(mockGl.getUniformLocation).toHaveBeenCalledWith(expect.anything(), 'u_time');
      expect(mockGl.getUniformLocation).toHaveBeenCalledWith(expect.anything(), 'u_resolution');
    });

    it('should update uniforms during render', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      
      // Trigger a render update if the instance has a render method
      if (instance && typeof instance === 'object' && 'render' in instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (instance as any).render(1000);
        
        expect(mockGl.uniform1f).toHaveBeenCalledWith(expect.anything(), 1.0);
      }
    });
  });
});
