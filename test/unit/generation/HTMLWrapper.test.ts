import { describe, it, expect } from 'vitest';
import { HTMLWrapper } from '../../../src/utils/htmlWrapper.js';

describe('HTMLWrapper', () => {
  describe('detectDomain', () => {
    it('detects p5.js code from setup/draw functions', () => {
      const code = 'function setup() { createCanvas(400, 400); } function draw() { background(0); }';
      expect(HTMLWrapper.detectDomain(code)).toBe('p5');
    });

    it('detects shader code from void main and uniforms', () => {
      const code = 'precision highp float; uniform vec2 u_resolution; void main() { gl_FragColor = vec4(1.0); }';
      expect(HTMLWrapper.detectDomain(code)).toBe('shader');
    });

    it('detects Three.js code from complete HTML with imports', () => {
      const code = '<!DOCTYPE html><html><head><script type="module">import * as THREE from "three";</script></head></html>';
      expect(HTMLWrapper.detectDomain(code)).toBe('three');
    });

    it('detects already-wrapped HTML', () => {
      const code = '<!DOCTYPE html><html><body>p5</body></html>';
      expect(HTMLWrapper.detectDomain(code)).toBe('html'); // Wrapped HTML without p5 CDN defaults to html
    });

    it('does not misclassify p5 code as shader', () => {
      const code = 'function setup() { createCanvas(400, 400); } function draw() { void main(); }';
      expect(HTMLWrapper.detectDomain(code)).toBe('p5');
    });
  });

  describe('isAlreadyWrapped', () => {
    it('returns true for DOCTYPE html', () => {
      const html = '<!DOCTYPE html><html><body>test</body></html>';
      expect(HTMLWrapper.isAlreadyWrapped(html)).toBe(true);
    });

    it('returns true for html tag', () => {
      const html = '<html><body>test</body></html>';
      expect(HTMLWrapper.isAlreadyWrapped(html)).toBe(true);
    });

    it('returns false for plain code', () => {
      const code = 'function setup() {}';
      expect(HTMLWrapper.isAlreadyWrapped(code)).toBe(false);
    });
  });

  describe('wrap', () => {
    it('does not double-wrap already wrapped HTML', () => {
      const html = '<!DOCTYPE html><html><body>p5</body></html>';
      const result = HTMLWrapper.wrap(html);
      expect(result).toBe(html);
    });

    it('wraps p5.js code correctly', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const result = HTMLWrapper.wrap(code);
      expect(result).toContain('<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js">');
      expect(result).toContain(code);
    });

    it('wraps shader code with WebGL context', () => {
      const code = 'void main() { gl_FragColor = vec4(1.0); }';
      const result = HTMLWrapper.wrap(code);
      expect(result).toContain('getContext(');
      expect(result).toContain('webgl');
      expect(result).toContain(code);
    });

    it('includes p5.sound when requested', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const result = HTMLWrapper.wrap(code, { includeP5Sound: true });
      expect(result).toContain('p5.sound.min.js');
    });

    it('uses custom title when provided', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const result = HTMLWrapper.wrap(code, { title: 'My Sketch' });
      expect(result).toContain('<title>My Sketch</title>');
    });
  });
});
