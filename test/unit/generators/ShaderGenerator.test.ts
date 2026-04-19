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

  it('wraps mainImage shaders with a WebGL main entrypoint', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = vec4(1.0); }');

    expect(wrapped).toContain('void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}');
  });

  it('uses a matching GLSL 300 vertex shader for version 300 fragments', () => {
    const gen = new ShaderGenerator();
    const wrapped = gen.wrapForGallery('#version 300 es\nprecision highp float;\nin vec2 v_uv;out vec4 fragColor;void main(){fragColor=vec4(v_uv,0.0,1.0);}');

    expect(wrapped).toContain('#version 300 es\\\\nin vec2 a_pos;out vec2 v_uv;');
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
});
