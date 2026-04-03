import { describe, it, expect } from 'vitest';
import { GLSLValidator } from '../../../src/core/validators/GLSLValidator.js';

describe('GLSLValidator', () => {
  describe('validate', () => {
    it('should validate valid fragment shader with void main', () => {
      const code = `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_resolution;
        
        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution;
          vec3 color = vec3(uv.x, uv.y, sin(u_time) * 0.5 + 0.5);
          gl_FragColor = vec4(color, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate shader with fragColor output', () => {
      const code = `
        precision mediump float;
        out vec4 fragColor;
        uniform float u_time;
        
        void main() {
          vec3 color = vec3(0.5, 0.5, sin(u_time));
          fragColor = vec4(color, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate vertex shader with gl_Position', () => {
      const code = `
        attribute vec2 position;
        uniform float u_time;
        
        void main() {
          vec3 pos = vec3(0.5, 0.5, sin(u_time));
          gl_Position = vec4(position.x + pos.x, position.y + pos.y, 0.0, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject shader without main, fragColor, or gl_Position', () => {
      const code = `
        precision mediump float;
        uniform float time;
        float someValue = 0.5;
      `;

      const result = GLSLValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GLSL shader must contain void main(), gl_FragColor/fragColor, or gl_Position/gl_FragCoord');
    });

    it('should reject empty code', () => {
      const result = GLSLValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should warn about shader without animation', () => {
      const code = `
        void main() {
          gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors).toContain('GLSL shader should animate using u_time');
    });

    it('should warn about shader without complexity', () => {
      const code = `
        uniform float u_time;
        void main() {
          gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors).toContain('GLSL shader should use noise functions or multiple colors for complexity');
    });

    it('should accept shader with noise function', () => {
      const code = `
        uniform float u_time;
        
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        void main() {
          vec2 uv = gl_FragCoord.xy / vec2(800.0, 600.0);
          float h = hash(uv);
          gl_FragColor = vec4(vec3(h), 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors).not.toContain('GLSL shader should use noise functions or multiple colors for complexity');
    });

    it('should detect undefined function calls', () => {
      const code = `
        void main() {
          float val = undefinedFunc(1.0);
          gl_FragColor = vec4(val);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors.some(e => e.includes("undefinedFunc"))).toBe(true);
    });

    it('should allow built-in functions', () => {
      const code = `
        uniform float u_time;
        void main() {
          float s = sin(u_time);
          float c = cos(u_time);
          vec3 v = vec3(s, c, 0.5);
          gl_FragColor = vec4(v, 1.0);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors.filter(e => e.includes('Undefined function')).length).toBe(0);
    });

    it('should detect invalid % operator', () => {
      const code = `
        void main() {
          float a = 10.0 % 3.0;
          gl_FragColor = vec4(a);
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors.some(e => e.includes("'%' operator"))).toBe(true);
    });

    it('should detect missing sampler2D for texture2D', () => {
      const code = `
        void main() {
          vec4 tex = texture2D(u_texture, vec2(0.5));
          gl_FragColor = tex;
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors).toContain('GLSL: texture2D() used but no sampler2D uniform declared');
    });

    it('should allow texture2D with sampler2D declared', () => {
      const code = `
        uniform sampler2D u_texture;
        void main() {
          vec4 tex = texture2D(u_texture, vec2(0.5));
          gl_FragColor = tex;
        }
      `;

      const result = GLSLValidator.validate(code);
      expect(result.errors).not.toContain('GLSL: texture2D() used but no sampler2D uniform declared');
    });
  });

  describe('validateHTMLWrapped', () => {
    it('should require canvas for HTML-wrapped GLSL', () => {
      const code = `<!DOCTYPE html>
<html>
<body>
  <script>
    // No canvas here
  </script>
</body>
</html>`;

      const errors = GLSLValidator.validateHTMLWrapped(code);
      expect(errors).toContain('HTML-wrapped GLSL must include <canvas> and webgl context');
    });

    it('should accept HTML with canvas and webgl context', () => {
      const code = `<!DOCTYPE html>
<html>
<body>
  <canvas id="glCanvas"></canvas>
  <script>
    const gl = document.getElementById('glCanvas').getContext('webgl');
  </script>
</body>
</html>`;

      const errors = GLSLValidator.validateHTMLWrapped(code);
      expect(errors).toHaveLength(0);
    });
  });

  describe('getMinSize', () => {
    it('should return 800 bytes as minimum size', () => {
      expect(GLSLValidator.getMinSize()).toBe(800);
    });
  });
});
