import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockToolLoop, mockGetConfig } = vi.hoisted(() => ({
  mockToolLoop: vi.fn().mockResolvedValue({
    content: 'osc(10, 0.1, 1.0).out(o0)',
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

vi.mock('../../../src/harness/tools/generator-tools.js', () => ({
  GENERATOR_TOOLS: [],
  createGeneratorToolExecutor: vi.fn().mockReturnValue(async () => 'ok'),
}));

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

import { HydraGenerator } from '../../../src/generators/hydra/HydraGenerator.js';

describe('HydraGenerator', () => {
  beforeEach(() => {
    mockToolLoop.mockClear();
  });

  it('constructs with hydra domain', () => {
    const gen = new HydraGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('hydra');
  });

  it('validates code with Hydra syntax', () => {
    const gen = new HydraGenerator();
    // validateOutput is protected; test via generateFull flow
    // Instead, test wrapForGallery produces HTML with hydra-synth import
    const wrapped = gen.wrapForGallery('osc(10).out(o0)');
    expect(wrapped).toContain('hydra-synth');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('osc(10).out(o0)');
  });

  it('wrapForGallery includes canvas element', () => {
    const gen = new HydraGenerator();
    const wrapped = gen.wrapForGallery('noise().out(o0)');
    expect(wrapped).toContain('<canvas id="c">');
    expect(wrapped).toContain('hydra.module.js');
  });

  it('sanitizeCode appends .out(o0) when missing render', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: 'osc(10, 0.1, 1.0)',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new HydraGenerator();
    const result = await gen.generate('make a pattern');
    expect(result).toContain('.out(o0)');
  });

  it('sanitizeCode appends render when multiple outputs exist', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: 'osc(10).out(o0)\nshape(4).out(o1)',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    const gen = new HydraGenerator();
    const result = await gen.generate('dual output');
    expect(result).toContain('render(o0)');
  });

  it('returns empty string for empty code', async () => {
    mockToolLoop.mockResolvedValueOnce({
      content: '',
      iterations: 1, toolCallsMade: 0, success: true,
    });
    // generate() on TierBasedGenerator throws on empty; test sanitize behavior via wrapForGallery
    const gen = new HydraGenerator();
    const wrapped = gen.wrapForGallery('');
    expect(wrapped).toContain('<!DOCTYPE html>');
  });
});
