/**
 * Unit tests for ShaderAdapter
 *
 * Tests WebGL shader rendering with TDD approach:
 * RED → GREEN → REFACTOR
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ShaderAdapter } from '../../../../src/composition/adapters/ShaderAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';
import type { RenderContext } from '../../../../src/composition/CompositionEngine.js';

// Mock WebGL context
const createMockWebGLContext = () => {
  const mockShader = { __type: 'shader' };
  const mockProgram = { __type: 'program' };
  const mockBuffer = { __type: 'buffer' };
  const mockUniformLocation = { __type: 'uniform' };

  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COLOR_BUFFER_BIT: 0x00004000,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,

    createShader: vi.fn().mockReturnValue(mockShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(true),
    getShaderInfoLog: vi.fn().mockReturnValue(null),
    createProgram: vi.fn().mockReturnValue(mockProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn().mockReturnValue(true),
    getProgramInfoLog: vi.fn().mockReturnValue(null),
    useProgram: vi.fn(),
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn().mockReturnValue(0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn().mockReturnValue(mockUniformLocation),
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
  };
};

describe('ShaderAdapter', () => {
  let adapter: ShaderAdapter;
  let mockLayer: Layer;
  let mockContainer: HTMLElement;
  let mockContext: RenderContext;
  let mockSettings: GlobalSettings;
  let mockGl: ReturnType<typeof createMockWebGLContext>;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  // Sample shader code for testing
  const vertexShader = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
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

  const sampleShaderCode = `// Vertex Shader
${vertexShader}

// Fragment Shader
${fragmentShader}`;

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

    // Mock canvas getContext
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(function(this: HTMLCanvasElement, contextId: string) {
      if (contextId === 'webgl' || contextId === 'experimental-webgl') {
        return mockGl as unknown as WebGLRenderingContext;
      }
      return originalGetContext.call(this, contextId);
    });

    mockContainer = document.createElement('div');

    mockContext = {
      settings: mockSettings,
      state: new Map(),
    } as unknown as RenderContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  describe('render()', () => {
    it('should create WebGL canvas in container', () => {
      const instance = adapter.render(mockLayer, mockContainer, mockContext);

      expect(instance).not.toBeNull();
      expect(mockContainer.querySelector('canvas')).toBeTruthy();
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

    it('should handle shader without explicit vertex shader', () => {
      mockLayer.code = fragmentShader; // Only fragment shader

      const instance = adapter.render(mockLayer, mockContainer, mockContext);

      expect(instance).not.toBeNull();
      expect(mockGl.createShader).toHaveBeenCalled();
    });

    it('should throw error if WebGL is not supported', () => {
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow('WebGL not supported');
    });
  });

  describe('getExports()', () => {
    it('should return uniform values as exports', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      expect(Array.isArray(exports)).toBe(true);
      expect(exports?.length).toBeGreaterThan(0);
    });

    it('should export time uniform', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const timeExport = exports.find(e => e.name === 'u_time');

      expect(timeExport?.type).toBe('number');
    });

    it('should export resolution uniform', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const resolutionExport = exports.find(e => e.name === 'u_resolution');

      expect(resolutionExport?.type).toBe('object');
    });

    it('should export canvas reference', () => {
      adapter.render(mockLayer, mockContainer, mockContext);
      const exports = adapter.getExports(mockLayer);

      const canvasExport = exports.find(e => e.name === 'canvas');

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
      expect(result.errors).not.toBeNull();
      expect(result.errors?.some(e => e.toLowerCase().includes('fragment'))).toBe(true);
    });

    it('should detect missing vertex shader', () => {
      mockLayer.code = fragmentShader; // Only fragment shader

      const result = adapter.validate(mockLayer);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors?.some(e => e.toLowerCase().includes('vertex'))).toBe(true);
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
    });

    it('should detect missing vertex shader in fragment-only code', () => {
      mockLayer.code = `
        precision mediump float;
        void main() {
          gl_FragColor = vec4(1.0);
        }
      `;

      const result = adapter.validate(mockLayer);

      // Fragment-only code fails validation (no vertex indicators)
      // But render() will still work with default vertex shader
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('vertex'))).toBe(true);
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
      adapter.render(mockLayer, mockContainer, mockContext);

      adapter.destroy(mockLayer, undefined);

      expect(mockContainer.querySelector('canvas')).toBeFalsy();
    });
  });

  describe('shader compilation errors', () => {
    it('should throw if vertex shader fails to compile', () => {
      mockGl.getShaderParameter.mockImplementation((_shader: unknown, param: number) => {
        // Return false for COMPILE_STATUS
        return param !== mockGl.COMPILE_STATUS;
      });
      mockGl.getShaderInfoLog.mockReturnValue('Syntax error in vertex shader');

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow('Vertex shader compilation failed');
    });

    it('should throw if fragment shader fails to compile', () => {
      // Mock implementation: fail for fragment shader (second shader created)
      let createShaderCallCount = 0;
      mockGl.createShader.mockImplementation((type: number) => {
        createShaderCallCount++;
        return { __type: 'shader', shaderType: type, id: createShaderCallCount };
      });

      // Fail compilation for fragment shader (type 0x8b30 = FRAGMENT_SHADER)
      mockGl.getShaderParameter.mockImplementation((shader: unknown, param: number) => {
        if (param === mockGl.COMPILE_STATUS) {
          // Access shader type via the mock object we created
          const s = shader as { shaderType: number; id: number };
          // Fail the second shader (fragment)
          return s.id !== 2;
        }
        return true;
      });
      mockGl.getShaderInfoLog.mockReturnValue('Syntax error in fragment shader');

      expect(() => {
        adapter.render(mockLayer, mockContainer, mockContext);
      }).toThrow('Fragment shader compilation failed');
    });

    it('should throw if program linking fails', () => {
      mockGl.getProgramParameter.mockImplementation((_program: unknown, param: number) => {
        // Return false for LINK_STATUS
        return param !== mockGl.LINK_STATUS;
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
  });

  describe('shader parsing edge cases', () => {
    it('should handle shader with explicit section markers', () => {
      mockLayer.code = `// Vertex Shader
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
// Fragment Shader
precision mediump float;
void main() {
  gl_FragColor = vec4(1.0);
}`;

      const result = adapter.validate(mockLayer);
      expect(result.valid).toBe(true);
    });

    it('should handle shader with vertex-only code', () => {
      mockLayer.code = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      const result = adapter.validate(mockLayer);
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('fragment'))).toBe(true);
    });

    it('should handle code with both gl_Position and gl_FragColor', () => {
      mockLayer.code = `
        attribute vec2 a_position;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
        precision mediump float;
        void main() {
          gl_FragColor = vec4(1.0);
        }
      `;

      const result = adapter.validate(mockLayer);
      expect(result.valid).toBe(true);
    });

    it('should handle vertex shader before fragment in code', () => {
      mockLayer.code = vertexShader + '\n' + fragmentShader;

      const instance = adapter.render(mockLayer, mockContainer, mockContext);
      expect(instance).not.toBeNull();
    });
  });

  describe('generateScript variations', () => {
    it('should include layer id in canvas element', () => {
      const script = adapter.generateScript(mockLayer, mockSettings);
      expect(script).toContain(`shader-${mockLayer.id}`);
    });

    it('should handle different canvas sizes', () => {
      const smallSettings: GlobalSettings = {
        width: 400,
        height: 300,
        frameRate: 30,
        backgroundColor: '#ffffff',
      };

      const script = adapter.generateScript(mockLayer, smallSettings);
      expect(script).toContain('400');
      expect(script).toContain('300');
    });
  });
});
