import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: 'import * as THREE from "three";\nconst scene = new THREE.Scene();',
    success: true,
  }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
<<<<<<< Updated upstream
    generateWithToolLoop = vi.fn().mockImplementation(() =>
  mockGenerate().then((r: any) => ({ content: r.code, toolCalls: [], success: r.success }))
);
=======
    generateWithToolLoop = vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true });
>>>>>>> Stashed changes
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
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

import { ThreeGenerator } from '../../../src/generators/three/ThreeGenerator.js';

describe('ThreeGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('generate returns Three.js code from LLM', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'import * as THREE from "three";\nconst scene = new THREE.Scene();',
      success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('3d cube');
    expect(result).toContain('THREE');
    expect(result).toContain('new THREE.Scene()');
  });

  it('validateOutput accepts code with THREE namespace', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'const mesh = new THREE.Mesh(geometry, material);',
      success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('mesh');
    expect(result).toContain('THREE');
  });

  it('validateOutput accepts code with import from "three"', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'import { Scene } from "three";\nconst s = new Scene();',
      success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('scene');
    expect(result).toContain('from "three"');
  });

  it('validateOutput accepts code with from \'three\' single quotes', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: "import { Mesh } from 'three';",
      success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('mesh');
    expect(result).toContain("from 'three'");
  });

  it('validateOutput accepts code with "import * as THREE" style', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'import * as THREE from "three";\nconst cam = new THREE.PerspectiveCamera();',
      success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('camera');
    expect(result).toContain('import * as THREE');
  });

  it('validateOutput rejects code without Three.js references', async () => {
    mockGenerate.mockResolvedValueOnce({
      code: 'const canvas = document.createElement("canvas");\nctx.fillRect(0, 0, 100, 100);',
      success: true,
    });
    const gen = new ThreeGenerator();
    await expect(gen.generate('canvas 2d')).rejects.toThrow('does not appear to use Three.js');
  });
});
