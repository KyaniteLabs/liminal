import { describe, it, expect, vi } from 'vitest';
/**
 * ThreeGenerator and ThreeTemplates tests
 */

vi.mock('../../src/llm/LLMClient.js', () => {
  const generate = vi.fn().mockImplementation((_system: string, user: string) => {
    const prompt = user.toLowerCase();
    if (prompt.includes('terrain') || prompt.includes('wireframe')) {
      return Promise.resolve({
        code: 'const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nconst geometry = new THREE.PlaneGeometry(10, 10, 50, 50);\nconst material = new THREE.MeshBasicMaterial({ wireframe: true });\nconst mesh = new THREE.Mesh(geometry, material);\nscene.add(mesh);\nrenderer.render(scene, new THREE.PerspectiveCamera());',
        success: true,
      });
    }
    return Promise.resolve({
      code: 'const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nconst geometry = new THREE.BufferGeometry();\nconst material = new THREE.PointsMaterial();\nconst points = new THREE.Points(geometry, material);\nscene.add(points);\nrenderer.render(scene, new THREE.PerspectiveCamera());',
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

class TestableThreeGenerator extends ThreeGenerator {
  public testValidateOutput(code: string) {
    return this.validateOutput(code);
  }
}

describe('ThreeGenerator', () => {
  it('generate() returns raw Three.js scene code', async () => {
    const gen = new ThreeGenerator();
    const code = await gen.generate('3D particle galaxy with orbiting lights');
    expect(code).toContain('THREE.Scene');
    expect(code).not.toContain('<!DOCTYPE html>');
    expect(code).not.toContain('importmap');
  });

  it('generate() returns valid Three.js scene code via LLM mock', async () => {
    const gen = new ThreeGenerator();
    const code = await gen.generate('procedural geometry');
    expect(code).toContain('THREE.Scene');
    expect(code).toContain('THREE.WebGLRenderer');
  });

  it('validateOutput rejects nested HTML documents inside script tags', () => {
    const gen = new TestableThreeGenerator();
    const nested = `<!DOCTYPE html>
<html>
<body>
  <script>
    <!DOCTYPE html>
    <html><body><script>const scene = new THREE.Scene();</script></body></html>
  </script>
</body>
</html>`;
    const result = gen.testValidateOutput(nested);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('raw scene JavaScript');
  });

  it('generate() selects different templates based on keywords', async () => {
    const gen = new ThreeGenerator();
    const galaxy = await gen.generate('3D star galaxy');
    const terrain = await gen.generate('wireframe terrain landscape');
    expect(galaxy).not.toBe(terrain);
  });

  it('wrapForGallery normalizes complete HTML without nesting a second document', () => {
    const gen = new ThreeGenerator();
    const html = `<!DOCTYPE html><html><head><title>Scene</title></head><body><script>const scene = new THREE.Scene();</script></body></html>`;
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('const scene = new THREE.Scene();');
    expect(wrapped).not.toContain('<script>const scene = new THREE.Scene();</script></body></html>');
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
