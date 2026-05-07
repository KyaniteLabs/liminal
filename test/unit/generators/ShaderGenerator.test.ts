import { describe, expect, it } from 'vitest';

import { ShaderGenerator } from '../../../src/generators/glsl/ShaderGenerator.js';

class ExposedShaderGenerator extends ShaderGenerator {
  validate(code: string) {
    return this.validateOutput(code);
  }
}

describe('ShaderGenerator', () => {
  it('wraps void main shaders without adding a mainImage call', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('void main() { gl_FragColor = vec4(1.0); }');

    expect(wrapped).toContain('const fs=');
    expect(wrapped).not.toContain('mainImage(gl_FragColor');
    expect(wrapped).toContain('void main()');
  });

  it('strips markdown GLSL fences before wrapping', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('```glsl\nvoid main() { gl_FragColor = vec4(1.0); }\n```');

    expect(wrapped).not.toContain('```glsl');
    expect(wrapped).toContain('void main()');
  });

  it('extracts fenced GLSL from explanatory prose', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('The shader should glow.\\n```glsl\\nvoid main() { gl_FragColor = vec4(1.0); }\\n```');

    expect(wrapped).not.toContain('The shader should glow');
    expect(wrapped).toContain('void main()');
  });

  it('extracts fragment shader source from full HTML output', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('html\n<!DOCTYPE html><script>const fsSource = `void main() { gl_FragColor = vec4(1.0); }`;</script>');

    expect(wrapped).not.toContain('<!DOCTYPE html><script>');
    expect(wrapped).toContain('void main()');
  });

  it('extracts fragment shader source from fragSrc HTML output', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('html\n<!DOCTYPE html><script>const fragSrc = `void main() { gl_FragColor = vec4(1.0); }`;</script>');

    expect(wrapped).not.toContain('<!DOCTYPE html><script>');
    expect(wrapped).toContain('void main()');
  });

  it('extracts fragment shader source from compact fs HTML output', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('html\n<!DOCTYPE html><script>const fs = `#version 300 es\nprecision highp float;\nout vec4 fragColor;void main(){fragColor=vec4(1.0);}`;</script>');

    expect(wrapped).not.toContain('<!DOCTYPE html><script>');
    expect(wrapped).toContain('#version 300 es');
    expect(wrapped).toContain('out vec4 fragColor');
  });

  it('extracts fragment shader source from common WebGL wrapper variable names', () => {
    const gen = new ShaderGenerator();
    const sanitized = (gen as any).sanitizeShaderCode([
      'function createShader() {}',
      'const fragmentShaderSource = `precision mediump float;',
      'uniform float u_time;',
      'void main(){ gl_FragColor = vec4(vec3(sin(u_time)), 1.0); }`;',
      'gl.shaderSource(shader, fragmentShaderSource);',
    ].join('\n'));

    expect(sanitized).not.toContain('function createShader');
    expect(sanitized).toContain('uniform float u_time');
    expect(sanitized).toContain('gl_FragColor');
  });

  it('wraps mainImage shaders with a WebGL main entrypoint', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0); }');

    expect(wrapped).toContain('void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}');
  });

  it('normalizes Shadertoy mainImage output before raw artifact validation', () => {
    const gen = new ExposedShaderGenerator();
    const sanitized = (gen as any).sanitizeShaderCode('precision mediump float;\nuniform vec2 u_resolution;\nuniform float u_time;\nfloat noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))) * 43758.5453); }\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { vec2 uv = fragCoord / u_resolution; float n = noise(uv + u_time); fragColor = vec4(uv.x, n, sin(u_time) * 0.5 + 0.5, 1.0); }');

    expect(sanitized).toContain('void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}');
    expect(gen.validate(sanitized).valid).toBe(true);
  });

  it('normalizes GLSL 300 mainImage output with an explicit fragment output variable', () => {
    const gen = new ExposedShaderGenerator();
    const sanitized = (gen as any).sanitizeShaderCode('#version 300 es\nprecision highp float;\nuniform vec2 u_resolution;\nuniform float u_time;\nfloat noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))) * 43758.5453); }\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) { vec2 uv = fragCoord / u_resolution; float n = noise(uv + u_time); fragColor = vec4(uv.x, n, sin(u_time) * 0.5 + 0.5, 1.0); }');

    expect(sanitized).toContain('out vec4 liminalFragColor;');
    expect(sanitized).toContain('void main(){mainImage(liminalFragColor,gl_FragCoord.xy);}');
    expect(sanitized).not.toContain('mainImage(gl_FragColor');
    expect(gen.validate(sanitized).valid).toBe(true);
  });

  it('uses the declared GLSL 300 fragment output variable when wrapping mainImage', () => {
    const gen = new ExposedShaderGenerator();
    const sanitized = (gen as any).sanitizeShaderCode('#version 300 es\nprecision highp float;\nout vec4 fragColor;\nuniform vec2 u_resolution;\nuniform float u_time;\nfloat noise(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))) * 43758.5453); }\nvoid mainImage(out vec4 color, in vec2 fragCoord) { vec2 uv = fragCoord / u_resolution; float n = noise(uv + u_time); color = vec4(uv.x, n, sin(u_time) * 0.5 + 0.5, 1.0); }');

    expect(sanitized).toContain('out vec4 fragColor;');
    expect(sanitized).toContain('void main(){mainImage(fragColor,gl_FragCoord.xy);}');
    expect(sanitized).not.toContain('mainImage(gl_FragColor');
    expect(gen.validate(sanitized).valid).toBe(true);
  });

  it('uses a matching GLSL 300 vertex shader for version 300 fragments', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('#version 300 es\nprecision highp float;\nin vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(v_uv,0.0,1.0);}');

    expect(wrapped).toContain('#version 300 es\\nin vec2 a_pos;out vec2 v_uv;');
  });

  it('rejects orphan GLSL preprocessor directives', () => {
    const gen = new ExposedShaderGenerator();
    const result = gen.validate('precision highp float;\n#endif\nvoid main(){gl_FragColor=vec4(1.0);}');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Orphan GLSL preprocessor directive');
  });

  it('rejects placeholder ellipses in shader output', () => {
    const gen = new ExposedShaderGenerator();
    const result = gen.validate('void main(){ // ... logic ...\n gl_FragColor=vec4(1.0); }');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('placeholder ellipses');
  });

  it('rejects undeclared color placeholder references', () => {
    const gen = new ExposedShaderGenerator();
    const result = gen.validate('void main(){ gl_FragColor=vec4(color, 1.0); }');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('references color');
  });

  it('injects a missing fbm helper when generated shader calls fbm', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('precision mediump float;\nvoid main(){ float f = fbm(gl_FragCoord.xy); gl_FragColor=vec4(vec3(f),1.0); }');

    expect(wrapped).toContain('float fbm(vec2 p)');
    expect(wrapped).toContain('float noise(vec2 p)');
    expect(wrapped).toContain('float f = fbm(gl_FragCoord.xy);');
  });

  it('repairs local-model palette helpers that take float but use vec2 p', () => {
    const gen = new ExposedShaderGenerator();
    const code = [
      'precision highp float;',
      'uniform vec2 u_resolution;',
      'uniform float u_time;',
      'float noise(vec2 p){ return p.x; }',
      'vec3 palette(float t) {',
      '  float n = noise(p * 0.5);',
      '  return vec3(n);',
      '}',
      'void main(){',
      '  vec2 p = gl_FragCoord.xy / u_resolution.xy + u_time * 0.01;',
      '  vec3 col = palette(p);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n');

    const sanitized = (gen as any).sanitizeShaderCode(code);

    expect(sanitized).toContain('vec3 palette(vec2 p)');
    expect(sanitized).toContain('vec3 col = palette(p);');
    expect(gen.validate(sanitized).valid).toBe(true);
  });
});
