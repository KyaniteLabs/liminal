import { describe, it, expect } from 'vitest';
import { selectShaderTemplate, templates } from '../../../src/generators/glsl/ShaderTemplates.js';
import type { ShaderType } from '../../../src/generators/glsl/ShaderTemplates.js';

// ===========================================================================
// ShaderTemplates
// ===========================================================================

describe('ShaderTemplates', () => {
  // ─── templates record ───────────────────────────────────────────────

  describe('templates', () => {
    const expectedTypes: ShaderType[] = ['raymarch', 'fractal', 'plasma', 'voronoi', 'kaleidoscope', 'sdf'];

    it('contains all 6 shader types', () => {
      for (const type of expectedTypes) {
        expect(templates[type]).toBeDefined();
        expect(typeof templates[type]).toBe('string');
      }
    });

    it('every template includes u_resolution uniform', () => {
      for (const [type, code] of Object.entries(templates)) {
        expect(code).toContain('u_resolution');
      }
    });

    it('every template includes u_time uniform', () => {
      for (const [type, code] of Object.entries(templates)) {
        expect(code).toContain('u_time');
      }
    });

    it('every template has a main function', () => {
      for (const [type, code] of Object.entries(templates)) {
        expect(code).toContain('void main()');
      }
    });

    it('every template assigns gl_FragColor', () => {
      for (const [type, code] of Object.entries(templates)) {
        expect(code).toContain('gl_FragColor');
      }
    });

    it('templates are non-trivial (at least 100 chars)', () => {
      for (const [type, code] of Object.entries(templates)) {
        expect(code.length).toBeGreaterThan(100);
      }
    });
  });

  // ─── selectShaderTemplate ───────────────────────────────────────────

  describe('selectShaderTemplate()', () => {
    // Ray march matches
    it('selects raymarch for "ray march" keyword', () => {
      const result = selectShaderTemplate('a ray marching scene');
      expect(result).toBe(templates.raymarch);
    });

    it('selects raymarch for "raymarch" keyword', () => {
      expect(selectShaderTemplate('raymarch terrain')).toBe(templates.raymarch);
    });

    it('selects raymarch for "3d sdf" keyword', () => {
      expect(selectShaderTemplate('3d sdf scene')).toBe(templates.raymarch);
    });

    // Fractal matches
    it('selects fractal for "fractal" keyword', () => {
      expect(selectShaderTemplate('fractal pattern')).toBe(templates.fractal);
    });

    it('selects fractal for "mandelbrot" keyword', () => {
      expect(selectShaderTemplate('mandelbrot zoom')).toBe(templates.fractal);
    });

    it('selects fractal for "julia" keyword', () => {
      expect(selectShaderTemplate('julia set animation')).toBe(templates.fractal);
    });

    // Plasma matches
    it('selects plasma for "plasma" keyword', () => {
      expect(selectShaderTemplate('plasma effect')).toBe(templates.plasma);
    });

    it('selects plasma for "lava" keyword', () => {
      expect(selectShaderTemplate('lava lamp shader')).toBe(templates.plasma);
    });

    it('selects plasma for "fire shader" keyword', () => {
      expect(selectShaderTemplate('fire shader effect')).toBe(templates.plasma);
    });

    // Voronoi matches
    it('selects voronoi for "voronoi" keyword', () => {
      expect(selectShaderTemplate('voronoi cells')).toBe(templates.voronoi);
    });

    it('selects voronoi for "cell" keyword', () => {
      expect(selectShaderTemplate('cell pattern')).toBe(templates.voronoi);
    });

    it('selects voronoi for "mosaic" keyword', () => {
      expect(selectShaderTemplate('mosaic tile shader')).toBe(templates.voronoi);
    });

    // Kaleidoscope matches
    it('selects kaleidoscope for "kaleidoscope" keyword', () => {
      expect(selectShaderTemplate('kaleidoscope effect')).toBe(templates.kaleidoscope);
    });

    it('selects kaleidoscope for "mirror" keyword', () => {
      expect(selectShaderTemplate('mirror symmetry')).toBe(templates.kaleidoscope);
    });

    it('selects kaleidoscope for "symmetry" keyword', () => {
      expect(selectShaderTemplate('symmetry pattern')).toBe(templates.kaleidoscope);
    });

    // SDF matches
    it('selects sdf for "sdf" keyword (without 3d prefix)', () => {
      expect(selectShaderTemplate('sdf shapes morphing')).toBe(templates.sdf);
    });

    it('selects sdf for "signed distance" keyword', () => {
      expect(selectShaderTemplate('signed distance field')).toBe(templates.sdf);
    });

    it('selects sdf for "2d shape" keyword', () => {
      expect(selectShaderTemplate('2d shape morphing')).toBe(templates.sdf);
    });

    // Default fallback
    it('falls back to raymarch for unrecognized prompt', () => {
      expect(selectShaderTemplate('random noise texture')).toBe(templates.raymarch);
    });

    it('falls back to raymarch for empty string', () => {
      expect(selectShaderTemplate('')).toBe(templates.raymarch);
    });

    // Case insensitivity
    it('is case-insensitive for keywords', () => {
      expect(selectShaderTemplate('FRACTAL DESIGN')).toBe(templates.fractal);
      expect(selectShaderTemplate('PLASMA Effect')).toBe(templates.plasma);
      expect(selectShaderTemplate('VORONOI')).toBe(templates.voronoi);
    });

    // Priority: first match wins
    it('selects fractal when prompt contains both "fractal" and "plasma"', () => {
      // fractal regex is checked before plasma in the if-chain
      const result = selectShaderTemplate('fractal plasma hybrid');
      expect(result).toBe(templates.fractal);
    });

    it('selects raymarch when prompt contains "sdf scene" (matches "3d sdf" before plain "sdf")', () => {
      // "sdf scene" matches the first regex "sdf\s*scene"
      expect(selectShaderTemplate('sdf scene')).toBe(templates.raymarch);
    });
  });
});
