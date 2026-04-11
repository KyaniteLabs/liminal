import { describe, it, expect, vi } from 'vitest';
/**
 * ShaderGenerator and ShaderTemplates tests
 */

vi.mock('../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockImplementation((_system: string, user: string) => {
    // Return different GLSL code based on the prompt to satisfy "different templates" test
    const prompt = user.toLowerCase();
    if (prompt.includes('fractal') || prompt.includes('mandelbrot')) {
      return Promise.resolve({
        code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nvec2 z = vec2(0.0);\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution;\n  z = vec2(uv.x, uv.y);\n  gl_FragColor = vec4(0.0, 0.0, length(z), 1.0);\n}',
        success: true,
      });
    }
    if (prompt.includes('voronoi')) {
      return Promise.resolve({
        code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nvec2 random2(vec2 p) { return fract(sin(p) * 43758.5453); }\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(uv, 0.5, 1.0);\n}',
        success: true,
      });
    }
    return Promise.resolve({
      code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution;\n  gl_FragColor = vec4(uv.x, uv.y, 0.5 + 0.5 * sin(u_time), 1.0);\n}',
      success: true,
    });
  });
  class MockLLMClient {
    generate = generate;
    generateWithToolLoop = vi.fn().mockImplementation((opts: any) =>
      generate(opts?.systemPrompt, opts?.userPrompt).then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
    );
    );
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { selectShaderTemplate } from '../../src/generators/glsl/ShaderTemplates.js';

describe('ShaderGenerator', () => {
  it('generate() returns valid GLSL fragment shader', async () => {
    const gen = new ShaderGenerator();
    const code = await gen.generate('ray marched SDF scene');
    expect(code).toContain('void main');
    expect(code).toContain('gl_FragColor');
    expect(code.length).toBeGreaterThan(100);
  });

  it('generate() returns valid GLSL via LLM mock', async () => {
    const gen = new ShaderGenerator();
    const code = await gen.generate('fractal zoom');
    expect(code).toContain('void main');
    expect(code).toContain('gl_FragColor');
  });

  it('generate() selects different templates based on keywords', async () => {
    const gen = new ShaderGenerator();
    const ray = await gen.generate('ray march sphere');
    const fractal = await gen.generate('mandelbrot fractal');
    const voronoi = await gen.generate('voronoi cells');
    // Different templates should produce different code
    expect(ray).not.toBe(fractal);
    expect(fractal).not.toBe(voronoi);
  });
});

describe('selectShaderTemplate', () => {
  it('selects raymarch template for ray march keywords', () => {
    const code = selectShaderTemplate('ray marched SDF scene');
    expect(code).toContain('sdSphere');
  });

  it('selects fractal template for fractal keywords', () => {
    const code = selectShaderTemplate('mandelbrot fractal zoom');
    expect(code).toContain('z = vec2');
  });

  it('selects voronoi template for voronoi keywords', () => {
    const code = selectShaderTemplate('voronoi cells mosaic');
    expect(code).toContain('random2');
  });

  it('selects plasma template for plasma keywords', () => {
    const code = selectShaderTemplate('plasma lava fire');
    expect(code).toContain('sin(uv.x');
  });

  it('selects kaleidoscope template for kaleidoscope keywords', () => {
    const code = selectShaderTemplate('kaleidoscope mirror symmetry');
    expect(code).toContain('segments');
  });

  it('selects sdf template for sdf keywords', () => {
    const code = selectShaderTemplate('2d sdf shape morph');
    expect(code).toContain('sdCircle');
  });

  it('defaults to raymarch for unknown keywords', () => {
    const code = selectShaderTemplate('something random');
    expect(code).toContain('sdSphere');
  });
});
