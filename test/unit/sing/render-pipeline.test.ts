import { createSingPreset } from '../../../packages/audio-core/src/PresetSchema.js';
import { createSingRenderer, mapSingPresetUniforms, type SingUniformFrame } from '../../../packages/sing/src/render/pipeline.js';
import { describe, expect, it, vi } from 'vitest';

describe('Sing render pipeline', () => {
  const frame: SingUniformFrame = {
    rms: 0.5,
    pitchHz: 220,
    centroid: 0.25,
    spectralFlux: 0.4,
    onset: 1,
    voiced: 1,
    confidence: 0.8,
    elapsedSeconds: 2,
  };

  it('maps preset voice features to arbitrary shader uniform targets', () => {
    const preset = createSingPreset({
      id: 'mapped',
      name: 'Mapped',
      shader: 'void main() { gl_FragColor = vec4(1.0); }',
      mappings: [
        { feature: 'rms', target: 'u_energy', curve: 'easeOut', min: 0, max: 1 },
        { feature: 'pitchHz', target: 'u_customPitch', curve: 'linear', min: 80, max: 900 },
      ],
    });

    const uniforms = mapSingPresetUniforms(preset, frame);

    expect(uniforms.get('u_rms')).toBe(frame.rms);
    expect(uniforms.get('u_energy')).toBeCloseTo(0.75);
    expect(uniforms.get('u_customPitch')).toBeCloseTo(220);
  });

  it('binds mapped preset targets when rendering a frame', () => {
    const gl = createMockGl();
    const canvas = {
      width: 0,
      height: 0,
      clientWidth: 100,
      clientHeight: 80,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    const preset = createSingPreset({
      id: 'mapped',
      name: 'Mapped',
      shader: 'void main() { gl_FragColor = vec4(1.0); }',
      mappings: [
        { feature: 'rms', target: 'u_energy', curve: 'easeOut', min: 0, max: 1 },
      ],
    });

    createSingRenderer(canvas, preset).render(frame);

    expect(gl.getUniformLocation).toHaveBeenCalledWith(expect.anything(), 'u_energy');
    expect(gl.uniformCalls.u_energy.at(-1)).toBeCloseTo(0.75);
  });
});

function createMockGl(): WebGLRenderingContext & { uniformCalls: Record<string, number[]> } {
  const uniformCalls: Record<string, number[]> = {};
  const locations = new Map<string, WebGLUniformLocation>();
  const gl = {
    ARRAY_BUFFER: 0x8892,
    COMPILE_STATUS: 0x8B81,
    FLOAT: 0x1406,
    FRAGMENT_SHADER: 0x8B30,
    LINK_STATUS: 0x8B82,
    STATIC_DRAW: 0x88E4,
    TRIANGLES: 0x0004,
    VERTEX_SHADER: 0x8B31,
    uniformCalls,
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    drawArrays: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getProgramInfoLog: vi.fn(() => ''),
    getProgramParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    getShaderParameter: vi.fn(() => true),
    getUniformLocation: vi.fn((_program: WebGLProgram, name: string) => {
      const existing = locations.get(name);
      if (existing) return existing;
      const location = { name } as unknown as WebGLUniformLocation;
      locations.set(name, location);
      return location;
    }),
    linkProgram: vi.fn(),
    shaderSource: vi.fn(),
    uniform1f: vi.fn((location: WebGLUniformLocation | null, value: number) => {
      if (!location) return;
      const name = (location as unknown as { name: string }).name;
      uniformCalls[name] = [...(uniformCalls[name] ?? []), value];
    }),
    uniform2f: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
  };
  return gl as unknown as WebGLRenderingContext & { uniformCalls: Record<string, number[]> };
}
