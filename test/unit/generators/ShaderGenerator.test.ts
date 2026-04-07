/**
 * ShaderGenerator unit tests.
 * Covers constructor, validateOutput, isTruncated branches.
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

import { ShaderGenerator } from '../../../src/generators/glsl/ShaderGenerator.js';
import { GenerationError } from '../../../src/errors/GenerationError.js';

describe('ShaderGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates instance with no arguments', () => {
      const gen = new ShaderGenerator();
      expect(gen).toBeInstanceOf(ShaderGenerator);
    });

    it('creates instance with partial config', () => {
      const gen = new ShaderGenerator({ baseUrl: 'http://localhost', model: 'test' });
      expect(gen).toBeInstanceOf(ShaderGenerator);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------
  describe('error paths', () => {
    it('throws GenerationError when LLM is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const gen = new ShaderGenerator();
      await expect(gen.generate('raymarching scene')).rejects.toThrow(GenerationError);
    });

    it('throws with domain "shader"', async () => {
      mockIsConfigured.mockReturnValue(false);
      try {
        const gen = new ShaderGenerator();
        await gen.generate('test');
        expect.unreachable('Should have thrown');
      } catch (err) {
        const ge = err as GenerationError;
        expect(ge.domain).toBe('shader');
      }
    });

    it('throws when LLM returns empty code', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue({
        code: '',
        success: true,
      });
      const gen = new ShaderGenerator();
      await expect(gen.generate('test')).rejects.toThrow(GenerationError);
    });
  });

  // ---------------------------------------------------------------------------
  // validateOutput via generate - GLSL-specific validation
  // ---------------------------------------------------------------------------
  describe('validateOutput (GLSL-specific)', () => {
    it('accepts valid GLSL with void main and gl_FragColor', async () => {
      mockIsConfigured.mockReturnValue(true);
      const validGlsl = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}`;
      mockGenerate.mockResolvedValue({
        code: validGlsl,
        success: true,
      });

      const gen = new ShaderGenerator();
      const result = await gen.generate('plasma shader');
      expect(result).toBe(validGlsl);
    });

    it('rejects code missing both void main and gl_FragColor', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerate.mockResolvedValue({
        code: 'int x = 5;',  // Truncated: ends with ; but no main or gl_FragColor
        success: true,
      });

      const gen = new ShaderGenerator();
      await expect(gen.generate('test')).rejects.toThrow('critically incomplete');
    });

    it('accepts truncated code that still has void main and gl_FragColor', async () => {
      mockIsConfigured.mockReturnValue(true);
      // Code has unbalanced braces (truncated) but still has main and gl_FragColor
      const truncatedButValid = `void main() { gl_FragColor = vec4(1.0); `;
      mockGenerate.mockResolvedValue({
        code: truncatedButValid,
        success: true,
      });

      const gen = new ShaderGenerator();
      // This should succeed because it has both void main and gl_FragColor
      const result = await gen.generate('test');
      expect(result).toBe(truncatedButValid);
    });
  });

  // ---------------------------------------------------------------------------
  // getTierInfo
  // ---------------------------------------------------------------------------
  describe('getTierInfo', () => {
    it('returns tier info with shader domain', () => {
      const gen = new ShaderGenerator();
      const info = gen.getTierInfo();
      expect(info.domain).toBe('shader');
      expect(info.tier).toBe('medium');
      expect(typeof info.budget).toBe('number');
    });
  });
});
