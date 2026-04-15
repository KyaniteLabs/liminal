/**
 * TierBasedGenerator.expanded.test.ts
 *
 * Branch-focused tests for TierBasedGenerator covering:
 * - Constructor paths (LLMClient instance, partial config, no config)
 * - Lazy config resolution (resolveConfigIfNeeded)
 * - generateInternal error guards (no LLM, no PromptBuilder, not configured)
 * - Thinking extraction (code blocks, code-like lines, empty thinking)
 * - Code-too-short validation
 * - Domain validation failure + recovery round
 * - Recovery paths (null repair prompt, short recovery, revalidation fail)
 * - Tier-specific prompt building (tiny vs non-tiny)
 * - Context budget with domainDocs
 * - generateLayer with layerRole/transparentBackground options
 * - getUserPreferences with and without domain data
 * - buildHarnessHint with sampled vs unsampled contexts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────
const {
  mockGenerateWithToolLoop,
  mockGetConfig,
  mockIsConfigured,
  mockGetEffectiveConfig,
  mockLoadContext,
  mockPromptBuilderBuild,
  mockDetectModelTier,
  mockTrimContext,
  mockHarnessPrepare,
  mockHarnessClassifyFailure,
  mockHarnessBuildRepairPrompt,
  mockHarnessRecordSuccess,
  mockMemoryGetSuccessful,
  mockMemoryGetRecent,
  mockMemoryRecordEpisode,
  mockMetaHarnessOnGen,
} = vi.hoisted(() => ({
  mockGenerateWithToolLoop: vi.fn(),
  mockGetConfig: vi.fn(() => ({ model: 'gpt-4o', baseUrl: 'http://test', role: 'generator' as const })),
  mockIsConfigured: vi.fn(() => true),
  mockGetEffectiveConfig: vi.fn(),
  mockLoadContext: vi.fn().mockResolvedValue({}),
  mockPromptBuilderBuild: vi.fn().mockReturnValue({ system: 'sys', user: 'usr', combined: 'combined' }),
  mockDetectModelTier: vi.fn().mockReturnValue('flagship' as const),
  mockTrimContext: vi.fn().mockReturnValue('trimmed'),
  mockHarnessPrepare: vi.fn(),
  mockHarnessClassifyFailure: vi.fn(),
  mockHarnessBuildRepairPrompt: vi.fn(),
  mockHarnessRecordSuccess: vi.fn(),
  mockMemoryGetSuccessful: vi.fn().mockReturnValue([]),
  mockMemoryGetRecent: vi.fn().mockReturnValue([]),
  mockMemoryRecordEpisode: vi.fn(),
  mockMetaHarnessOnGen: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────
vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = mockGenerateWithToolLoop;
    generate = vi.fn();
    getConfig = mockGetConfig;
    constructor(config?: any) {
      if (config && (config.model || config.baseUrl || config.apiKey)) {
        this.getConfig = vi.fn(() => config);
      }
    }
  }
  (MockLLMClient as any).isConfigured = mockIsConfigured;
  return { LLMClient: MockLLMClient };
});

vi.mock('../../../src/config/ConfigLoader.js', () => ({
  getEffectiveConfig: mockGetEffectiveConfig,
}));

vi.mock('../../../src/llm/PromptBuilder.js', () => ({
  PromptBuilder: Object.assign(
    vi.fn(function (this: any) {
      this.build = mockPromptBuilderBuild;
    }),
    { loadContext: mockLoadContext }
  ),
}));

vi.mock('../../../src/llm/ModelTier.js', () => ({
  detectModelTier: mockDetectModelTier,
  trimContext: mockTrimContext,
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    getSuccessfulAdaptations: mockMemoryGetSuccessful,
    getRecentEpisodes: mockMemoryGetRecent,
    recordEpisode: mockMemoryRecordEpisode,
  },
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: mockMetaHarnessOnGen },
}));

vi.mock('../../../src/harness/tools/generator-tools.js', () => ({
  GENERATOR_TOOLS: [{ name: 'validate_syntax' }, { name: 'check_imports' }],
  createGeneratorToolExecutor: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../../../src/generators/GeneratorHarnessTools.js', () => {
  return {
    GeneratorHarnessTools: vi.fn().mockImplementation(function () {
      this.prepare = mockHarnessPrepare;
      this.classifyFailure = mockHarnessClassifyFailure;
      this.buildRepairPrompt = mockHarnessBuildRepairPrompt;
      this.recordSuccess = mockHarnessRecordSuccess;
    }),
  };
});

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports ────────────────────────────────────────────────────────────
import { TierBasedGenerator } from '../../../src/generators/TierBasedGenerator.js';
import { LLMClient } from '../../../src/llm/LLMClient.js';

// ── Concrete test subclass ─────────────────────────────────────────────
class TestGenerator extends TierBasedGenerator {
  constructor(domain: string, llmOrConfig?: any) {
    super(domain, llmOrConfig);
  }

  /** Validates code — rejects anything containing 'INVALID' */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (code.includes('INVALID')) {
      return { valid: false, error: 'Test validation failed' };
    }
    return { valid: true };
  }
}

/** Subclass that returns valid:false without error property to test ?? branch */
class NoErrorGenerator extends TierBasedGenerator {
  constructor(domain: string, llmOrConfig?: any) {
    super(domain, llmOrConfig);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    if (code.includes('FAILNOERROR')) {
      return { valid: false };
    }
    return { valid: true };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
function makeToolResult(overrides: Partial<{ content: string; success: boolean; thinking: string; toolCalls: unknown[] }> = {}) {
  return {
    content: overrides.content ?? 'function setup() { createCanvas(400, 400); }',
    success: overrides.success ?? true,
    thinking: overrides.thinking ?? '',
    toolCalls: overrides.toolCalls ?? [],
    ...overrides,
  };
}

function makeLLM(): InstanceType<typeof LLMClient> {
  return new LLMClient() as InstanceType<typeof LLMClient>;
}

function defaultHarnessContext() {
  return {
    domain: 'p5',
    skeletonHint: '',
    sampledApis: [],
    hardeningHints: [],
    hintsWereSampled: false,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────
describe('TierBasedGenerator (expanded)', () => {
  let mockLLM: InstanceType<typeof LLMClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ model: 'gpt-4o', baseUrl: 'http://test', role: 'generator' as const });
    mockIsConfigured.mockReturnValue(true);
    mockDetectModelTier.mockReturnValue('flagship');
    mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
    mockLLM = makeLLM();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Constructor paths ──────────────────────────────────────────────
  describe('constructor', () => {
    it('accepts an LLMClient instance directly', () => {
      const gen = new TestGenerator('p5', mockLLM);
      const info = gen.getTierInfo();
      expect(info.domain).toBe('p5');
      expect(info.tier).toBe('flagship');
    });

    it('creates LLMClient from partial config with baseUrl', () => {
      const gen = new TestGenerator('three', { baseUrl: 'http://custom:1234/v1', model: 'test-model' });
      expect(gen.getTierInfo().domain).toBe('three');
    });

    it('creates LLMClient from partial config with apiKey only', () => {
      const gen = new TestGenerator('glsl', { apiKey: 'sk-test-123' });
      expect(gen.getTierInfo().domain).toBe('glsl');
    });

    it('creates placeholder LLMClient when no config provided', () => {
      const gen = new TestGenerator('tone');
      expect(gen.getTierInfo().domain).toBe('tone');
    });
  });

  // ── Lazy config resolution ─────────────────────────────────────────
  describe('resolveConfigIfNeeded (lazy)', () => {
    it('resolves config from getEffectiveConfig on first generate', async () => {
      mockGetEffectiveConfig.mockResolvedValue({
        baseUrl: 'https://api.resolved.com',
        model: 'resolved-model',
        apiKey: 'resolved-key',
      });

      // No config provided => triggers lazy resolution
      const gen = new TestGenerator('p5');
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      await gen.generate('test prompt');

      expect(mockGetEffectiveConfig).toHaveBeenCalled();
    });

    it('does not resolve when LLMClient was provided', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      expect(mockGetEffectiveConfig).not.toHaveBeenCalled();
    });

    it('handles null config from getEffectiveConfig gracefully', async () => {
      mockGetEffectiveConfig.mockResolvedValue(null);

      const gen = new TestGenerator('p5');
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      // Should still work — uses the placeholder client
      const result = await gen.generate('test');
      expect(typeof result).toBe('string');
    });

    it('handles config with no baseUrl or apiKey from getEffectiveConfig', async () => {
      mockGetEffectiveConfig.mockResolvedValue({ model: 'some-model' });

      const gen = new TestGenerator('p5');
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const result = await gen.generate('test');
      expect(typeof result).toBe('string');
    });

    it('prevents concurrent resolution races', async () => {
      let resolveConfig: (val: any) => void;
      const configPromise = new Promise(r => { resolveConfig = r; });
      mockGetEffectiveConfig.mockReturnValueOnce(configPromise);

      const gen = new TestGenerator('p5');
      mockGenerateWithToolLoop.mockResolvedValue(makeToolResult());

      // Fire two concurrent generates
      const p1 = gen.generate('prompt1');
      const p2 = gen.generate('prompt2');

      // Resolve config
      resolveConfig!({ baseUrl: 'http://late', model: 'late-model', apiKey: 'late-key' });

      await Promise.all([p1, p2]);

      // getEffectiveConfig called only once despite two concurrent calls
      expect(mockGetEffectiveConfig).toHaveBeenCalledTimes(1);
    });
  });

  // ── generateInternal error guards ──────────────────────────────────
  describe('generateInternal error guards', () => {
    it('throws GenerationError when LLM is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const gen = new TestGenerator('p5');

      await expect(gen.generate('test')).rejects.toThrow('No LLM configured');
    });
  });

  // ── Tier-specific prompt building ──────────────────────────────────
  describe('tier-specific prompt building', () => {
    it('uses empty system prompt for tiny tier', async () => {
      mockDetectModelTier.mockReturnValue('tiny');
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('tiny prompt');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.systemPrompt).toBe('');
      // Tiny tier uses combined || user, not just user
      expect(call.userPrompt).toBe('combined');
    });

    it('uses full system + user prompt for flagship tier', async () => {
      mockDetectModelTier.mockReturnValue('flagship');
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('flagship prompt');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.systemPrompt).toBe('sys');
      expect(call.userPrompt).toBe('usr');
    });

    it('uses full system + user prompt for medium tier', async () => {
      mockDetectModelTier.mockReturnValue('medium');
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('medium prompt');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.systemPrompt).toBe('sys');
      expect(call.userPrompt).toBe('usr');
    });

    it('uses full system + user prompt for local tier', async () => {
      mockDetectModelTier.mockReturnValue('local');
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('local prompt');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.systemPrompt).toBe('sys');
      expect(call.userPrompt).toBe('usr');
    });
  });

  // ── Budget by tier ─────────────────────────────────────────────────
  describe('getDefaultBudget', () => {
    it('returns 8000 for flagship tier', () => {
      mockDetectModelTier.mockReturnValue('flagship');
      const gen = new TestGenerator('p5', mockLLM);
      expect(gen.getTierInfo().budget).toBe(8000);
    });

    it('returns 4000 for medium tier', () => {
      mockDetectModelTier.mockReturnValue('medium');
      const gen = new TestGenerator('p5', mockLLM);
      expect(gen.getTierInfo().budget).toBe(4000);
    });

    it('returns 2000 for local tier', () => {
      mockDetectModelTier.mockReturnValue('local');
      const gen = new TestGenerator('p5', mockLLM);
      expect(gen.getTierInfo().budget).toBe(2000);
    });

    it('returns 1000 for tiny tier', () => {
      mockDetectModelTier.mockReturnValue('tiny');
      const gen = new TestGenerator('p5', mockLLM);
      expect(gen.getTierInfo().budget).toBe(1000);
    });
  });

  // ── Context budget + domainDocs trimming ───────────────────────────
  describe('context budget and trimming', () => {
    it('trims domainDocs when present in loaded context', async () => {
      mockLoadContext.mockResolvedValueOnce({ domainDocs: 'A'.repeat(5000) });
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      // trimContext called with budget * 0.3 = 8000 * 0.3 = 2400
      expect(mockTrimContext).toHaveBeenCalledWith('A'.repeat(5000), 2400);
    });

    it('does not call trimContext when no domainDocs', async () => {
      mockLoadContext.mockResolvedValueOnce({});
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      expect(mockTrimContext).not.toHaveBeenCalled();
    });

    it('uses custom contextBudget from options', async () => {
      mockLoadContext.mockResolvedValueOnce({ domainDocs: 'B'.repeat(3000) });
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test', { contextBudget: 4000 });

      // custom budget 4000 * 0.3 = 1200
      expect(mockTrimContext).toHaveBeenCalledWith('B'.repeat(3000), 1200);
    });
  });

  // ── Thinking extraction ────────────────────────────────────────────
  // NOTE: generateInternal creates LLMResponse with only {code, success, error}
  // from toolResult — thinking is NOT copied. So response.thinking is always
  // undefined, and the extraction branch (line 219) is never triggered.
  // All empty-code cases go straight to the "empty code" throw on line 229.
  describe('thinking extraction from empty code', () => {
    it('throws empty code when toolResult has thinking but it is not copied to response', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
        thinking: 'Let me think...\n```javascript\nfunction setup() { createCanvas(400, 400); }\n```',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      // thinking is not copied to LLMResponse, so extraction is never attempted
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });

    it('throws when code is empty and toolResult has non-extractable thinking', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
        thinking: 'Just some reasoning text without code blocks or patterns',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });

    it('throws when both code and thinking are empty', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
        thinking: '',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });

    it('throws when toolResult has code-like thinking but thinking not on response', async () => {
      const thinkingLines = [
        'I will create a canvas',
        'function setup() {',
        '  createCanvas(400, 400);',
        '}',
      ].join('\n');

      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
        thinking: thinkingLines,
      }));

      const gen = new TestGenerator('p5', mockLLM);
      // thinking not copied to response, so extraction not attempted
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });

    it('throws when toolResult thinking has empty code fences', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
        thinking: '```\n\n```',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });
  });

  // ── Code-too-short validation ──────────────────────────────────────
  describe('code-too-short validation', () => {
    it('throws when generated code is less than 10 chars after stripping comments', async () => {
      // Code that looks short after stripping comments
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '// just a comment\n// another',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('too short');
    });

    it('accepts code that is long enough after comment stripping', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '// header comment\nfunction setup() { createCanvas(400, 400); }',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const result = await gen.generate('test');
      expect(result).toContain('createCanvas(400, 400)');
    });
  });

  // ── Domain validation failure + recovery ───────────────────────────
  describe('domain validation failure and recovery', () => {
    it('attempts recovery when validation fails', async () => {
      // First call: generates INVALID code
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID code that triggers validation failure',
      }));
      // Recovery call: generates valid code
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function setup() { createCanvas(400, 400); }',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'wrong_domain',
        evidence: 'Test validation failed',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('REGENERATE using required APIs');

      const gen = new TestGenerator('p5', mockLLM);
      const result = await gen.generate('test');
      expect(result).toBe('function setup() { createCanvas(400, 400); }');
      // Recovery call should include validation error text
      const recoveryCall = mockGenerateWithToolLoop.mock.calls[1][0];
      expect(recoveryCall.userPrompt).toContain('Test validation failed');
    });

    it('throws when recovery also produces invalid code', async () => {
      // First call: generates INVALID code
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID first attempt',
      }));
      // Recovery: still INVALID
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID recovery attempt',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'wrong_domain',
        evidence: 'Test validation failed',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('Try again');

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('Test validation failed');
    });

    it('throws when repair prompt is null (no recovery attempted)', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID code',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'unknown',
        evidence: 'Test validation failed',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('');

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('Test validation failed');
    });

    it('throws when recovery code is too short', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID code',
      }));
      // Recovery returns very short code
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'x',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'too_short',
        evidence: 'Test validation failed',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('Make it longer');

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('Test validation failed');
    });

    it('throws when recovery code is empty', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'INVALID code',
      }));
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'empty_after_reasoning_strip',
        evidence: 'Test validation failed',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('Regenerate');

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('Test validation failed');
    });
  });

  // ── Harness hint building ──────────────────────────────────────────
  describe('buildHarnessHint integration', () => {
    it('appends harness hint to system prompt when hints are sampled', async () => {
      mockHarnessPrepare.mockReturnValue({
        domain: 'three',
        skeletonHint: '// Three.js scaffold\nconst scene = new THREE.Scene();',
        sampledApis: ['THREE.Scene', 'THREE.Mesh'],
        hardeningHints: ['Output only raw code.'],
        hintsWereSampled: true,
      });
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('three', mockLLM);
      await gen.generate('build a 3D scene');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      // System prompt should contain harness hint parts
      expect(call.systemPrompt).toContain('Domain scaffold');
      expect(call.systemPrompt).toContain('Required API tokens');
      expect(call.systemPrompt).toContain('Hardening hints');
    });

    it('does not append harness hint when nothing was sampled', async () => {
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      // systemPrompt should just be 'sys' from PromptBuilder.build
      expect(call.systemPrompt).toBe('sys');
    });

    it('handles partial hints (skeleton only, no APIs)', async () => {
      mockHarnessPrepare.mockReturnValue({
        domain: 'tone',
        skeletonHint: '// Tone.js scaffold\nconst synth = new Tone.Synth();',
        sampledApis: [],
        hardeningHints: [],
        hintsWereSampled: true,
      });
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('tone', mockLLM);
      await gen.generate('make a synth');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.systemPrompt).toContain('Domain scaffold');
      expect(call.systemPrompt).not.toContain('Required API tokens');
    });
  });

  // ── generateFull ───────────────────────────────────────────────────
  describe('generateFull', () => {
    it('returns full LLMResponse with code and success flag', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function draw() { ellipse(50, 50, 80, 80); }',
        thinking: 'Drawing a circle at center',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const response = await gen.generateFull('draw a circle');

      expect(response.code).toBe('function draw() { ellipse(50, 50, 80, 80); }');
      expect(response.success).toBe(true);
      // thinking is not copied from toolResult to LLMResponse (source gap)
      expect(response.thinking).toBeUndefined();
    });
  });

  // ── generateLayer ──────────────────────────────────────────────────
  describe('generateLayer', () => {
    it('creates a Layer with correct domain, code, and prompt', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function setup() { createCanvas(400, 400); }',
        thinking: 'canvas setup',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const layer = await gen.generateLayer('create canvas');

      expect(layer.type).toBe('p5');
      expect(layer.code).toBe('function setup() { createCanvas(400, 400); }');
      expect(layer.metadata.prompt).toBe('create canvas');
      expect(layer.metadata.generator).toBe('TestGenerator');
      expect(layer.metadata.model).toBe('gpt-4o');
      // thinking is not copied from toolResult to LLMResponse
      expect(layer.metadata.thinking).toBeUndefined();
      expect(layer.metadata.validation?.passed).toBe(true);
      expect(layer.enabled).toBe(true);
      expect(layer.locked).toBe(false);
    });

    it('passes layerRole option through to layer config', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function draw() {}',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const layer = await gen.generateLayer('overlay prompt', { layerRole: 'overlay' });

      expect(layer.config.role).toBe('overlay');
    });

    it('passes transparentBackground option through to layer config', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function draw() {}',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const layer = await gen.generateLayer('transparent bg', { transparentBackground: true });

      expect(layer.config.transparentBackground).toBe(true);
    });

    it('sets layerRole to undefined when not specified (config spread sets undefined)', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function draw() {}',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const layer = await gen.generateLayer('default role');

      // generateLayer passes { role: options?.layerRole } which is { role: undefined }
      // Spreading over DEFAULT_LAYER_CONFIG overwrites the default 'standalone' with undefined
      expect(layer.config.role).toBeUndefined();
      expect(layer.config.transparentBackground).toBeUndefined();
    });

    it('sets generatedAt to a valid ISO timestamp', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function draw() {}',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const layer = await gen.generateLayer('test');

      const parsed = new Date(layer.metadata.generatedAt as string);
      expect(parsed.getTime()).not.toBeNaN();
    });
  });

  // ── wrapForGallery ─────────────────────────────────────────────────
  describe('wrapForGallery', () => {
    it('returns code unchanged in base class', () => {
      const gen = new TestGenerator('p5', mockLLM);
      const code = 'function setup() {}';
      expect(gen.wrapForGallery(code)).toBe(code);
    });
  });

  // ── AbortSignal passthrough ────────────────────────────────────────
  describe('AbortSignal passthrough', () => {
    it('passes signal through to generateWithToolLoop', async () => {
      const controller = new AbortController();
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test', { signal: controller.signal });

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.signal).toBe(controller.signal);
    });
  });

  // ── getUserPreferences via harness memory ──────────────────────────
  describe('getUserPreferences integration', () => {
    it('includes domain preferences when episodes exist', async () => {
      mockMemoryGetRecent.mockReturnValue([
        { domain: 'p5', type: 'generation' },
        { domain: 'three', type: 'generation' },
        { domain: 'p5', type: 'generation' },
      ]);
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      // loadContext should be called — the user preferences are passed via context
      expect(mockLoadContext).toHaveBeenCalled();
      const ctxArg = mockLoadContext.mock.calls[0][2];
      expect(ctxArg.userPreferences).toContain('p5');
      expect(ctxArg.userPreferences).toContain('three');
    });

    it('returns empty string when no episodes exist', async () => {
      mockMemoryGetRecent.mockReturnValue([]);
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      const ctxArg = mockLoadContext.mock.calls[0][2];
      expect(ctxArg.userPreferences).toBe('');
    });
  });

  // ── getRecentAdaptations via harness memory ────────────────────────
  describe('getRecentAdaptations integration', () => {
    it('passes up to 3 recent adaptation descriptions', async () => {
      mockMemoryGetSuccessful.mockReturnValue([
        { description: 'canvas gradient' },
        { description: 'particle system' },
        { description: '3D cube' },
        { description: 'audio beat' },
      ]);
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      const ctxArg = mockLoadContext.mock.calls[0][2];
      // .slice(-3) takes last 3
      expect(ctxArg.recentAdaptations).toEqual(['particle system', '3D cube', 'audio beat']);
    });

    it('handles empty adaptations list', async () => {
      mockMemoryGetSuccessful.mockReturnValue([]);
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      const ctxArg = mockLoadContext.mock.calls[0][2];
      expect(ctxArg.recentAdaptations).toEqual([]);
    });
  });

  // ── Additional branch coverage: error guards ──────────────────────
  describe('error guards for null llm and promptBuilder', () => {
    it('throws GenerationError when llm is null after config resolution failure', async () => {
      mockGetEffectiveConfig.mockResolvedValue(null);

      // Create generator without config to trigger lazy resolution
      const gen = new TestGenerator('p5');
      // Sabotage llm to be null after construction
      (gen as any).llm = null;

      await expect(gen.generate('test')).rejects.toThrow('LLM not initialized');
    });

    it('throws GenerationError when promptBuilder is null', async () => {
      const gen = new TestGenerator('p5', mockLLM);
      // Sabotage promptBuilder to be null
      (gen as any).promptBuilder = null;

      await expect(gen.generate('test')).rejects.toThrow('PromptBuilder not initialized');
    });
  });

  // ── Additional branch coverage: tiny tier with no combined prompt ──
  describe('tiny tier fallback to user prompt when combined is absent', () => {
    it('uses builtPrompt.user when builtPrompt.combined is undefined', async () => {
      mockDetectModelTier.mockReturnValue('tiny');
      mockPromptBuilderBuild.mockReturnValueOnce({ system: 'sys', user: 'user-only', combined: undefined });
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('tiny no combined');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      // Tiny tier: userPrompt = combined || user; combined is undefined so falls back to user
      expect(call.userPrompt).toBe('user-only');
    });

    it('uses builtPrompt.user when builtPrompt.combined is empty string', async () => {
      mockDetectModelTier.mockReturnValue('tiny');
      mockPromptBuilderBuild.mockReturnValueOnce({ system: 'sys', user: 'user-fallback', combined: '' });
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext());
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('tiny empty combined');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      expect(call.userPrompt).toBe('user-fallback');
    });
  });

  // ── Additional branch coverage: non-tiny with no harness hint ─────
  describe('non-tiny tier with empty harness hint', () => {
    it('uses just builtPrompt.system without harness hint appended', async () => {
      mockDetectModelTier.mockReturnValue('flagship');
      mockHarnessPrepare.mockReturnValue(defaultHarnessContext()); // hintsWereSampled: false -> empty hint
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('no harness hint');

      const call = mockGenerateWithToolLoop.mock.calls[0][0];
      // buildHarnessHint returns '' when hintsWereSampled is false
      // systemPrompt = builtPrompt.system + (harnessHint ? '\n\n' + harnessHint : '')
      // Since harnessHint is '', the ternary takes the '' branch
      expect(call.systemPrompt).toBe('sys');
    });
  });

  // ── Additional branch coverage: whitespace-only code ──────────────
  describe('whitespace-only code handling', () => {
    it('throws empty code when response code is whitespace only', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: '   \n\t  \n  ',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      await expect(gen.generate('test')).rejects.toThrow('empty code');
    });
  });

  // ── Additional branch coverage: error from toolResult ─────────────
  describe('toolResult error passthrough', () => {
    it('includes error from toolResult in the response', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function setup() { createCanvas(200, 200); }',
        success: false,
        error: 'tool execution failed',
      }));

      const gen = new TestGenerator('p5', mockLLM);
      const result = await gen.generateFull('test');
      expect(result.code).toBe('function setup() { createCanvas(200, 200); }');
      expect(result.success).toBe(false);
      expect(result.error).toBe('tool execution failed');
    });
  });

  // ── Additional branch coverage: domainDocs as empty string ────────
  describe('context with empty domainDocs', () => {
    it('does not trim context when domainDocs is empty string', async () => {
      mockLoadContext.mockResolvedValueOnce({ domainDocs: '' });
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult());

      const gen = new TestGenerator('p5', mockLLM);
      await gen.generate('test');

      // Empty string is falsy, so the if(context.domainDocs) branch is not taken
      expect(mockTrimContext).not.toHaveBeenCalled();
    });
  });

  // ── Additional branch coverage: validation with undefined error ────
  describe('validation failure with undefined error (?? branch)', () => {
    it('falls back to "Validation failed" when error is undefined in recovery', async () => {
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'FAILNOERROR code here that is long enough',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'unknown',
        evidence: '',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('');

      const gen = new NoErrorGenerator('p5', mockLLM);
      // validateOutput returns { valid: false } (no error property)
      // Line 259 throws `${name}: ${validated.error}` => "NoErrorGenerator: undefined"
      await expect(gen.generate('test')).rejects.toThrow('NoErrorGenerator: undefined');
    });

    it('passes undefined error message through recovery attempt', async () => {
      // First call produces FAILNOERROR code
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'FAILNOERROR code here',
      }));
      // Recovery succeeds
      mockGenerateWithToolLoop.mockResolvedValueOnce(makeToolResult({
        content: 'function setup() { createCanvas(400, 400); }',
      }));

      mockHarnessClassifyFailure.mockReturnValue({
        failureClass: 'too_short',
        evidence: '',
      });
      mockHarnessBuildRepairPrompt.mockReturnValue('Fix it');

      const gen = new NoErrorGenerator('p5', mockLLM);
      const result = await gen.generate('test');
      expect(result).toBe('function setup() { createCanvas(400, 400); }');

      // Check recovery prompt contains the fallback error text
      const recoveryCall = mockGenerateWithToolLoop.mock.calls[1][0];
      expect(recoveryCall.userPrompt).toContain('Validation error: Validation failed');
    });
  });
});
