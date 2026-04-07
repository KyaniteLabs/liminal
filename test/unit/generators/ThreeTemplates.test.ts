import { describe, it, expect } from 'vitest';
import { templates, selectThreeTemplate } from '../../../src/generators/three/ThreeTemplates.js';
import type { ThreeTemplateType } from '../../../src/generators/three/ThreeTemplates.js';

describe('ThreeTemplates', () => {
  const templateTypes: ThreeTemplateType[] = [
    'particle-galaxy',
    'procedural-geometry',
    'instanced-mesh',
    'wireframe-terrain',
  ];

  it('exports all 4 template types', () => {
    expect(Object.keys(templates).length).toBe(4);
    for (const type of templateTypes) {
      expect(templates[type]).toBeTruthy();
    }
  });

  for (const type of templateTypes) {
    describe(`template: ${type}`, () => {
      it('contains DOCTYPE html', () => {
        expect(templates[type]).toContain('<!DOCTYPE html>');
      });

      it('contains importmap with three CDN', () => {
        expect(templates[type]).toContain('"three"');
        expect(templates[type]).toContain('importmap');
      });

      it('contains a script type="module"', () => {
        expect(templates[type]).toContain('type="module"');
      });

      it('imports THREE', () => {
        expect(templates[type]).toContain('import * as THREE');
      });

      it('imports OrbitControls', () => {
        expect(templates[type]).toContain('OrbitControls');
      });

      it('has a resize event listener', () => {
        expect(templates[type]).toContain('addEventListener(\'resize\'');
      });

      it('has an animate function', () => {
        expect(templates[type]).toContain('function animate()');
      });

      it('creates a renderer', () => {
        expect(templates[type]).toContain('WebGLRenderer');
      });

      it('has black background style', () => {
        expect(templates[type]).toContain('background');
      });
    });
  }
});

describe('selectThreeTemplate', () => {
  it('selects particle-galaxy for galaxy keyword', () => {
    const result = selectThreeTemplate('galaxy simulation');
    expect(result).toBe(templates['particle-galaxy']);
  });

  it('selects particle-galaxy for star keyword', () => {
    const result = selectThreeTemplate('star field');
    expect(result).toBe(templates['particle-galaxy']);
  });

  it('selects particle-galaxy for space keyword', () => {
    const result = selectThreeTemplate('space scene');
    expect(result).toBe(templates['particle-galaxy']);
  });

  it('selects particle-galaxy for particle 3d keyword', () => {
    const result = selectThreeTemplate('particle 3d effect');
    expect(result).toBe(templates['particle-galaxy']);
  });

  it('selects wireframe-terrain for terrain keyword', () => {
    const result = selectThreeTemplate('terrain generator');
    expect(result).toBe(templates['wireframe-terrain']);
  });

  it('selects wireframe-terrain for landscape keyword', () => {
    const result = selectThreeTemplate('landscape view');
    expect(result).toBe(templates['wireframe-terrain']);
  });

  it('selects wireframe-terrain for wave terrain keyword', () => {
    const result = selectThreeTemplate('wave terrain');
    expect(result).toBe(templates['wireframe-terrain']);
  });

  it('selects instanced-mesh for instanced keyword', () => {
    const result = selectThreeTemplate('instanced rendering');
    expect(result).toBe(templates['instanced-mesh']);
  });

  it('selects instanced-mesh for grid keyword', () => {
    const result = selectThreeTemplate('grid of cubes');
    expect(result).toBe(templates['instanced-mesh']);
  });

  it('selects instanced-mesh for thousands keyword', () => {
    const result = selectThreeTemplate('thousands of boxes');
    expect(result).toBe(templates['instanced-mesh']);
  });

  it('selects procedural-geometry for geometry keyword', () => {
    const result = selectThreeTemplate('geometry showcase');
    expect(result).toBe(templates['procedural-geometry']);
  });

  it('selects procedural-geometry for torus keyword', () => {
    const result = selectThreeTemplate('torus knot');
    expect(result).toBe(templates['procedural-geometry']);
  });

  it('selects procedural-geometry for icosahedron keyword', () => {
    const result = selectThreeTemplate('icosahedron shape');
    expect(result).toBe(templates['procedural-geometry']);
  });

  it('defaults to procedural-geometry for unmatched prompt', () => {
    const result = selectThreeTemplate('something random');
    expect(result).toBe(templates['procedural-geometry']);
  });

  it('is case-insensitive for keyword matching', () => {
    expect(selectThreeTemplate('GALAXY')).toBe(templates['particle-galaxy']);
    expect(selectThreeTemplate('TERRAIN')).toBe(templates['wireframe-terrain']);
    expect(selectThreeTemplate('INSTANCED')).toBe(templates['instanced-mesh']);
  });
});
