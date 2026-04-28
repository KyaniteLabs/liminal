/**
 * Tests for RalphLoop — Self-recursive iteration engine.
 *
 * Focus: loop iteration logic, budget/stop conditions, score tracking,
 * stagnation detection, context accumulation, error recovery, and
 * convergence detection.
 *
 * All external dependencies are mocked to isolate RalphLoop logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────
// MUST use vi.hoisted() for any variable referenced inside vi.mock() factories.

const mockPromptStoreLoad = vi.hoisted(() => vi.fn(() => 'loaded-prompt-content'));
const mockPromptStoreInjectContext = vi.hoisted(() =>
  vi.fn((_prompt: string, _context: string) => 'prompt-with-context')
);
const mockBuildContextForInjection = vi.hoisted(() =>
  vi.fn((_iter: number, _opts: any, _prompt: string, _loaded: string, _prevCode: string) => 'injection-context')
);
const mockEnhancePrompt = vi.hoisted(() =>
  vi.fn(async (prompt: string) => prompt)
);
const mockContextAccumulationSave = vi.hoisted(() => vi.fn());
const mockContextAccumulationGetHistory = vi.hoisted(() => vi.fn(() => []));
const mockContextAccumulationClear = vi.hoisted(() => vi.fn());
const mockEventBusEmit = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockScoringEngineScore = vi.hoisted(() =>
  vi.fn(async () => ({ score: 0.75, issues: [] }))
);
const mockScoringEngineScoreReliable = vi.hoisted(() =>
  vi.fn(async () => ({ score: 0.75, issues: [] }))
);
const mockGeneratorGenerate = vi.hoisted(() =>
  vi.fn(async () => ({
    code: 'function setup() {} function draw() {}',
    thinking: 'test-thinking',
    model: 'test-model',
  }))
);
const mockStagnationCheck = vi.hoisted(() =>
  vi.fn(() => ({ shouldBreak: false, reason: '', successRate: 0.5 }))
);
const mockEvolutionUpdate = vi.hoisted(() =>
  vi.fn(() => ({ noveltyScore: 0.5, hints: '' }))
);
const mockPersistenceSaveIteration = vi.hoisted(() => vi.fn(async () => {}));
const mockPersistenceSaveMergeStep = vi.hoisted(() => vi.fn(async () => {}));
const mockRecordRoutingOutcome = vi.hoisted(() => vi.fn(async () => {}));
const mockAmbiguityDetect = vi.hoisted(() => vi.fn(() => []));
const mockRunOrganismMode = vi.hoisted(() =>
  vi.fn(async () => ({
    code: 'organism-code',
    iterations: 1,
    completed: true,
    reason: 'organism done',
    timestamp: new Date().toISOString(),
    duration: 1000,
    finalScore: 0.9,
  }))
);
const mockCodeValidatorValidate = vi.hoisted(() =>
  vi.fn(() => ({ valid: true, errors: [], cleanedCode: 'function setup() {} function draw() {}' }))
);
const mockSuccessRateTrackerGetRecommended = vi.hoisted(() => vi.fn(() => 1));
const mockSuccessRateTrackerRecordAttempt = vi.hoisted(() => vi.fn());
const mockSuccessRateTrackerShouldExplore = vi.hoisted(() => vi.fn(() => false));
const mockSuccessRateTrackerGetSuccessRate = vi.hoisted(() => vi.fn(() => 0.5));
const mockRenderPipelineProcess = vi.hoisted(() =>
  vi.fn(async () => ({ success: true, score: 0.8, domain: 'p5', duration: 5, warnings: [] }))
);
const mockRenderPipelineClose = vi.hoisted(() => vi.fn(async () => {}));
const mockRenderPipelineBlendScores = vi.hoisted(() => vi.fn(({ baseScore, renderScore, renderWeight = 0.5 }) => baseScore * (1 - renderWeight) + renderScore * renderWeight));

// ─── Mock registrations ────────────────────────────────────────────────────

vi.mock('../../../src/core/PromptStore.js', () => ({
  PromptStore: {
    load: mockPromptStoreLoad,
    injectContext: mockPromptStoreInjectContext,
  },
}));

vi.mock('../../../src/core/ContextBuilder.js', () => ({
  buildContextForInjection: mockBuildContextForInjection,
}));

vi.mock('../../../src/core/PromptEnhancer.js', () => ({
  enhancePrompt: mockEnhancePrompt,
}));

vi.mock('../../../src/core/ContextAccumulation.js', () => ({
  ContextAccumulation: {
    save: mockContextAccumulationSave,
    getHistory: mockContextAccumulationGetHistory,
    clear: mockContextAccumulationClear,
  },
}));

vi.mock('../../../src/core/EventBus.js', () => ({
  eventBus: { emit: mockEventBusEmit },
  EventTypes: {
    PROCESS_START: 'PROCESS_START',
    PROCESS_END: 'PROCESS_END',
    LOOP_ITERATION: 'LOOP_ITERATION',
    LOOP_EVALUATION: 'LOOP_EVALUATION',
    COMPOST_STAGE: 'COMPOST_STAGE',
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/core/ScoringEngine.js', () => ({
  ScoringEngine: class { score = mockScoringEngineScore; scoreReliable = mockScoringEngineScoreReliable; },
}));

vi.mock('../../../src/core/GenerationOrchestrator.js', () => ({
  GenerationOrchestrator: class { generate = mockGeneratorGenerate; },
}));

vi.mock('../../../src/core/EvolutionIntegration.js', () => ({
  EvolutionIntegration: class { update = mockEvolutionUpdate; },
}));

vi.mock('../../../src/core/LoopPersistence.js', () => ({
  LoopPersistence: class { saveIteration = mockPersistenceSaveIteration; saveMergeStep = mockPersistenceSaveMergeStep; },
}));

vi.mock('../../../src/core/StagnationDetector.js', () => ({
  StagnationDetector: class { check = mockStagnationCheck; },
}));

vi.mock('../../../src/core/SuccessRateTracker.js', () => ({
  SuccessRateTracker: class {
    getRecommendedCandidates = mockSuccessRateTrackerGetRecommended;
    recordAttempt = mockSuccessRateTrackerRecordAttempt;
    shouldExploreAggressively = mockSuccessRateTrackerShouldExplore;
    getSuccessRate = mockSuccessRateTrackerGetSuccessRate;
  },
}));

vi.mock('../../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: class { detect = mockAmbiguityDetect; },
}));

vi.mock('../../../src/core/OrganismLoop.js', () => ({
  runOrganismMode: mockRunOrganismMode,
}));

vi.mock('../../../src/core/CodeValidator.js', () => ({
  CodeValidator: { validate: mockCodeValidatorValidate },
}));

vi.mock('../../../src/core/PromiseDetector.js', () => ({
  PromiseDetector: { detect: vi.fn(() => false) },
}));

vi.mock('../../../src/gallery/Gallery.js', () => ({
  Gallery: class {},
}));

vi.mock('../../../src/routing/RoutingData.js', () => ({
  recordRoutingOutcome: mockRecordRoutingOutcome,
}));

vi.mock('../../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn(async () => {}) },
}));

vi.mock('../../../src/utils/env.js', () => ({
  env: vi.fn(() => 'lmstudio'),
}));

vi.mock('../../../src/compost/defaults.js', () => ({
  mergeConfig: vi.fn(() => ({})),
}));

vi.mock('../../../src/compost/CompostHeap.js', () => ({
  CompostHeap: class { addFile = vi.fn(async () => {}); isOverCapacity = vi.fn(async () => false); },
}));

vi.mock('../../../src/compost/CompostMill.js', () => ({
  CompostMill: class { digest = vi.fn(async () => {}); },
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class {},
}));

vi.mock('../../../src/learning/index.js', () => ({
  ArchiveLearning: class { getArchive = vi.fn(() => ({ load: vi.fn(async () => {}), save: vi.fn(async () => {}) })); addOutput = vi.fn(); },
  QualityArchive: vi.fn(),
}));

vi.mock('../../../src/evolution/AestheticModel.js', () => ({
  AestheticModel: class { load = vi.fn(async () => {}); save = vi.fn(async () => {}); },
}));

vi.mock('../../../src/evolution/MapElites.js', () => ({
  MapElites: class { load = vi.fn(async () => {}); save = vi.fn(async () => {}); },
}));

vi.mock('../../../src/evolution/NoveltyArchive.js', () => ({
  NoveltyArchive: vi.fn(),
}));

vi.mock('../../../src/types/domains.js', () => ({
  Domain: { P5: 'p5', GLSL: 'glsl', HYDRA: 'hydra', STRUDEL: 'strudel', REVIDEO: 'revideo' },
}));

vi.mock('../../../src/core/lir/GeneratedCodeParser.js', () => ({
  GeneratedCodeParser: class { parse = vi.fn(() => []); },
}));

vi.mock('../../../src/types/providers.js', () => ({
  Provider: { LMSTUDIO: 'lmstudio', OLLAMA: 'ollama' },
}));

vi.mock('../../../src/render/RenderAndScorePipeline.js', () => ({
  RenderAndScorePipeline: class {
    static blendScores = mockRenderPipelineBlendScores;
    process = mockRenderPipelineProcess;
    close = mockRenderPipelineClose;
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { RalphLoop } from '../../../src/core/RalphLoop.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function resetAllMocks(): void {
  vi.clearAllMocks();
  // Reset return values that may have been overridden
  mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
  mockScoringEngineScore.mockResolvedValue({ score: 0.75, issues: [] });
  mockGeneratorGenerate.mockResolvedValue({
    code: 'function setup() {} function draw() {}',
    thinking: 'test-thinking',
    model: 'test-model',
  });
  mockCodeValidatorValidate.mockReturnValue({
    valid: true,
    errors: [],
    cleanedCode: 'function setup() {} function draw() {}',
  });
  mockStagnationCheck.mockReturnValue({ shouldBreak: false, reason: '', successRate: 0.5 });
  mockEvolutionUpdate.mockReturnValue({ noveltyScore: 0.5, hints: '' });
  mockSuccessRateTrackerGetRecommended.mockReturnValue(1);
  mockPromptStoreLoad.mockReturnValue('loaded-prompt-content');
  mockPromptStoreInjectContext.mockReturnValue('prompt-with-context');
  mockAmbiguityDetect.mockReturnValue([]);
  mockContextAccumulationGetHistory.mockReturnValue([]);
  mockRenderPipelineProcess.mockResolvedValue({ success: true, score: 0.8, domain: 'p5', duration: 5, warnings: [] });
  mockRenderPipelineClose.mockResolvedValue(undefined);
  mockRenderPipelineBlendScores.mockImplementation(({ baseScore, renderScore, renderWeight = 0.5 }) =>
    baseScore * (1 - renderWeight) + renderScore * renderWeight,
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RalphLoop', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Static Methods ───────────────────────────────────────────────────

  describe('isCodeComplete()', () => {
    it('returns true for balanced code', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      expect(RalphLoop.isCodeComplete(code)).toBe(true);
    });

    it('returns false for unbalanced braces', () => {
      const code = 'function setup() { createCanvas(400, 400);';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns false for unbalanced parentheses', () => {
      const code = 'function setup( { }';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns false for unbalanced brackets', () => {
      const code = 'const arr = [1, 2;';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns false for code ending mid-function', () => {
      const code = 'function setup() { createCanvas(400, 400); }\nfunction draw() {\n  background(0);\n  rect(10,';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns true for empty string', () => {
      expect(RalphLoop.isCodeComplete('')).toBe(true);
    });

    it('returns true for simple balanced code', () => {
      const code = 'const x = 1;';
      expect(RalphLoop.isCodeComplete(code)).toBe(true);
    });
  });

  describe('getState()', () => {
    it('returns iteration count from context accumulation', () => {
      mockContextAccumulationGetHistory.mockReturnValue([
        { iteration: 1, evaluation: { score: 0.5 } },
      ]);
      const state = RalphLoop.getState();
      expect(state.iteration).toBe(1);
      expect(state.history).toHaveLength(1);
    });
  });

  describe('reset()', () => {
    it('clears context accumulation', () => {
      RalphLoop.reset();
      expect(mockContextAccumulationClear).toHaveBeenCalled();
    });
  });

  describe('getProgress()', () => {
    it('returns null when no history exists', () => {
      mockContextAccumulationGetHistory.mockReturnValue([]);
      expect(RalphLoop.getProgress()).toBeNull();
    });

    it('returns progress when history exists', () => {
      mockContextAccumulationGetHistory.mockReturnValue([
        { iteration: 3, maxIterations: 10, evaluation: { score: 0.8 } },
        { iteration: 5, maxIterations: 10, evaluation: { score: 0.9 } },
      ]);
      const progress = RalphLoop.getProgress();
      expect(progress).not.toBeNull();
      expect(progress!.iteration).toBe(2);
      expect(progress!.maxIterations).toBe(10);
      expect(progress!.progress).toBeCloseTo(0.2);
    });
  });

  // ─── Main Loop: Basic Iteration ───────────────────────────────────────

  describe('run() — basic iteration', () => {
    it('completes one iteration when score exceeds 0.90 and code is complete', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({
        score: 0.95,
        issues: [],
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
      expect(result.reason).toContain('excellent quality');
      expect(result.reason).toContain('0.95');
      expect(result.finalScore).toBe(0.95);
      expect(result.iterations).toBe(1);
    });

    it('iterates multiple times with improving scores', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        return { score: 0.5 + callCount * 0.15, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
      expect(result.iterations).toBeGreaterThanOrEqual(2);
      expect(result.finalScore).toBeGreaterThan(0.7);
    });

    it('stops at max iterations when quality never reaches threshold', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        // Scores: 0.30, 0.35, 0.40 — stay below 0.9, vary enough to avoid convergence
        return { score: 0.25 + callCount * 0.05, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        minQualityScore: 0.1, // Low enough to not trigger quality gate
        _disableIterationExtension: true,
      });

      expect(result.iterations).toBe(3);
      expect(result.reason).toContain('max iterations');
    });

    it('returns code from the last successful iteration', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.6, issues: [] });
      mockGeneratorGenerate.mockResolvedValue({
        code: 'function setup() { createCanvas(100, 100); } function draw() { background(255); }',
        thinking: 'generated',
        model: 'test-model',
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
      expect(result.model).toBe('test-model');
    });
  });

  // ─── Abort Signal ────────────────────────────────────────────────────

  describe('run() — abort signal', () => {
    it('stops when AbortSignal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        signal: controller.signal,
        _disableIterationExtension: true,
      });

      expect(result.reason).toBe('aborted by user');
      expect(result.iterations).toBe(0);
    });
  });

  // ─── Quality Gate ────────────────────────────────────────────────────

  describe('run() — quality gate', () => {
    it('breaks after iteration 2 if score below minQualityScore', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.3, issues: ['bad'] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        minQualityScore: 0.7,
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('quality threshold not met');
      expect(result.reason).toContain('0.30');
      expect(result.iterations).toBeGreaterThanOrEqual(2);
    });

    it('uses domain-specific quality thresholds for ascii', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.55, issues: [] });

      const result = await RalphLoop.run('create ascii art', {
        maxIterations: 5,
        minQualityScore: 0.8,
        _disableIterationExtension: true,
      });

      // ascii domain threshold is 0.5 (from normalizeOptions defaults), so 0.55 should pass quality gate
      expect(result.reason).not.toContain('quality threshold not met');
    });

    it('continues if score above minQualityScore but below 0.90', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        _disableIterationExtension: true,
      });

      // Score 0.75 is above default minQualityScore (0.7) but below 0.90, so loop runs
      expect(result.iterations).toBe(3);
    });
  });

  // ─── Stagnation Detection ────────────────────────────────────────────

  describe('run() — stagnation detection', () => {
    it('breaks when stagnation is detected', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.6, issues: [] });
      mockStagnationCheck.mockReturnValue({
        shouldBreak: true,
        reason: 'stagnation: no improvement for 7 iterations',
        successRate: 0.3,
        exploreAggressively: true,
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('stagnation');
    });
  });

  // ─── Convergence Detection ──────────────────────────────────────────

  describe('run() — convergence detection', () => {
    it('stops when score plateaus over 3 iterations', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        // Scores: 0.80, 0.803, 0.806 — improvement < 0.01 window
        return { score: 0.80 + callCount * 0.003, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        minQualityScore: 0.1, // Low enough to not trigger quality gate
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('convergence detected');
    });
  });

  // ─── Chat Mode ──────────────────────────────────────────────────────

  describe('run() — chat mode callbacks', () => {
    it('invokes onThought callbacks in chat mode', async () => {
      const thoughts: string[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        chatMode: true,
        onThought: (t) => thoughts.push(t),
        _disableIterationExtension: true,
      });

      expect(thoughts.length).toBeGreaterThan(0);
      expect(thoughts[0]).toContain('Starting iteration');
    });

    it('surfaces render scoring warnings through onThought in chat mode', async () => {
      const thoughts: string[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });
      mockRenderPipelineProcess.mockResolvedValue({
        success: true,
        score: 0.8,
        domain: 'p5',
        duration: 5,
        warnings: ['Visual scoring skipped: screenshot buffer too small'],
      });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        chatMode: true,
        useRenderScoring: true,
        onThought: (t) => thoughts.push(t),
        _disableIterationExtension: true,
      });

      expect(thoughts.some(t => t.includes('Render warnings: Visual scoring skipped: screenshot buffer too small'))).toBe(true);
    });

    it('invokes onProgress callback after each iteration', async () => {
      const progress: any[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        onProgress: (p) => progress.push(p),
        _disableIterationExtension: true,
      });

      expect(progress.length).toBeGreaterThanOrEqual(1);
      expect(progress[0].iteration).toBe(1);
      expect(progress[0].score).toBe(0.75);
    }, 10000);

    it('invokes onIteration callback with full context', async () => {
      const iterations: any[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        onIteration: (ctx) => iterations.push(ctx),
        _disableIterationExtension: true,
      });

      expect(iterations.length).toBe(1);
      expect(iterations[0].evaluation.score).toBe(0.92);
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────

  describe('run() — error handling', () => {
    it('throws when tolerateErrors is false and generation fails', async () => {
      mockGeneratorGenerate.mockRejectedValue(new Error('LLM connection failed'));

      await expect(
        RalphLoop.run('create a sketch', {
          maxIterations: 2,
          tolerateErrors: false,
          _disableIterationExtension: true,
        })
      ).rejects.toThrow('LLM connection failed');
    });

    it('continues when tolerateErrors is true and generation fails', async () => {
      let callCount = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('transient failure');
        return {
          code: 'function setup() {} function draw() {}',
          thinking: 'retry',
          model: 'test-model',
        };
      });
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        tolerateErrors: true,
        _disableIterationExtension: true,
      });

      // First iteration fails (no candidates), but second should succeed
      expect(result.iterations).toBeGreaterThanOrEqual(1);
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('handles all candidates failing validation', async () => {
      mockCodeValidatorValidate.mockReturnValue({
        valid: false,
        errors: ['syntax error'],
        cleanedCode: '',
      });
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0, issues: ['All candidates failed'] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        _disableIterationExtension: true,
        tolerateErrors: true,
      });

      expect(result.finalScore).toBe(0);
    });
  });

  // ─── Organism Mode ──────────────────────────────────────────────────

  describe('run() — organism mode', () => {
    it('delegates to runOrganismMode when mode is organism', async () => {
      const result = await RalphLoop.run('create generative art', {
        mode: 'organism',
        traits: { bpm: 120, palette: 'warm' },
      });

      expect(mockRunOrganismMode).toHaveBeenCalledOnce();
      expect(result.code).toBe('organism-code');
      expect(result.completed).toBe(true);
    });
  });

  // ─── Ambiguity Detection ────────────────────────────────────────────

  describe('run() — ambiguity detection', () => {
    it('warns about high-priority ambiguity issues', async () => {
      mockAmbiguityDetect.mockReturnValue([
        { type: 'vague', severity: 'high', description: 'Prompt is too vague' },
      ]);
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create something cool', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'RalphLoop',
        expect.stringContaining('high-priority ambiguity')
      );
    });

    it('does not warn for low-priority issues', async () => {
      mockAmbiguityDetect.mockReturnValue([
        { type: 'style', severity: 'low', description: 'Consider specifying style' },
      ]);
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        'RalphLoop',
        expect.stringContaining('high-priority ambiguity')
      );
    });
  });

  // ─── Swarm Mode Warning ─────────────────────────────────────────────

  describe('run() — swarm mode warning', () => {
    it('warns when using swarm with non-Ollama provider', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useSwarm: true,
        _disableIterationExtension: true,
      });

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'RalphLoop',
        expect.stringContaining('Swarm mode is designed for Ollama')
      );
    });
  });

  // ─── Validation Failure Path ────────────────────────────────────────

  describe('run() — candidate validation', () => {
    it('skips invalid candidates and continues', async () => {
      let generateCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        generateCall++;
        if (generateCall <= 1) {
          return {
            code: 'this is not valid code {{{{',
            thinking: 'bad',
            model: 'test',
          };
        }
        return {
          code: 'function setup() {} function draw() {}',
          thinking: 'good',
          model: 'test',
        };
      });

      let validateCall = 0;
      mockCodeValidatorValidate.mockImplementation((code: string) => {
        validateCall++;
        if (validateCall <= 1) {
          return { valid: false, errors: ['syntax error'], cleanedCode: '' };
        }
        return {
          valid: true,
          errors: [],
          cleanedCode: 'function setup() {} function draw() {}',
        };
      });

      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      // Override successRateTracker to not interfere with numCandidates
      mockSuccessRateTrackerGetRecommended.mockReturnValue(2);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        numCandidates: 2,
        _disableIterationExtension: true,
        tolerateErrors: true,
      });

      expect(result.completed).toBe(true);
    });
  });

  // ─── Score Tracking ─────────────────────────────────────────────────

  describe('run() — score tracking', () => {
    it('tracks finalScore from last evaluation', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.88, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(result.finalScore).toBe(0.88);
    });

    it('records thinking and model from generation', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });
      mockGeneratorGenerate.mockResolvedValue({
        code: 'function setup() {} function draw() {}',
        thinking: 'I used creative patterns',
        model: 'gpt-4',
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(result.thinking).toBe('I used creative patterns');
      expect(result.model).toBe('gpt-4');
    });
  });

  // ─── Event Bus Emissions ────────────────────────────────────────────

  describe('run() — event bus', () => {
    it('emits PROCESS_START and PROCESS_END events', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(mockEventBusEmit).toHaveBeenCalledWith('PROCESS_START', 'RalphLoop', expect.any(Object));
      expect(mockEventBusEmit).toHaveBeenCalledWith('PROCESS_END', 'RalphLoop', expect.objectContaining({
        process: 'ralph-loop',
      }));
    });
  });

  // ─── Multiple Candidates (Best-of-N) ────────────────────────────────

  describe('run() — best-of-N candidates', () => {
    it('selects the best candidate when multiple are generated', async () => {
      let genCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        genCall++;
        return {
          code: `function setup() { /* candidate ${genCall} */ } function draw() {}`,
          thinking: `thinking-${genCall}`,
          model: `model-${genCall}`,
        };
      });

      let scoreCall = 0;
      mockScoringEngineScore.mockImplementation(async () => {
        scoreCall++;
        return { score: scoreCall === 2 ? 0.9 : 0.5, issues: [] };
      });

      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.9, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        numCandidates: 2,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
      expect(result.finalScore).toBe(0.9);
    });
  });

  // ─── Iteration Extension ────────────────────────────────────────────

  describe('run() — iteration extension', () => {
    it('extends max iterations at iteration 3 if score is low', async () => {
      let scoreCallCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCallCount++;
        // Low but varying scores up to iteration 3, then high
        // 0.30, 0.35, 0.38 — enough variation to avoid convergence
        if (scoreCallCount <= 3) return { score: 0.25 + scoreCallCount * 0.04, issues: [] };
        return { score: 0.92, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 4,
        minQualityScore: 0.1, // Low enough to not trigger quality gate
        _disableIterationExtension: false, // Enable iteration extension
      });

      // The loop should have been extended and eventually completed
      expect(result.iterations).toBeGreaterThanOrEqual(4);
    });

    it('does not extend if _disableIterationExtension is true', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        // Scores: 0.30, 0.35, 0.40, 0.45 — vary to avoid convergence
        return { score: 0.25 + callCount * 0.05, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 4,
        _disableIterationExtension: true,
        minQualityScore: 0.1, // Low enough to not trigger quality gate
      });

      // Should stop at 4, no extension
      expect(result.iterations).toBe(4);
    });
  });

  // ─── Context Injection ──────────────────────────────────────────────

  describe('run() — context injection', () => {
    it('builds context for injection on each iteration', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      expect(mockBuildContextForInjection).toHaveBeenCalled();
      expect(mockPromptStoreInjectContext).toHaveBeenCalled();
    });

    it('appends context manually if injectContext returns unchanged prompt', async () => {
      mockPromptStoreInjectContext.mockReturnValue('loaded-prompt-content');
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      // The prompt should have been enhanced even when injectContext didn't change it
      expect(mockEnhancePrompt).toHaveBeenCalled();
    });
  });

  // ─── Incomplete Code Continuation ───────────────────────────────────

  describe('run() — incomplete code forces continuation', () => {
    it('logs when code is incomplete and forces another iteration', async () => {
      // First: incomplete code, second: complete code with high score
      let genCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        genCall++;
        if (genCall === 1) {
          return { code: 'function setup() {', thinking: 't1', model: 'm1' };
        }
        return { code: 'function setup() {} function draw() {}', thinking: 't2', model: 'm2' };
      });

      mockCodeValidatorValidate.mockImplementation((code: string) => ({
        valid: true,
        errors: [],
        cleanedCode: code,
      }));

      let scoreCall = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCall++;
        return { score: scoreCall === 1 ? 0.5 : 0.92, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        _disableIterationExtension: true,
      });

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'RalphLoop',
        expect.stringContaining('Code incomplete')
      );
    });
  });

  // ─── Null Options ───────────────────────────────────────────────────

  describe('run() — null options', () => {
    it('runs with null options using defaults', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', null);

      expect(result).toBeTruthy();
      expect(result.code).toBeTruthy();
    });
  });
});
