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
    it('allows the Strudel editor to fetch its sample manifest without broadening every wrapper', () => {
      const result = GenericWrapper.wrap('s("bd sd")', { domain: 'strudel' });

      expect(result).toContain('connect-src https://raw.githubusercontent.com');
      expect(result).not.toContain("connect-src 'none'");
    });

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
    it('permits Hydra synth eval while keeping network connections blocked', () => {
      const result = GenericWrapper.wrap('osc(20).out()', { domain: 'hydra' });

      expect(result).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(result).toContain("connect-src 'none'");
    });

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
    it('allows Tone.js browser audio workers without opening network connections', () => {
      const result = GenericWrapper.wrap('const synth = new Tone.Synth();', { domain: 'tone' });

      expect(result).toContain('worker-src blob:');
      expect(result).toContain("connect-src 'none'");
    });

    it('wraps Tone.js code', () => {
      const code = 'const synth = new Tone.Synth();';
      const result = GenericWrapper.wrap(code, { domain: 'tone' });
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Tone.js');
      expect(result).toContain('tone@14.8.49');
    });

    it('strips stray tool-call markup before embedding raw Tone snippets', () => {
      const code = 'const synth = new Tone.Synth();</arg_value>\\n</tool_call>';
      const result = GenericWrapper.wrap(code, { domain: 'tone' });

      expect(result).toContain('const synth = new Tone.Synth();');
      expect(result).not.toContain('</arg_value>');
      expect(result).not.toContain('</tool_call>');
    });

    it('includes play/stop controls', () => {
      const code = 'const synth = new Tone.Synth();';
      const result = GenericWrapper.wrap(code, { domain: 'tone' });
      
      expect(result).toContain('▶ Play');
      expect(result).toContain('⏹ Stop');
      expect(result).toContain('id="start"');
      expect(result).toContain('id="stop"');
    });

    it('wraps raw Tone HTML in a polished preview shell instead of showing a bare button page', () => {
      const code = `<!DOCTYPE html>
<html>
<body>
  <button id="startButton">Start Ambient Sequence</button>
  <script src="https://unpkg.com/tone@14.8.49/build/Tone.js"></script>
  <script>
    const synth = new Tone.Synth().toDestination();
    document.getElementById('startButton').addEventListener('click', () => synth.triggerAttackRelease('C4', '8n'));
  </script>
</body>
</html>`;
      const result = GenericWrapper.wrap(code, { domain: 'tone' });

      expect(result).toContain('data-tone-preview-shell');
      expect(result).toContain('id="liminal-tone-start"');
      expect(result).toContain('id="liminal-tone-visualizer"');
      expect(result).toContain('id="startButton"');
      expect(result).toContain('Embedded Tone artifact');
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

  describe('wrap - Revideo', () => {
    it('wraps Revideo code', () => {
      const code = 'import { makeScene } from "@revideo/core";';
      const result = GenericWrapper.wrap(code, { domain: 'revideo' });

      expect(result).toContain('<!DOCTYPE html>');
    });
  });

  describe('wrap - Revideo', () => {
    it('wraps Revideo source as inert readable code, not executable script', () => {
      const code = 'import { makeScene } from "@revideo/core"; export default makeScene("x", function* () {});';
      const result = GenericWrapper.wrap(code, { domain: 'revideo' });

      expect(result).toContain('Revideo Composition');
      expect(result).toContain('from &quot;@revideo/core&quot;');
      expect(result).not.toContain('<script>\nimport { makeScene }');
    });

    it('renders a browser-visible timeline preview before the source details', () => {
      const code = `import { makeScene2D, Txt } from "@revideo/2d";
export default makeScene2D(function* (view) {
  yield view.add(<Txt text="Liminal title" />);
});`;
      const result = GenericWrapper.wrap(code, { domain: 'revideo' });

      expect(result).toContain('data-revideo-timeline-preview');
      expect(result).toContain('class="revideo-stage"');
      expect(result).toContain('class="timeline-playhead"');
      expect(result).toContain('Liminal title');
      expect(result.indexOf('data-revideo-timeline-preview')).toBeLessThan(result.indexOf('<details'));
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
