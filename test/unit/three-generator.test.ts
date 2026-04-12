import { describe, it, expect, vi } from 'vitest';
/**
 * ThreeGenerator and ThreeTemplates tests
 */

vi.mock('../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockImplementation((_system: string, user: string) => {
    const prompt = user.toLowerCase();
    if (prompt.includes('terrain') || prompt.includes('wireframe')) {
      return Promise.resolve({
        code: '<!DOCTYPE html>\n<html><head>\n<script type="importmap">\n{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }\n</script>\n</head><body>\n<script type="module">\nimport * as THREE from "three";\nconst scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nconst geometry = new THREE.PlaneGeometry(10, 10, 50, 50);\nconst material = new THREE.MeshBasicMaterial({ wireframe: true });\nconst mesh = new THREE.Mesh(geometry, material);\nscene.add(mesh);\nrenderer.render(scene, new THREE.PerspectiveCamera());\n</script></body></html>',
        success: true,
      });
    }
    return Promise.resolve({
      code: '<!DOCTYPE html>\n<html><head>\n<script type="importmap">\n{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }\n</script>\n</head><body>\n<script type="module">\nimport * as THREE from "three";\nconst scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nconst geometry = new THREE.BufferGeometry();\nconst material = new THREE.PointsMaterial();\nconst points = new THREE.Points(geometry, material);\nscene.add(points);\nrenderer.render(scene, new THREE.PerspectiveCamera());\n</script></body></html>',
      success: true,
    });
  });
  class MockLLMClient {
    generate = generate;
    generateWithToolLoop = vi.fn().mockImplementation((opts: any) =>
      generate(opts?.systemPrompt, opts?.userPrompt).then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
    );
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

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

  it('generate() returns valid Three.js HTML via LLM mock', async () => {
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

  it('wrapForGallery passes through complete HTML without nesting a second document', () => {
    const gen = new ThreeGenerator();
    const html = `<!DOCTYPE html><html><head><title>Scene</title></head><body><script>const scene = new THREE.Scene();</script></body></html>`;
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toBe(html);
  });

  it('wrapForGallery still wraps raw Three scene code in a gallery harness', () => {
    const gen = new ThreeGenerator();
    const code = `const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();`;
    const wrapped = gen.wrapForGallery(code);
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('import*as THREE');
    expect(wrapped).toContain(code);
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
