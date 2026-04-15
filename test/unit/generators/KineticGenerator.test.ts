import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerate, mockGetConfig } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: '<!DOCTYPE html><html><head><style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style></head><body><div style="animation: spin 2s infinite">hello</div></body></html>',
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
    generateWithToolLoop = vi.fn().mockResolvedValue({
      content: '<!DOCTYPE html><html><head><style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style></head><body><div style="animation: spin 2s infinite">hello</div></body></html>',
      iterations: 1, toolCallsMade: 0, success: true,
    });
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

vi.mock('../../../src/generators/kinetic/kineticPrompt.js', () => ({
  KINETIC_SYSTEM_PROMPT: 'You are a CSS-kinetic artist.',
  buildKineticPrompt: (spec: string) => `SPEC: ${spec}`,
}));

vi.mock('../../../src/core/CodeValidator.js', () => ({
  CodeValidator: {
    validate: vi.fn().mockReturnValue({ valid: true, cleanedCode: 'x', errors: [] }),
  },
}));

vi.mock('../../../src/errors/GenerationError.js', () => ({
  GenerationError: class extends Error {
    constructor(msg: string) { super(msg); }
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn() },
}));

import { KineticGenerator } from '../../../src/generators/kinetic/KineticGenerator.js';

describe('KineticGenerator', () => {
  beforeEach(() => {
    mockGenerate.mockClear();
  });

  it('constructs with kinetic domain', () => {
    const gen = new KineticGenerator();
    const info = gen.getTierInfo();
    expect(info.domain).toBe('kinetic');
  });

  it('generate calls llm.generate with kinetic system prompt', async () => {
    const gen = new KineticGenerator();
    const code = await gen.generate('spinning shapes');
    expect(code).toContain('@keyframes');
    expect(code).toContain('<!DOCTYPE html>');
  });

  it('generateFull returns LLMResponse with code', async () => {
    const gen = new KineticGenerator();
    const response = await gen.generateFull('spinning shapes');
    expect(response.code).toContain('@keyframes');
    expect(response.success).toBe(true);
  });

  it('wrapForGallery delegates to KineticWrapper', () => {
    const gen = new KineticGenerator();
    const wrapped = gen.wrapForGallery('<div style="animation: spin 2s infinite">X</div>');
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('kinetic-canvas');
  });

  it('throws if LLM returns empty code', async () => {
    mockGenerate.mockResolvedValueOnce({ code: '', success: true });
    const gen = new KineticGenerator();
    await expect(gen.generate('empty')).rejects.toThrow('empty code');
  });
});
