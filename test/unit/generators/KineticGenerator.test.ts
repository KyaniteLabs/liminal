import { describe, it, expect, vi } from 'vitest';

const { mockGenerate, mockGetConfig } = vi.hoisted(() => ({
  mockGenerate: vi.fn().mockResolvedValue({
    code: '<!DOCTYPE html><html><style>@keyframes x { to { opacity: 0; } }</style></html>',
    success: true,
  }),
  mockGetConfig: vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' }),
}));

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generate = mockGenerate;
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

import { KineticGenerator } from '../../../src/generators/kinetic/KineticGenerator.js';

describe('KineticGenerator', () => {
  describe('validateOutput', () => {
    it('rejects code missing DOCTYPE and html tag', () => {
      const gen = new KineticGenerator();
      const result = gen.validateOutput('just text');
      expect(result.valid).toBe(false);
    });

    it('rejects code with no @keyframes', () => {
      const gen = new KineticGenerator();
      const result = gen.validateOutput('<!DOCTYPE html><html></html>');
      expect(result.valid).toBe(false);
    });

    it('rejects code containing script tags', () => {
      const gen = new KineticGenerator();
      const result = gen.validateOutput('<!DOCTYPE html><html><script></script></html>');
      expect(result.valid).toBe(false);
    });

    it('accepts valid kinetic HTML with @keyframes', () => {
      const gen = new KineticGenerator();
      const result = gen.validateOutput(
        '<!DOCTYPE html><html><style>@keyframes x { to { opacity: 0; } }</style></html>'
      );
      expect(result.valid).toBe(true);
    });
  });
});
