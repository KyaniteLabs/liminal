import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 'const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nrenderer.render(scene, new THREE.PerspectiveCamera());',
    iterations: 1,
    toolCallsMade: 0,
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockToolLoop;
    getConfig = mockGetConfig;
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({ baseUrl: '', model: '', apiKey: '' }),
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: class {
    build = vi.fn().mockReturnValue({ system: 'sys', user: 'usr', combined: 'combined' });
    static loadContext = vi.fn().mockResolvedValue({});
  },
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    recordEpisode: vi.fn(),
    getSuccessfulAdaptations: vi.fn().mockReturnValue([]),
    getRecentEpisodes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

vi.mock('../../../src/harness/tools/generator-tools.js', () => ({
  GENERATOR_TOOLS: [],
  createGeneratorToolExecutor: vi.fn().mockReturnValue(async () => 'ok'),
}));

import { ThreeGenerator } from '../../../src/generators/three/ThreeGenerator.js';
import { PromptLibrary } from '../../../src/prompts/index.js';
import { SERVICE_DEFAULTS } from '../../../src/constants.js';

class TestableThreeGenerator extends ThreeGenerator {
  validateForTest(code: string) {
    return this.validateOutput(code);
  }
}

describe('ThreeGenerator', () => {
  beforeEach(() => {
    mockToolLoop.mockClear();
  });

  it('constructs with three domain', () => {
    const gen = new ThreeGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('three');
  });

  it('wrapForGallery wraps bare Three.js code in HTML with importmap', () => {
    const gen = new ThreeGenerator();
    const wrapped = gen.wrapForGallery('const s = new THREE.Scene();');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('importmap');
    expect(wrapped).toContain('three@0.160.0');
    expect(wrapped).toContain('import*as THREE');
  });

  it('registered prompt and wrapper agree on raw scene JavaScript plus the Three version', () => {
    const gen = new ThreeGenerator();
    const prompt = PromptLibrary.get('three.generate');
    const wrapped = gen.wrapForGallery('const scene = new THREE.Scene();');

    expect(prompt?.systemPrompt).toContain('raw Three.js scene JavaScript');
    expect(prompt?.systemPrompt).not.toContain('Return raw HTML');
    expect(prompt?.systemPrompt).not.toContain('Include OrbitControls');
    expect(prompt?.metadata?.defaultThreeVersion).toBe(SERVICE_DEFAULTS.THREE_VERSION);
    expect(wrapped).toContain(`three@${SERVICE_DEFAULTS.THREE_VERSION}`);
  });

  it('wrapForGallery extracts script from existing DOCTYPE HTML with Three code', () => {
    const gen = new ThreeGenerator();
    const html = '<!DOCTYPE html><html><body><script>THREE.Scene()</script></body></html>';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('import*as THREE');
    expect(wrapped).toContain('THREE.Scene()');
    expect(wrapped).not.toContain('<script>THREE.Scene()</script></body></html>');
  });

  it('wrapForGallery detects <html> tag and returns unchanged', () => {
    const gen = new ThreeGenerator();
    const html = '<html><body>scene</body></html>';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toBe(html);
  });

  it('wrapForGallery strips fenced full HTML before detection', () => {
    const gen = new ThreeGenerator();
    const html = '```html\n<!DOCTYPE html><html><body>scene</body></html>\n```';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toBe('<!DOCTYPE html><html><body>scene</body></html>');
  });

  it('wrapForGallery removes duplicate Three imports from extracted HTML scripts', () => {
    const gen = new ThreeGenerator();
    const html = '<!DOCTYPE html><html><body><script type="module">import * as THREE from "three";\nconst scene = new THREE.Scene();</script></body></html>';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toContain('const scene = new THREE.Scene();');
    expect(wrapped).not.toContain('import * as THREE from "three";');
  });

  it('extracts fenced Three scene code from explanatory output', () => {
    const gen = new ThreeGenerator();
    const wrapped = gen.wrapForGallery(`Here is the scene:
\`\`\`javascript
import * as THREE from "three";
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.render(scene, new THREE.PerspectiveCamera());
\`\`\``);
    expect(wrapped).toContain('const scene = new THREE.Scene();');
    expect(wrapped).not.toContain('Here is the scene');
    expect(wrapped).not.toContain('import * as THREE from "three";');
  });

  it('rejects OrbitControls example imports for proof stability', () => {
    const gen = new TestableThreeGenerator();
    const result = gen.validateForTest("import { OrbitControls } from 'https://unpkg.com/three/examples/jsm/controls/OrbitControls.js'; new THREE.Scene();");
    expect(result.valid).toBe(false);
    expect(result.error).toContain('OrbitControls');
  });

  it('rejects full HTML documents during generation validation', () => {
    const gen = new TestableThreeGenerator();
    const result = gen.validateForTest('<!DOCTYPE html><html><body><script>new THREE.Scene()</script></body></html>');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('raw scene JavaScript');
  });

  it('rejects truncated Three.js output before preview', () => {
    const gen = new TestableThreeGenerator();
    const result = gen.validateForTest('const scene = new THREE.Scene();\nconst mat = new THREE.PointsMaterial({\n  blending: THREE.Add');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('incomplete or truncated');
  });

  it('rejects placeholder comments instead of complete scene code', () => {
    const gen = new TestableThreeGenerator();
    const result = gen.validateForTest('const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\n// ... setup renderer ...\n// Crystals\n// Animation loop');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('placeholder comments');
  });

  it('generates code via super.generate', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: 'import * as THREE from "three";\nconst scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();\nrenderer.render(scene, new THREE.PerspectiveCamera());',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('create a 3D scene');
    expect(result).toContain('THREE');
    expect(result).not.toContain('import * as THREE');
  });
});
