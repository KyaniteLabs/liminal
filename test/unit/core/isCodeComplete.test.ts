/**
 * Tests for the shared, domain-aware isCodeComplete helper (D8).
 *
 * The previous behaviour was two copies of a naive brace counter: balanced
 * braces alone declared code "complete". That is domain-blind — a balanced but
 * truncated p5 sketch with no draw() passed, and non-brace domains (svg/html/
 * ascii) were judged by a check that does not apply to them.
 */

import { describe, it, expect } from 'vitest';
import { isCodeComplete } from '../../../src/core/isCodeComplete.js';

describe('isCodeComplete — shared domain-aware helper (D8)', () => {
  describe('empty input', () => {
    it('treats empty code as incomplete', () => {
      expect(isCodeComplete('')).toBe(false);
      expect(isCodeComplete('   \n  ', 'p5')).toBe(false);
    });
  });

  describe('p5 / brace domains', () => {
    it('accepts a p5 sketch with setup() and draw()', () => {
      const code =
        'function setup() { createCanvas(400, 400); }\nfunction draw() { background(0); ellipse(200, 200, 50, 50); }';
      expect(isCodeComplete(code, 'p5')).toBe(true);
    });

    it('rejects a balanced-but-truncated p5 sketch with no draw()', () => {
      // Braces are perfectly balanced, but there is no runtime entry point — the
      // naive brace counter would have called this complete.
      const code = 'const palette = [1, 2, 3];\nconst config = { speed: 2 };';
      expect(isCodeComplete(code, 'p5')).toBe(false);
    });

    it('rejects a p5 sketch cut off mid-draw (unbalanced braces)', () => {
      const code = 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(0';
      expect(isCodeComplete(code, 'p5')).toBe(false);
    });

    it('accepts a three.js sketch with an animate() loop', () => {
      const code =
        'const scene = new THREE.Scene();\nfunction animate() { renderer.render(scene, camera); requestAnimationFrame(animate); }\nanimate();';
      expect(isCodeComplete(code, 'three')).toBe(true);
    });
  });

  describe('glsl / shader domain', () => {
    it('accepts a shader with void main()', () => {
      const code = 'precision highp float;\nvoid main() { gl_FragColor = vec4(1.0); }';
      expect(isCodeComplete(code, 'glsl')).toBe(true);
    });

    it('rejects a shader with no main() entry point', () => {
      const code = 'precision highp float;\nfloat noise(vec2 p) { return fract(sin(p.x)); }';
      expect(isCodeComplete(code, 'shader')).toBe(false);
    });

    it('rejects a shader cut off mid-body (unbalanced braces)', () => {
      const code = 'void main() { gl_FragColor = vec4(';
      expect(isCodeComplete(code, 'glsl')).toBe(false);
    });
  });

  describe('audio domains (strudel / tone)', () => {
    it('accepts a strudel pattern with an .out() terminal', () => {
      const code = 's("bd sd hh hh").gain(0.8).out()';
      expect(isCodeComplete(code, 'strudel')).toBe(true);
    });

    it('rejects a strudel fragment with no output sink', () => {
      const code = 's("bd sd hh hh").gain(0.8)';
      expect(isCodeComplete(code, 'strudel')).toBe(false);
    });

    it('accepts a tone pattern with a .start() transport', () => {
      const code = 'const synth = new Tone.Synth().toDestination();\nTone.Transport.start()';
      expect(isCodeComplete(code, 'tone')).toBe(true);
    });
  });

  describe('markup domains (svg / html)', () => {
    it('accepts an SVG document with a closing </svg> tag', () => {
      const code = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
      expect(isCodeComplete(code, 'svg')).toBe(true);
    });

    it('rejects a truncated SVG with no closing tag', () => {
      const code = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"';
      expect(isCodeComplete(code, 'svg')).toBe(false);
    });
  });

  describe('text domains (ascii / textgen)', () => {
    it('accepts any non-empty ascii output regardless of braces', () => {
      const code = '/\\/\\/\\\n|  o  |\n\\/\\/\\/';
      expect(isCodeComplete(code, 'ascii')).toBe(true);
    });
  });

  describe('unknown domain falls back to structural check', () => {
    it('accepts balanced code', () => {
      expect(isCodeComplete('const x = (1 + 2) * [3][0];')).toBe(true);
    });

    it('rejects unbalanced code', () => {
      expect(isCodeComplete('const x = (1 + 2;')).toBe(false);
    });

    it('rejects code ending mid-function', () => {
      expect(isCodeComplete('function go() {\n  doThing();')).toBe(false);
    });
  });
});
