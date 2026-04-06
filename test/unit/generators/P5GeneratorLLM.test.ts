/**
 * P5GeneratorLLM unit tests.
 * Covers constructor branches, generate, generateFull, generateLayer,
 * sound detection, error paths, and config resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsConfigured, mockGenerateP5Sketch, mockGetConfig, LLMClientMock } = vi.hoisted(() => {
  const mockIsConfigured = vi.fn().mockReturnValue(false);
  const mockGenerateP5Sketch = vi.fn();
  const mockGetConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });

  const LLMClientMock = vi.fn(function(this: any) {
    this.generateP5Sketch = mockGenerateP5Sketch;
    this.getConfig = mockGetConfig;
  });
  (LLMClientMock as any).isConfigured = mockIsConfigured;

  return { mockIsConfigured, mockGenerateP5Sketch, mockGetConfig, LLMClientMock };
});

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: LLMClientMock,
}));

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({ baseUrl: '', apiKey: '', model: '' }),
}));

import { P5GeneratorLLM } from '../../../src/generators/p5/P5GeneratorLLM.js';
import { GenerationError } from '../../../src/errors/GenerationError.js';

const VALID_LLM_RESPONSE = {
  code: 'function setup() { createCanvas(400, 400); } function draw() {}',
  success: true,
  thinking: 'test thinking',
  recoveredFromThinking: false,
};

describe('P5GeneratorLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
  });

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates instance with no arguments', () => {
      const gen = new P5GeneratorLLM();
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });

    it('creates instance with an LLMClient instance', () => {
      const client = {
        generateP5Sketch: vi.fn(),
        getConfig: vi.fn().mockReturnValue({ model: 'm' }),
      } as unknown as InstanceType<typeof LLMClientMock>;
      const gen = new P5GeneratorLLM(client);
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });

    it('creates instance with partial config having baseUrl', () => {
      const gen = new P5GeneratorLLM({ baseUrl: 'http://localhost:1234' });
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });

    it('creates instance with partial config having apiKey', () => {
      const gen = new P5GeneratorLLM({ apiKey: 'sk-test' });
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });

    it('creates instance with partial config having model', () => {
      const gen = new P5GeneratorLLM({ model: 'gpt-4' });
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });

    it('creates instance with empty config object (triggers lazy resolution)', () => {
      const gen = new P5GeneratorLLM({});
      expect(gen).toBeInstanceOf(P5GeneratorLLM);
    });
  });

  // ---------------------------------------------------------------------------
  // generate - error paths
  // ---------------------------------------------------------------------------
  describe('generate error paths', () => {
    it('throws GenerationError when LLM is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const gen = new P5GeneratorLLM();
      await expect(gen.generate('test prompt')).rejects.toThrow(GenerationError);
    });

    it('throws GenerationError with domain "p5"', async () => {
      mockIsConfigured.mockReturnValue(false);
      try {
        const gen = new P5GeneratorLLM();
        await gen.generate('test');
        expect.unreachable('Should have thrown');
      } catch (err) {
        const ge = err as GenerationError;
        expect(ge.domain).toBe('p5');
      }
    });

    it('throws GenerationError when LLM returns empty code', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue({ code: '', success: true });
      const gen = new P5GeneratorLLM();
      await expect(gen.generate('test')).rejects.toThrow(GenerationError);
    });

    it('throws GenerationError when LLM returns whitespace-only code', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue({ code: '   \n\t  ', success: true });
      const gen = new P5GeneratorLLM();
      await expect(gen.generate('test')).rejects.toThrow(GenerationError);
    });
  });

  // ---------------------------------------------------------------------------
  // generate - success paths
  // ---------------------------------------------------------------------------
  describe('generate success paths', () => {
    it('returns the code string from LLM response', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      const result = await gen.generate('draw a circle');
      expect(result).toBe(VALID_LLM_RESPONSE.code);
    });

    it('passes prompt to generateP5Sketch', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('draw a spiral');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'draw a spiral',
        undefined,
        undefined,
        undefined,
      );
    });

    it('passes signal and bypassCache options to generateP5Sketch', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      const signal = new AbortController().signal;
      await gen.generate('test', { signal, bypassCache: true });
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'test',
        undefined,
        signal,
        true,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Sound detection
  // ---------------------------------------------------------------------------
  describe('sound detection', () => {
    it('passes sound context when prompt contains "sound"', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('make a sound visualization');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'make a sound visualization',
        expect.stringContaining('Web Audio API'),
        undefined,
        undefined,
      );
    });

    it('passes sound context when prompt contains "audio"', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('audio visualizer');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'audio visualizer',
        expect.stringContaining('Web Audio API'),
        undefined,
        undefined,
      );
    });

    it('passes sound context when prompt contains "music"', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('music visualization');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'music visualization',
        expect.stringContaining('Web Audio API'),
        undefined,
        undefined,
      );
    });

    it('passes sound context when prompt contains "beep"', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('beep sound effect');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'beep sound effect',
        expect.stringContaining('Web Audio API'),
        undefined,
        undefined,
      );
    });

    it('does not pass context when prompt has no sound keywords', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      await gen.generate('draw a red circle');
      expect(mockGenerateP5Sketch).toHaveBeenCalledWith(
        'draw a red circle',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // generateFull
  // ---------------------------------------------------------------------------
  describe('generateFull', () => {
    it('returns full LLMResponse object', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      const result = await gen.generateFull('test prompt');
      expect(result.code).toBe(VALID_LLM_RESPONSE.code);
      expect(result.thinking).toBe('test thinking');
      expect(result.recoveredFromThinking).toBe(false);
    });

    it('returns error response when LLM fails', async () => {
      mockIsConfigured.mockReturnValue(false);
      const gen = new P5GeneratorLLM();
      await expect(gen.generateFull('test')).rejects.toThrow(GenerationError);
    });
  });

  // ---------------------------------------------------------------------------
  // generateLayer
  // ---------------------------------------------------------------------------
  describe('generateLayer', () => {
    it('returns a Layer object with correct metadata', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      const layer = await gen.generateLayer('draw particles');

      expect(layer.type).toBe('p5');
      expect(layer.code).toBe(VALID_LLM_RESPONSE.code);
      expect(layer.metadata.prompt).toBe('draw particles');
      expect(layer.metadata.generator).toBe('P5GeneratorLLM');
      expect(layer.metadata.model).toBe('test-model');
      expect(layer.metadata.thinking).toBe('test thinking');
      expect(layer.metadata.recoveredFromThinking).toBe(false);
      expect(layer.metadata.validation?.passed).toBe(true);
      expect(layer.enabled).toBe(true);
      expect(layer.locked).toBe(false);
    });

    it('Layer has a valid id', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockGetConfig.mockReturnValue({ model: 'test-model', baseUrl: 'http://test', role: 'generator' });
      mockGenerateP5Sketch.mockResolvedValue(VALID_LLM_RESPONSE);
      const gen = new P5GeneratorLLM();
      const layer = await gen.generateLayer('test');
      expect(layer.id).toMatch(/^layer_/);
    });
  });
});
