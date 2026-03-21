import { describe, it, expect } from 'vitest';
/**
 * ThreeGenerator and ThreeTemplates tests
 */

import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import { selectThreeTemplate } from '../../src/generators/three/ThreeTemplates.js';

describe('ThreeGenerator', () => {
  it('generate() returns valid Three.js HTML', async () => {
    const gen = new ThreeGenerator();
    const code = await gen.generate('3D particle galaxy with orbiting lights');
    expect(code).toContain('<!DOCTYPE html>');
    expect(code).toContain('three');
    expect(code).toContain('importmap');
  });

  it('generate() returns template fallback when LLM not configured', async () => {
    const gen = new ThreeGenerator();
    const code = await gen.generate('procedural geometry');
    expect(code).toContain('THREE.Scene');
    expect(code).toContain('THREE.WebGLRenderer');
  });

  it('generate() selects different templates based on keywords', async () => {
    const gen = new ThreeGenerator();
    const galaxy = await gen.generate('3D star galaxy');
    const terrain = await gen.generate('wireframe terrain landscape');
    expect(galaxy).not.toBe(terrain);
  });
});

describe('selectThreeTemplate', () => {
  it('selects particle-galaxy for galaxy keywords', () => {
    const code = selectThreeTemplate('3D particle galaxy');
    expect(code).toContain('BufferGeometry');
  });

  it('selects wireframe-terrain for terrain keywords', () => {
    const code = selectThreeTemplate('wireframe terrain');
    expect(code).toContain('PlaneGeometry');
  });

  it('selects instanced-mesh for instanced keywords', () => {
    const code = selectThreeTemplate('instanced cubes field');
    expect(code).toContain('InstancedMesh');
  });

  it('selects procedural-geometry for geometry keywords', () => {
    const code = selectThreeTemplate('torus knot procedural');
    expect(code).toContain('TorusKnotGeometry');
  });

  it('defaults to procedural-geometry for unknown keywords', () => {
    const code = selectThreeTemplate('something random');
    expect(code).toContain('THREE.Scene');
  });

  it('all templates include importmap', () => {
    const templates = [
      selectThreeTemplate('galaxy'),
      selectThreeTemplate('terrain'),
      selectThreeTemplate('instanced cubes'),
      selectThreeTemplate('torus'),
    ];
    for (const t of templates) {
      expect(t).toContain('importmap');
      expect(t).toContain('three.module.js');
    }
  });
});
