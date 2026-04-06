import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted is mandatory for variables used in vi.mock()
// ---------------------------------------------------------------------------
const {
  mockLLMGenerate,
  mockLLMGetConfig,
  mockLLMIsConfigured,
  mockDetectModelTier,
  mockBuild,
  mockLoadContext,
  mockTrimContext,
  mockGetSuccessfulAdaptations,
  mockGetRecentEpisodes,
  mockRecordEpisode,
  mockGetEffectiveConfig,
} = vi.hoisted(() => ({
  mockLLMGenerate: vi.fn(),
  mockLLMGetConfig: vi.fn(),
  mockLLMIsConfigured: vi.fn(),
  mockDetectModelTier: vi.fn(),
  mockBuild: vi.fn(),
  mockLoadContext: vi.fn(),
  mockTrimContext: vi.fn(),
  mockGetSuccessfulAdaptations: vi.fn(),
  mockGetRecentEpisodes: vi.fn(),
  mockRecordEpisode: vi.fn(),
  mockGetEffectiveConfig: vi.fn(),
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: Object.assign(
    function (this: any, _config: any) {
      this.generate = mockLLMGenerate;
      this.getConfig = mockLLMGetConfig;
    },
    { isConfigured: mockLLMIsConfigured }
  ),
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: Object.assign(
    function (this: any) {
      this.build = mockBuild;
    },
    { loadContext: mockLoadContext }
  ),
}));

vi.mock('../../../src/llm/ModelTier.js', () => ({
  detectModelTier: mockDetectModelTier,
  trimContext: mockTrimContext,
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    getSuccessfulAdaptations: mockGetSuccessfulAdaptations,
    getRecentEpisodes: mockGetRecentEpisodes,
    recordEpisode: mockRecordEpisode,
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: mockGetEffectiveConfig,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/errors/GenerationError.js', () => ({
  GenerationError: class extends Error {
    domain: string;
    details: any;
    constructor(message: string, domain: string, details?: any) {
      super(message);
      this.domain = domain;
      this.details = details;
    }
  },
}));

vi.mock('../../../src/composition/types.js', () => ({
  createLayer: vi.fn((domain, code, prompt, meta) => ({ domain, code, prompt, meta })),
}));

import { TierBasedGenerator } from '../../../src/generators/TierBasedGenerator.js';

// ---------------------------------------------------------------------------
// Concrete subclass for testing the abstract class
// ---------------------------------------------------------------------------
class ConcreteGenerator extends TierBasedGenerator {
  constructor(domain: string = 'test-domain') {
    super(domain);
  }

  public testValidate(code: string) {
    return this.validateOutput(code);
  }
}

// ---------------------------------------------------------------------------
describe('TierBasedGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLLMGetConfig.mockReturnValue({ model: 'test-model', role: 'generator' });
    mockLLMIsConfigured.mockReturnValue(true);
    mockDetectModelTier.mockReturnValue('medium');
    mockGetSuccessfulAdaptations.mockReturnValue([]);
    mockGetRecentEpisodes.mockReturnValue([]);
    mockLoadContext.mockResolvedValue({
      domainDocs: 'some docs',
      userPrompt: 'test prompt',
      systemPrompt: '',
      recentAdaptations: [],
    });
    mockBuild.mockReturnValue({
      system: 'system prompt',
      user: 'user prompt',
      combined: 'combined prompt',
    });
    mockTrimContext.mockImplementation((s: string) => s);
    mockGetEffectiveConfig.mockResolvedValue({ baseUrl: '', apiKey: '', model: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Constructor ---
  describe('constructor', () => {
    it('sets domain from parameter', () => {
      const gen = new ConcreteGenerator('p5');
      expect(gen.getTierInfo().domain).toBe('p5');
    });

    it('detects model tier from LLM config', () => {
      mockDetectModelTier.mockReturnValue('flagship');
      const gen = new ConcreteGenerator('three');
      expect(mockDetectModelTier).toHaveBeenCalled();
      expect(gen.getTierInfo().tier).toBe('flagship');
    });
  });

  // --- getTierInfo ---
  describe('getTierInfo', () => {
    it('returns correct budget for flagship (8000)', () => {
      mockDetectModelTier.mockReturnValue('flagship');
      expect(new ConcreteGenerator().getTierInfo()).toEqual({
        tier: 'flagship', budget: 8000, domain: 'test-domain',
      });
    });

    it('returns correct budget for medium (4000)', () => {
      mockDetectModelTier.mockReturnValue('medium');
      expect(new ConcreteGenerator().getTierInfo().budget).toBe(4000);
    });

    it('returns correct budget for local (2000)', () => {
      mockDetectModelTier.mockReturnValue('local');
      expect(new ConcreteGenerator().getTierInfo().budget).toBe(2000);
    });

    it('returns correct budget for tiny (1000)', () => {
      mockDetectModelTier.mockReturnValue('tiny');
      expect(new ConcreteGenerator().getTierInfo().budget).toBe(1000);
    });
  });

  // --- generate error paths ---
  describe('generate error paths', () => {
    it('throws when LLM is not configured', async () => {
      mockLLMIsConfigured.mockReturnValue(false);
      const gen = new ConcreteGenerator();
      await expect(gen.generate('test')).rejects.toThrow('No LLM configured');
    });

    it('throws when LLM returns empty code', async () => {
      mockLLMGenerate.mockResolvedValue({ code: '' });
      const gen = new ConcreteGenerator();
      await expect(gen.generate('test')).rejects.toThrow('LLM returned empty code');
    });

    it('throws when LLM returns whitespace-only code', async () => {
      mockLLMGenerate.mockResolvedValue({ code: '   \n  ' });
      const gen = new ConcreteGenerator();
      await expect(gen.generate('test')).rejects.toThrow('LLM returned empty code');
    });
  });

  // --- generate success path ---
  describe('generate success path', () => {
    it('returns code string from LLM response', async () => {
      mockLLMGenerate.mockResolvedValue({
        code: 'function setup() {}', thinking: 'reasoning', recoveredFromThinking: false,
      });
      const gen = new ConcreteGenerator();
      expect(await gen.generate('build a sketch')).toBe('function setup() {}');
    });

    it('passes system+user prompt for non-tiny tiers', async () => {
      mockDetectModelTier.mockReturnValue('medium');
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test');
      expect(mockLLMGenerate).toHaveBeenCalledWith('system prompt', 'user prompt', undefined, undefined);
    });

    it('passes empty system+combined prompt for tiny tier', async () => {
      mockDetectModelTier.mockReturnValue('tiny');
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test');
      expect(mockLLMGenerate).toHaveBeenCalledWith('', 'combined prompt', undefined, undefined);
    });

    it('passes AbortSignal through to LLM', async () => {
      const controller = new AbortController();
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test', { signal: controller.signal });
      expect(mockLLMGenerate).toHaveBeenCalledWith(expect.any(String), expect.any(String), controller.signal, undefined);
    });

    it('passes bypassCache through to LLM', async () => {
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test', { bypassCache: true });
      expect(mockLLMGenerate).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined, true);
    });
  });

  // --- generateFull ---
  describe('generateFull', () => {
    it('returns full LLMResponse with thinking trace', async () => {
      mockLLMGenerate.mockResolvedValue({
        code: 'osc().out();', thinking: 'reasoning', recoveredFromThinking: true,
      });
      const gen = new ConcreteGenerator();
      const result = await gen.generateFull('make a sound');
      expect(result.code).toBe('osc().out();');
      expect(result.thinking).toBe('reasoning');
      expect(result.recoveredFromThinking).toBe(true);
    });
  });

  // --- generateLayer ---
  describe('generateLayer', () => {
    it('returns a Layer with domain, code, prompt, and metadata', async () => {
      mockLLMGenerate.mockResolvedValue({
        code: 'osc().out();', thinking: null, recoveredFromThinking: false,
      });
      const gen = new ConcreteGenerator('hydra');
      const layer = await gen.generateLayer('visual synth');
      expect(layer.domain).toBe('hydra');
      expect(layer.code).toBe('osc().out();');
      expect(layer.prompt).toBe('visual synth');
      expect(layer.meta.generator).toBe('ConcreteGenerator');
      expect(layer.meta.model).toBe('test-model');
    });
  });

  // --- validateOutput default ---
  describe('validateOutput default', () => {
    it('returns valid:true for any input', () => {
      const gen = new ConcreteGenerator();
      expect(gen.testValidate('anything')).toEqual({ valid: true });
    });

    it('returns valid:true for empty string', () => {
      const gen = new ConcreteGenerator();
      expect(gen.testValidate('')).toEqual({ valid: true });
    });
  });

  // --- context budget ---
  describe('context budget', () => {
    it('trims domain docs to 30% of budget', async () => {
      mockDetectModelTier.mockReturnValue('medium'); // budget = 4000
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test');
      expect(mockTrimContext).toHaveBeenCalledWith('some docs', 1200);
    });

    it('uses custom contextBudget when provided', async () => {
      mockLLMGenerate.mockResolvedValue({ code: 'code' });
      const gen = new ConcreteGenerator();
      await gen.generate('test', { contextBudget: 2000 });
      expect(mockTrimContext).toHaveBeenCalledWith('some docs', 600);
    });
  });
});
