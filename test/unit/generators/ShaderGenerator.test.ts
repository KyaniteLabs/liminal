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

  it('rejects orphan GLSL preprocessor directives', () => {
    const gen = new ExposedShaderGenerator();
    const result = gen.validate('precision highp float;\n#endif\nvoid main(){gl_FragColor=vec4(1.0);}');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Orphan GLSL preprocessor directive');
  });
});
