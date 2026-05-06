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
        code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nfloat noise(vec2 p) { return fract(sin(dot(p, vec2(91.7, 311.3))) * 43758.5453); }\nvec3 palette(float t) { return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t)); }\nvoid main() {\n  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);\n  vec2 z = uv;\n  float m = 0.0;\n  for (int i = 0; i < 12; i++) { z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + uv + 0.01 * noise(uv + u_time); m += exp(-abs(length(z) - 0.7)); }\n  vec3 color = palette(m * 0.07 + u_time * 0.05) * (0.35 + 0.65 * sin(m));\n  gl_FragColor = vec4(color, 1.0);\n}',
        success: true,
      });
    }
    if (prompt.includes('voronoi')) {
      return Promise.resolve({
        code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nvec2 random2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }\nvoid main() {\n  vec2 uv = gl_FragCoord.xy / u_resolution * 6.0;\n  vec2 id = floor(uv);\n  vec2 gv = fract(uv);\n  float d = 1.0;\n  for (int y = -1; y <= 1; y++) { for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 p = o + random2(id + o) - gv; d = min(d, length(p)); } }\n  vec3 color = mix(vec3(0.05, 0.08, 0.25), vec3(0.9, 0.35, 0.15), smoothstep(0.05, 0.65, d + 0.1 * sin(u_time)));\n  gl_FragColor = vec4(color, 1.0);\n}',
        success: true,
      });
    }
    return Promise.resolve({
      code: 'precision mediump float;\nuniform float u_time;\nuniform vec2 u_resolution;\nfloat sdSphere(vec3 p, float r) { return length(p) - r; }\nfloat noise(vec2 p) { return fract(sin(dot(p, vec2(41.0, 289.0))) * 43758.5453); }\nvoid main() {\n  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);\n  float d = sdSphere(vec3(uv, sin(u_time) * 0.2), 0.45 + 0.05 * noise(uv * 8.0));\n  vec3 color = mix(vec3(0.02, 0.03, 0.08), vec3(0.2, 0.8, 0.95), smoothstep(0.1, -0.02, d));\n  color += vec3(0.95, 0.45, 0.1) * exp(-8.0 * abs(d));\n  gl_FragColor = vec4(color, 1.0);\n}',
      success: true,
    });
  });
  class MockLLMClient {
    generate = generate;
    generateWithToolLoop = vi.fn().mockImplementation((opts: any) =>
      generate(opts?.systemPrompt, opts?.userPrompt).then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
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
