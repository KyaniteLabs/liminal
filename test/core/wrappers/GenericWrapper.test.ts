import { describe, it, expect } from 'vitest';
import { GenericWrapper } from '../../../src/core/wrappers/GenericWrapper.js';

describe('GenericWrapper', () => {
  describe('detectDomain', () => {
    describe('Strudel detection', () => {
      it('detects Strudel code with stack()', () => {
        const code = 'stack(s("bd"), s("sd"))';
        expect(GenericWrapper.detectDomain(code)).toBe('strudel');
      });

      it('detects Strudel code with s("bd")', () => {
        const code = 's("bd*2")';
        expect(GenericWrapper.detectDomain(code)).toBe('strudel');
      });

      it('detects Strudel code with cpm()', () => {
        const code = 'note("c3 e3 g3").cpm(120)';
        expect(GenericWrapper.detectDomain(code)).toBe('strudel');
      });

      it('does not misclassify p5 as Strudel', () => {
        const code = 'function setup() { s("bd"); }';
        expect(GenericWrapper.detectDomain(code)).toBeNull();
      });
    });

    describe('Hydra detection', () => {
      it('detects Hydra code with multiple patterns', () => {
        const code = 'osc(20).rotate(0.5).out(o0)';
        expect(GenericWrapper.detectDomain(code)).toBe('hydra');
      });

      it('detects Hydra code with noise and kaleid', () => {
        const code = 'noise(10).kaleid(4).out(o1)';
        expect(GenericWrapper.detectDomain(code)).toBe('hydra');
      });

      it('requires at least 2 Hydra patterns', () => {
        const code = 'osc(20)'; // Only one pattern
        expect(GenericWrapper.detectDomain(code)).toBeNull();
      });
    });

    describe('Tone.js detection', () => {
      it('detects Tone.js code with Tone. prefix', () => {
        const code = 'const synth = new Tone.Synth();';
        expect(GenericWrapper.detectDomain(code)).toBe('tone');
      });

      it('detects Tone.js with Synth', () => {
        const code = 'const synth = new Synth().toDestination();';
        expect(GenericWrapper.detectDomain(code)).toBe('tone');
      });

      it('detects Tone.js with Transport', () => {
        const code = 'Tone.Transport.start();';
        expect(GenericWrapper.detectDomain(code)).toBe('tone');
      });
    });

    describe('Shader detection', () => {
      it('detects GLSL shader code', () => {
        const code = 'void main() { gl_FragColor = vec4(1.0); }';
        expect(GenericWrapper.detectDomain(code)).toBe('shader');
      });

      it('detects shader with uniforms', () => {
        const code = 'uniform vec2 u_resolution; void main() { }';
        expect(GenericWrapper.detectDomain(code)).toBe('shader');
      });

      it('requires multiple GLSL indicators', () => {
        const code = 'void main() { }'; // Only one indicator
        expect(GenericWrapper.detectDomain(code)).toBeNull();
      });

      it('does not detect p5 as shader', () => {
        const code = 'function setup() { void main(); }';
        expect(GenericWrapper.detectDomain(code)).toBeNull();
      });
    });

    describe('Revideo detection', () => {
      it('detects Revideo imports before falling back to p5', () => {
        const code = 'import { makeScene, createRef } from "@revideo/core"; export default makeScene("x", function* () {});';
        expect(GenericWrapper.detectDomain(code)).toBe('revideo');
      });
    });

    describe('Remotion detection', () => {
      it('detects Remotion with useCurrentFrame', () => {
        const code = 'const frame = useCurrentFrame();';
        expect(GenericWrapper.detectDomain(code)).toBe('remotion');
      });

      it('detects Remotion with AbsoluteFill', () => {
        const code = '<AbsoluteFill>';
        expect(GenericWrapper.detectDomain(code)).toBe('remotion');
      });

      it('detects Remotion imports', () => {
        const code = 'import { Composition } from "remotion";';
        expect(GenericWrapper.detectDomain(code)).toBe('remotion');
      });
    });

    describe('ASCII detection', () => {
      it('detects ASCII art', () => {
        const code = '█▓▒░\n████\n▓▓▓▓\n▒▒▒▒\n░░░░\n████';
        expect(GenericWrapper.detectDomain(code)).toBe('ascii');
      });

      it('detects line-art ASCII without block characters', () => {
        const code = ['   /\\', '  /  \\', ' /____\\'].join('\n');
        expect(GenericWrapper.detectDomain(code)).toBe('ascii');
      });

      it('does not detect JS code as ASCII', () => {
        const code = 'const x = "█▓▒░";\nconsole.log(x);';
        expect(GenericWrapper.detectDomain(code)).toBeNull();
      });
    });
  });

  describe('wrap - Strudel', () => {
    it('wraps Strudel code', () => {
      const code = 's("bd sd")';
      const result = GenericWrapper.wrap(code, { domain: 'strudel' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('@strudel/repl');
      expect(result).toContain('Strudel Live Coding Pattern');
    });

    it('uses the official embedded Strudel editor element', () => {
      const code = 's("bd")';
      const result = GenericWrapper.wrap(code, { domain: 'strudel' });
      
      expect(result).toContain('<strudel-editor>');
      expect(result).toContain('Browser audio still requires a user click');
      expect(result).not.toContain('import { repl, controls }');
    });
  });

  describe('wrap - Hydra', () => {
    it('wraps Hydra code', () => {
      const code = 'osc(20).out()';
      const result = GenericWrapper.wrap(code, { domain: 'hydra' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('hydra-synth');
      expect(result).toContain('Hydra Visual Synthesizer');
      expect(result).not.toContain('Logger.error');
    });

    it('uses default resolution', () => {
      const code = 'osc(20).out()';
      const result = GenericWrapper.wrap(code, { domain: 'hydra' });
      
      expect(result).toContain('width = 1280');
      expect(result).toContain('height = 720');
      expect(result).toContain('const go = () => {}');
      expect(result).toContain('const o = typeof o0');
    });

    it('uses custom resolution when provided', () => {
      const code = 'osc(20).out()';
      const result = GenericWrapper.wrap(code, { domain: 'hydra', hydraResolution: { width: 1920, height: 1080 } });
      
      expect(result).toContain('width = 1920');
      expect(result).toContain('height = 1080');
    });
  });

  describe('wrap - Tone.js', () => {
    it('wraps Tone.js code', () => {
      const code = 'const synth = new Tone.Synth();';
      const result = GenericWrapper.wrap(code, { domain: 'tone' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Tone.js');
      expect(result).toContain('tone@14.8.49');
    });

    it('includes play/stop controls', () => {
      const code = 'const synth = new Tone.Synth();';
      const result = GenericWrapper.wrap(code, { domain: 'tone' });
      
      expect(result).toContain('▶ Play');
      expect(result).toContain('⏹ Stop');
      expect(result).toContain('id="start"');
      expect(result).toContain('id="stop"');
    });
  });

  describe('wrap - Shader', () => {
    it('wraps GLSL shader code', () => {
      const code = 'void main() { gl_FragColor = vec4(1.0); }';
      const result = GenericWrapper.wrap(code, { domain: 'shader' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('GLSL Shader');
      expect(result).toContain('webgl');
      expect(result).not.toContain('Logger.error');
    });

    it('includes WebGL canvas', () => {
      const code = 'void main() { gl_FragColor = vec4(1.0); }';
      const result = GenericWrapper.wrap(code, { domain: 'shader' });
      
      expect(result).toContain('glCanvas');
    });

    it('escapes closing script tags', () => {
      const code = 'void main() { }</script>';
      const result = GenericWrapper.wrap(code, { domain: 'shader' });
      
      expect(result).toContain('<\\/script>');
    });

    it('normalizes GLSL 300 and Shadertoy aliases for the browser wrapper', () => {
      const code = `#version 300 es
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  fragColor = vec4(vec3(sin(iTime + uv.x)), 1.0);
}`;
      const result = GenericWrapper.wrap(code, { domain: 'shader' });

      expect(result).not.toContain('#version 300 es');
      expect(result).not.toContain('out vec4 fragColor');
      expect(result).not.toContain('iTime');
      expect(result).not.toContain('iResolution');
      expect(result).toContain('uniform float u_time');
      expect(result).toContain('uniform vec2 u_resolution');
      expect(result).toContain('gl_FragColor = vec4');
    });

    it('normalizes GLSL out variables even when the model omits #version 300', () => {
      const code = `precision highp float;
uniform vec2 u_resolution;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`;
      const result = GenericWrapper.wrap(code, { domain: 'shader' });

      expect(result).not.toContain('out vec4 fragColor');
      expect(result).toContain('gl_FragColor = vec4(1.0)');
    });
  });

  describe('wrap - Remotion', () => {
    it('wraps Remotion code', () => {
      const code = 'export const MyComp = () => <div />;';
      const result = GenericWrapper.wrap(code, { domain: 'remotion' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Remotion');
      expect(result).toContain('Legacy Remotion');
    });

    it('extracts metadata from code', () => {
      const code = 'durationInFrames: 150, fps: 30, width: 1920, height: 1080';
      const result = GenericWrapper.wrap(code, { domain: 'remotion' });
      
      expect(result).toContain('150 frames');
      expect(result).toContain('1920×1080');
    });

    it('escapes HTML entities', () => {
      const code = '<div>test</div>';
      const result = GenericWrapper.wrap(code, { domain: 'remotion' });
      
      expect(result).toContain('&lt;div&gt;');
    });
  });

  describe('wrap - Revideo', () => {
    it('wraps Revideo source as inert readable code, not executable script', () => {
      const code = 'import { makeScene } from "@revideo/core"; export default makeScene("x", function* () {});';
      const result = GenericWrapper.wrap(code, { domain: 'revideo' });

      expect(result).toContain('Revideo Composition');
      expect(result).toContain('from "@revideo/core"');
      expect(result).not.toContain('<script>\nimport { makeScene }');
    });
  });

  describe('wrap - ASCII', () => {
    it('wraps ASCII art', () => {
      const code = '████\n▓▓▓▓\n▒▒▒▒';
      const result = GenericWrapper.wrap(code, { domain: 'ascii' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('ASCII Art');
      expect(result).toContain('Courier New');
    });

    it('escapes HTML entities', () => {
      const code = '<test>';
      const result = GenericWrapper.wrap(code, { domain: 'ascii' });
      
      expect(result).toContain('&lt;test&gt;');
    });

    it('uses monospace styling', () => {
      const code = '████\n▓▓▓▓';
      const result = GenericWrapper.wrap(code, { domain: 'ascii' });
      
      expect(result).toContain('font-family: \'Courier New\'');
    });
  });
});
