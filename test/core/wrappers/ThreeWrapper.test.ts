import { describe, it, expect } from 'vitest';
import { ThreeWrapper } from '../../../src/core/wrappers/ThreeWrapper.js';

describe('ThreeWrapper', () => {
  describe('detect', () => {
    it('detects Three.js code with THREE. prefix', () => {
      const code = 'const scene = new THREE.Scene();';
      expect(ThreeWrapper.detect(code)).toBe(true);
    });

    it('detects Three.js code with ES module imports', () => {
      const code = 'import * as THREE from "three";';
      expect(ThreeWrapper.detect(code)).toBe(true);
    });

    it('detects Three.js code with import map', () => {
      const code = '<!DOCTYPE html><html><script type="importmap">{"imports": {"three": "..."}}</script></html>';
      expect(ThreeWrapper.detect(code)).toBe(true);
    });

    it('does not detect plain p5 code as Three.js', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      expect(ThreeWrapper.detect(code)).toBe(false);
    });
  });

  describe('wrap', () => {
    it('wraps Three.js code in HTML document', () => {
      const code = 'const scene = new THREE.Scene();';
      const result = ThreeWrapper.wrap(code);
      
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('three.module.js');
      expect(result).toContain('type="importmap"');
      expect(result).toContain(code);
    });

    it('uses default title', () => {
      const code = 'const scene = new THREE.Scene();';
      const result = ThreeWrapper.wrap(code);
      
      expect(result).toContain('<title>Three.js Scene</title>');
    });

    it('uses custom title when provided', () => {
      const code = 'const scene = new THREE.Scene();';
      const result = ThreeWrapper.wrap(code, { title: 'My 3D Scene' });
      
      expect(result).toContain('<title>My 3D Scene</title>');
    });

    it('returns code as-is if already wrapped in HTML', () => {
      const code = '<!DOCTYPE html><html><head></head><body>Three.js</body></html>';
      const result = ThreeWrapper.wrap(code);
      
      expect(result).toBe(code);
    });
  });
});
