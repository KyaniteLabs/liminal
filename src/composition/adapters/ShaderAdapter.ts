/**
 * ShaderAdapter - Adapter for GLSL shader layers.
 *
 * Renders WebGL shaders in a container and exposes uniform values
 * for cross-layer communication.
 */

import type { Layer, GlobalSettings } from '../types.js';
import type { LayerAdapter, Export, Import } from './index.js';
import type { RenderContext } from '../CompositionEngine.js';

/** WebGL shader instance data */
interface ShaderInstance {
  /** The canvas element */
  canvas: HTMLCanvasElement;
  /** WebGL rendering context */
  gl: WebGLRenderingContext;
  /** Compiled shader program */
  program: WebGLProgram;
  /** Vertex shader */
  vertexShader: WebGLShader;
  /** Fragment shader */
  fragmentShader: WebGLShader;
  /** Vertex buffer */
  positionBuffer: WebGLBuffer;
  /** Uniform locations */
  uniforms: Map<string, WebGLUniformLocation>;
  /** Start time for animation */
  startTime: number;
  /** Animation frame ID */
  animationId?: number;
  /** Current time uniform value */
  currentTime: number;
}

/** Default vertex shader for full-screen quad */
const DEFAULT_VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/** Default fragment shader if none provided */
const DEFAULT_FRAGMENT_SHADER = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.5, 1.0);
}
`;

export class ShaderAdapter implements LayerAdapter {
  private instances = new Map<string, ShaderInstance>();

  /**
   * Render a shader layer into a container.
   *
   * @param layer - The layer to render
   * @param container - Container element
   * @param context - Render context
   * @returns Shader instance
   */
  render(layer: Layer, container: HTMLElement, context?: RenderContext): ShaderInstance {
    // Get dimensions from context or use defaults
    const width = context?.settings.width || 800;
    const height = context?.settings.height || 600;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Get WebGL context
    const gl = canvas.getContext('webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    // Parse shaders from layer code
    const { vertexSource, fragmentSource } = this.parseShaders(layer.code);

    // Compile shaders
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    // Create and link program
    const program = this.createProgram(gl, vertexShader, fragmentShader);

    // Set up geometry (full-screen quad)
    const positionBuffer = this.createQuadBuffer(gl, program);

    // Get uniform locations
    const uniforms = this.getUniformLocations(gl, program);

    // Create instance
    const instance: ShaderInstance = {
      canvas,
      gl,
      program,
      vertexShader,
      fragmentShader,
      positionBuffer,
      uniforms,
      startTime: Date.now(),
      currentTime: 0,
    };

    // Store instance
    this.instances.set(layer.id, instance);

    // Start render loop
    this.startRenderLoop(instance);

    return instance;
  }

  /**
   * Parse vertex and fragment shaders from layer code.
   *
   * @param code - Layer code containing shaders
   * @returns Parsed shader sources
   */
  private parseShaders(code: string): { vertexSource: string; fragmentSource: string } {
    let vertexSource = '';
    let fragmentSource = '';

    // Look for vertex shader section
    const vertexMatch = code.match(/(?:\/\/\s*Vertex\s*Shader|attribute|void\s+main\s*\([^)]*\)\s*\{[\s\S]*?gl_Position)/i);
    const fragmentMatch = code.match(/(?:\/\/\s*Fragment\s*Shader|precision|gl_FragColor)/i);

    // Check if code has explicit section markers
    if (code.includes('// Vertex Shader') && code.includes('// Fragment Shader')) {
      const parts = code.split(/\/\/\s*Fragment\s*Shader/i);
      if (parts.length >= 2) {
        vertexSource = parts[0].replace(/\/\/\s*Vertex\s*Shader/i, '').trim();
        fragmentSource = '// Fragment Shader' + parts[1];
      }
    } else if (vertexMatch && !fragmentMatch) {
      // Only vertex shader found, use default fragment
      vertexSource = code;
      fragmentSource = DEFAULT_FRAGMENT_SHADER;
    } else if (!vertexMatch && fragmentMatch) {
      // Only fragment shader found, use default vertex
      vertexSource = DEFAULT_VERTEX_SHADER;
      fragmentSource = code;
    } else if (vertexMatch && fragmentMatch) {
      // Both found - try to split intelligently
      const vertexIndex = vertexMatch.index || 0;
      const fragmentIndex = fragmentMatch.index || code.length;

      if (vertexIndex < fragmentIndex) {
        vertexSource = code.substring(vertexIndex, fragmentIndex).trim();
        fragmentSource = code.substring(fragmentIndex).trim();
      } else {
        fragmentSource = code.substring(fragmentIndex, vertexIndex).trim();
        vertexSource = code.substring(vertexIndex).trim();
      }
    } else {
      // Neither found, use defaults
      vertexSource = DEFAULT_VERTEX_SHADER;
      fragmentSource = DEFAULT_FRAGMENT_SHADER;
    }

    // Ensure fragment shader has precision qualifier
    if (fragmentSource && !fragmentSource.includes('precision')) {
      fragmentSource = 'precision mediump float;\n' + fragmentSource;
    }

    return { vertexSource, fragmentSource };
  }

  /**
   * Compile a shader.
   *
   * @param gl - WebGL context
   * @param type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
   * @param source - Shader source code
   * @returns Compiled shader
   */
  private compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const infoLog = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      const typeName = type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment';
      throw new Error(`${typeName} shader compilation failed: ${infoLog}`);
    }

    return shader;
  }

  /**
   * Create and link shader program.
   *
   * @param gl - WebGL context
   * @param vertexShader - Compiled vertex shader
   * @param fragmentShader - Compiled fragment shader
   * @returns Linked program
   */
  private createProgram(
    gl: WebGLRenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader
  ): WebGLProgram {
    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const infoLog = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${infoLog}`);
    }

    return program;
  }

  /**
   * Create vertex buffer for full-screen quad.
   *
   * @param gl - WebGL context
   * @param program - Shader program
   * @returns Vertex buffer
   */
  private createQuadBuffer(gl: WebGLRenderingContext, program: WebGLProgram): WebGLBuffer {
    // Full-screen quad (2 triangles)
    const positions = new Float32Array([
      -1, -1, // Bottom-left
      1, -1, // Bottom-right
      -1, 1, // Top-left
      -1, 1, // Top-left
      1, -1, // Bottom-right
      1, 1, // Top-right
    ]);

    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('Failed to create buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Set up attribute
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    if (positionLocation >= 0) {
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    }

    return buffer;
  }

  /**
   * Get uniform locations from program.
   *
   * @param gl - WebGL context
   * @param program - Shader program
   * @returns Map of uniform names to locations
   */
  private getUniformLocations(gl: WebGLRenderingContext, program: WebGLProgram): Map<string, WebGLUniformLocation> {
    const uniforms = new Map<string, WebGLUniformLocation>();

    // Common uniforms
    const uniformNames = ['u_time', 'u_resolution', 'u_mouse'];
    for (const name of uniformNames) {
      const location = gl.getUniformLocation(program, name);
      if (location) {
        uniforms.set(name, location);
      }
    }

    return uniforms;
  }

  /**
   * Start the render loop for a shader instance.
   *
   * @param instance - Shader instance
   */
  private startRenderLoop(instance: ShaderInstance): void {
    const render = () => {
      const gl = instance.gl;
      const program = instance.program;

      // Calculate time in seconds
      const time = (Date.now() - instance.startTime) / 1000;
      instance.currentTime = time;

      // Set viewport
      gl.viewport(0, 0, instance.canvas.width, instance.canvas.height);

      // Clear
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Use program
      gl.useProgram(program);

      // Update uniforms
      const timeLocation = instance.uniforms.get('u_time');
      if (timeLocation) {
        gl.uniform1f(timeLocation, time);
      }

      const resolutionLocation = instance.uniforms.get('u_resolution');
      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, instance.canvas.width, instance.canvas.height);
      }

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Continue loop
      instance.animationId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Get exports from a shader layer.
   *
   * @param layer - The layer
   * @returns Array of exports
   */
  getExports(layer: Layer): Export[] {
    const instance = this.instances.get(layer.id);
    if (!instance) {
      return [];
    }

    return [
      {
        name: 'u_time',
        type: 'number',
        getter: () => instance.currentTime,
        description: 'Current shader time in seconds',
      },
      {
        name: 'u_resolution',
        type: 'object',
        getter: () => ({ x: instance.canvas.width, y: instance.canvas.height }),
        description: 'Canvas resolution',
      },
      {
        name: 'canvas',
        type: 'canvas',
        getter: () => instance.canvas,
        description: 'WebGL canvas element',
      },
      {
        name: 'gl',
        type: 'object',
        getter: () => instance.gl,
        description: 'WebGL rendering context',
      },
    ];
  }

  /**
   * Get imports for a shader layer.
   *
   * @param _layer - The layer
   * @returns Array of imports (empty for shaders)
   */
  getImports(_layer: Layer): Import[] {
    // Shaders don't typically import from other layers
    return [];
  }

  /**
   * Validate shader layer code.
   *
   * @param layer - The layer to validate
   * @returns Validation result
   */
  validate(layer: Layer): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!layer.code || layer.code.trim().length === 0) {
      errors.push('Shader code is empty');
      return { valid: false, errors };
    }

    const code = layer.code;

    // Check for vertex shader indicators
    const hasVertexShader =
      code.includes('attribute') ||
      code.includes('gl_Position') ||
      code.includes('// Vertex Shader');

    // Check for fragment shader indicators
    const hasFragmentShader =
      code.includes('gl_FragColor') ||
      code.includes('precision') ||
      code.includes('// Fragment Shader');

    // If code has explicit sections, validate both
    if (code.includes('// Vertex Shader') && code.includes('// Fragment Shader')) {
      const vertexPart = code.split(/\/\/\s*Fragment\s*Shader/i)[0];
      const fragmentPart = code.split(/\/\/\s*Fragment\s*Shader/i)[1] || '';

      if (!vertexPart.includes('void main')) {
        errors.push('Vertex shader missing main function');
      }
      if (!fragmentPart.includes('void main')) {
        errors.push('Fragment shader missing main function');
      }
    } else if (!hasVertexShader && !hasFragmentShader) {
      // No clear indicators of either shader type
      if (!code.includes('void main')) {
        errors.push('Shader must have a main function');
      }
    } else {
      // Has one type but missing the other
      if (!hasVertexShader) {
        errors.push('Missing vertex shader (no attribute or gl_Position found)');
      }
      if (!hasFragmentShader) {
        errors.push('Missing fragment shader (no gl_FragColor found)');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate standalone script for HTML export.
   *
   * @param layer - The layer
   * @param settings - Global settings
   * @returns HTML script string
   */
  generateScript(layer: Layer, settings: GlobalSettings): string {
    const { vertexSource, fragmentSource } = this.parseShaders(layer.code);

    const width = settings.width;
    const height = settings.height;

    return `
<!-- Shader Layer: ${layer.id} -->
<canvas id="shader-${layer.id}" width="${width}" height="${height}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></canvas>
<script>
(function() {
  const canvas = document.getElementById('shader-${layer.id}');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }

  // Vertex Shader
  const vertexSource = \`${vertexSource.replace(/`/g, '\\`')}\`;

  // Fragment Shader
  const fragmentSource = \`precision mediump float;
${fragmentSource.replace(/`/g, '\\`')}\`;

  // Compile shaders
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return;

  // Create program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  // Set up geometry
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Get uniform locations
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');

  // Animation loop
  const startTime = Date.now();
  function render() {
    const time = (Date.now() - startTime) / 1000;

    gl.viewport(0, 0, ${width}, ${height});
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (timeLocation) gl.uniform1f(timeLocation, time);
    if (resolutionLocation) gl.uniform2f(resolutionLocation, ${width}, ${height});

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
  }

  render();
})();
</script>`;
  }

  /**
   * Destroy a shader layer and clean up resources.
   *
   * @param layer - The layer to destroy
   * @param instance - The shader instance
   */
  destroy(layer: Layer, instance?: unknown): void {
    const shaderInstance = this.instances.get(layer.id);
    if (!shaderInstance) {
      return;
    }

    const { gl, program, vertexShader, fragmentShader, positionBuffer, animationId, canvas } =
      shaderInstance;

    // Cancel animation frame
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Delete WebGL resources
    gl.deleteBuffer(positionBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Remove canvas from DOM
    canvas.remove();

    // Remove from instances map
    this.instances.delete(layer.id);
  }
}

/** Singleton instance */
export const shaderAdapter = new ShaderAdapter();
