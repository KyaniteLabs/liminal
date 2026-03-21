import { describe, it, expect } from 'vitest';
/**
 * ShaderGenerator and ShaderTemplates tests
 */

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

  it('generate() returns template fallback when LLM not configured', async () => {
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
