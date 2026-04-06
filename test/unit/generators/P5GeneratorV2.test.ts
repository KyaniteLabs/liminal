/**
 * P5GeneratorV2 unit tests.
 * Covers constructor, validateOutput, sound detection, and error paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsConfigured, mockGenerate, mockGetConfig, LLMClientMock } = vi.hoisted(() => {
  const mockIsConfigured = vi.fn().mockReturnValue(false);
  const mockGenerate = vi.fn();
  const mockGetConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
  const LLMClientMock = vi.fn(function(this: any) {
    this.generate = mockGenerate;
    this.getConfig = mockGetConfig;
  });
  (LLMClientMock as any).isConfigured = mockIsConfigured;
  return { mockIsConfigured, mockGenerate, mockGetConfig, LLMClientMock };
});

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: LLMClientMock,
}));

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({ baseUrl: '', apiKey: '', model: '' }),
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: Object.assign(
    vi.fn(function(this: any) {
      this.build = vi.fn().mockReturnValue({ combined: 'test', system: 'sys', user: 'usr' });
    }),
    { loadContext: vi.fn().mockResolvedValue({}) }
  ),
}));

vi.mock('../../../src/llm/ModelTier.js', () => ({
  detectModelTier: vi.fn().mockReturnValue('medium'),
  trimContext: vi.fn().mockReturnValue(''),
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    getSuccessfulAdaptations: vi.fn().mockReturnValue([]),
    getRecentEpisodes: vi.fn().mockReturnValue([]),
    recordEpisode: vi.fn(),
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: {
    onGenerationComplete: vi.fn(),
  },
}));

import { P5GeneratorV2 } from '../../../src/generators/p5/P5GeneratorV2.js';
import { GenerationError } from '../../../src/errors/GenerationError.js';

const VALID_P5_CODE = `function setup() { createCanvas(400, 400); } function draw() { background(0); }`;
const VALID_LLM_RESPONSE = {
  code: VALID_P5_CODE,
  success: true,
  thinking: 'test thinking',
  recoveredFromThinking: false,
};

describe('P5GeneratorV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates instance with no arguments', () => {
      const gen = new P5GeneratorV2();
      expect(gen).toBeInstanceOf(P5GeneratorV2);
    });

    it('creates instance with partial config', () => {
      const gen = new P5GeneratorV2({ baseUrl: 'http://localhost', model: 'test' });
      expect(gen).toBeInstanceOf(P5GeneratorV2);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------
  describe('error paths', () => {
    it('throws GenerationError when LLM is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const gen = new P5GeneratorV2();
      await expect(gen.generate('test')).rejects.toThrow(GenerationError);
    });

    it('throws with domain "p5"', async () => {
      mockIsConfigured.mockReturnValue(false);
      try {
        const gen = new P5GeneratorV2();
        await gen.generate('test');
        expect.unreachable('Should have thrown');
      } catch (err) {
        const ge = err as GenerationError;
        expect(ge.domain).toBe('p5');
      }
    });

    it('throws when LLM returns empty code', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue({ code: '', success: true });
      const gen = new P5GeneratorV2();
      await expect(gen.generate('test')).rejects.toThrow(GenerationError);
    });
  });

  // ---------------------------------------------------------------------------
  // validateOutput via generate
  // ---------------------------------------------------------------------------
  describe('validateOutput (p5-specific)', () => {
    it('accepts code with function setup()', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      const result = await gen.generate('draw a circle');
      expect(result).toBe(VALID_P5_CODE);
    });

    it('accepts code with bare setup() call', async () => {
      mockIsConfigured.mockReturnValue(true);
      const bareSetupCode = 'setup(); function draw() {}';
      mockGenerate.mockResolvedValue({ code: bareSetupCode, success: true });
      const gen = new P5GeneratorV2();
      const result = await gen.generate('test');
      expect(result).toBe(bareSetupCode);
    });

    it('rejects code missing setup() function', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue({
        code: 'function draw() { background(0); }',
        success: true,
      });
      const gen = new P5GeneratorV2();
      await expect(gen.generate('test')).rejects.toThrow('missing required setup()');
    });
  });

  // ---------------------------------------------------------------------------
  // Sound detection in generate
  // ---------------------------------------------------------------------------
  describe('sound detection', () => {
    it('detects "sound" keyword in prompt', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      // Should not throw; sound detection is informational only (logs)
      const result = await gen.generate('sound waves visualization');
      expect(result).toBe(VALID_P5_CODE);
    });

    it('detects "audio" keyword in prompt', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      const result = await gen.generate('audio reactive sketch');
      expect(result).toBe(VALID_P5_CODE);
    });

    it('detects "music" keyword in prompt', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      const result = await gen.generate('music visualizer');
      expect(result).toBe(VALID_P5_CODE);
    });

    it('detects "tone" keyword in prompt', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      const result = await gen.generate('tone generator');
      expect(result).toBe(VALID_P5_CODE);
    });

    it('handles prompt without sound keywords', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorV2();
      const result = await gen.generate('bouncing ball animation');
      expect(result).toBe(VALID_P5_CODE);
    });
  });

  // ---------------------------------------------------------------------------
  // getTierInfo
  // ---------------------------------------------------------------------------
  describe('getTierInfo', () => {
    it('returns tier info with p5 domain', () => {
      const gen = new P5GeneratorV2();
      const info = gen.getTierInfo();
      expect(info.domain).toBe('p5');
      expect(info.tier).toBe('medium');
      expect(typeof info.budget).toBe('number');
    });
  });
});
