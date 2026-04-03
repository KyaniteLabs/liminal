import { describe, it, expect } from 'vitest';
import { P5Wrapper } from '../../../src/core/wrappers/P5Wrapper.js';

describe('P5Wrapper', () => {
  describe('detect', () => {
    it('detects p5.js code with setup function', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      expect(P5Wrapper.detect(code)).toBe(true);
    });

    it('detects p5.js code with draw function', () => {
      const code = 'function draw() { background(0); }';
      expect(P5Wrapper.detect(code)).toBe(true);
    });

    it('detects p5.js code with createCanvas', () => {
      const code = 'createCanvas(800, 600);';
      expect(P5Wrapper.detect(code)).toBe(true);
    });

    it('detects p5.js code with p5 functions', () => {
      const code = 'background(255); fill(0); ellipse(50, 50, 80);';
      expect(P5Wrapper.detect(code)).toBe(true);
    });

    it('does not detect shader code as p5', () => {
      const code = 'void main() { gl_FragColor = vec4(1.0); }';
      expect(P5Wrapper.detect(code)).toBe(false);
    });

    it('does not detect Three.js code as p5', () => {
      const code = 'const scene = new THREE.Scene();';
      expect(P5Wrapper.detect(code)).toBe(false);
    });

    it('does not detect Tone.js code as p5', () => {
      const code = 'const synth = new Tone.Synth();';
      expect(P5Wrapper.detect(code)).toBe(false);
    });

    it('does not detect Hydra code as p5', () => {
      const code = 'osc(20).rotate(0.5).out(o0);';
      expect(P5Wrapper.detect(code)).toBe(false);
    });

    it('does not detect Strudel code as p5', () => {
      const code = 's("bd sd").cpm(120);';
      expect(P5Wrapper.detect(code)).toBe(false);
    });
  });

  describe('wrap', () => {
    it('wraps p5.js code in HTML document', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const result = P5Wrapper.wrap(code);
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
      expect(result).toContain('p5.min.js');
      expect(result).toContain(code);
    });

    it('includes p5.sound when requested', () => {
      const code = 'function setup() {}';
      const result = P5Wrapper.wrap(code, { includeP5Sound: true });
      
      expect(result).toContain('p5.sound.min.js');
    });

    it('does not include p5.sound by default', () => {
      const code = 'function setup() {}';
      const result = P5Wrapper.wrap(code);
      
      expect(result).not.toContain('p5.sound.min.js');
    });

    it('uses default title', () => {
      const code = 'function setup() {}';
      const result = P5Wrapper.wrap(code);
      
      expect(result).toContain('<title>p5.js Sketch</title>');
    });

    it('uses custom title when provided', () => {
      const code = 'function setup() {}';
      const result = P5Wrapper.wrap(code, { title: 'My Custom Sketch' });
      
      expect(result).toContain('<title>My Custom Sketch</title>');
    });

    it('escapes closing script tags in code', () => {
      const code = 'alert("</script>");';
      const result = P5Wrapper.wrap(code);
      
      // The script tag inside the code should be escaped
      expect(result).toContain('alert("<\\/script>");');
      // Should not have unescaped script tag in the code portion
      expect(result.indexOf('alert("</script>");')).toBe(-1);
    });

    it('adds sound comment when using Web Audio', () => {
      const code = 'function setup() { new AudioContext(); }';
      const result = P5Wrapper.wrap(code);
      
      expect(result).toContain('Sound may require user click');
    });

    it('includes responsive styling', () => {
      const code = 'function setup() {}';
      const result = P5Wrapper.wrap(code);
      
      expect(result).toContain('display: flex');
      expect(result).toContain('justify-content: center');
      expect(result).toContain('align-items: center');
    });
  });
});
