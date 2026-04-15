import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 'const scene = new THREE.Scene();',
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

  it('wrapForGallery returns existing DOCTYPE HTML unchanged', () => {
    const gen = new ThreeGenerator();
    const html = '<!DOCTYPE html><html><body><script>THREE.Scene()</script></body></html>';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toBe(html);
  });

  it('wrapForGallery detects <html> tag and returns unchanged', () => {
    const gen = new ThreeGenerator();
    const html = '<html><body>scene</body></html>';
    const wrapped = gen.wrapForGallery(html);
    expect(wrapped).toBe(html);
  });

  it('generates code via super.generate', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: 'import * as THREE from "three";\nnew THREE.Scene();',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new ThreeGenerator();
    const result = await gen.generate('create a 3D scene');
    expect(result).toContain('THREE');
  });
});
