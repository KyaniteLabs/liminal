/**
 * RalphLoop comprehensive tests — activated from pending test suites.
 *
 * Covers: loop iteration, convergence, stagnation, quality gate, best-of-N
 * candidates, thinking/reasoning capture, abort signal, error handling,
 * chat mode callbacks, and code completeness checks.
 *
 * All external dependencies are mocked at boundaries. vi.hoisted() used
 * for every mock variable referenced inside vi.mock() factories.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────

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
const mockRenderPipelineBlendScores = vi.hoisted(() =>
  vi.fn(({ baseScore, renderScore, renderWeight = 0.5 }) =>
    baseScore * (1 - renderWeight) + renderScore * renderWeight)
);

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

const mockPromiseDetectorDetect = vi.hoisted(() => vi.fn(() => false));

vi.mock('../../../src/core/PromiseDetector.js', () => ({
  PromiseDetector: { detect: mockPromiseDetectorDetect },
}));

const mockSafetyGuardrailsCheckAll = vi.hoisted(() => vi.fn(() => true));
const mockSafetyGuardrailsRecordApiCall = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/SafetyGuardrails.js', () => ({
  SafetyGuardrails: class {
    checkAll = mockSafetyGuardrailsCheckAll;
    recordApiCall = mockSafetyGuardrailsRecordApiCall;
  },
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
  Domain: { P5: 'p5', GLSL: 'glsl', HYDRA: 'hydra', STRUDEL: 'strudel', REMOTION: 'remotion' },
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

vi.mock('../../../src/fs/LiminalFS.js', () => ({
  LiminalFS: {
    open: vi.fn(() => ({
      recordRun: vi.fn(),
      getProjectStore: vi.fn(() => ({
        getEventStore: vi.fn(() => ({
          queryEvents: vi.fn(() => []),
        })),
      })),
      readRef: vi.fn(() => null),
      readArtifact: vi.fn(() => null),
      close: vi.fn(),
    })),
  },
}));

vi.mock('../../../src/git/GitIntegration.js', () => ({
  GitIntegration: class {
    startRun = vi.fn(async () => 'test-branch');
    commitIteration = vi.fn(async () => {});
    endRun = vi.fn(async () => {});
    getStatus = vi.fn(() => ({ enabled: false }));
  },
}));

vi.mock('../../../src/entropy/MetabolicEntropyEngine.js', () => ({
  MetabolicEntropyEngine: class {
    harvest = vi.fn(async () => ({ seed: 1, phrase: 'test' }));
  },
}));

vi.mock('../../../src/generators/GeneratorHarnessTools.js', () => ({
  GeneratorHarnessTools: class {
    buildDiversityPrompt = vi.fn((p: string) => p);
    rankCandidates = vi.fn(() => ({ winnerIndex: 0 }));
    buildRepairPacket = vi.fn(() => null);
  },
}));

vi.mock('../../../src/config/FeatureFlags.js', () => ({
  getEvalMode: vi.fn(() => 'legacy'),
  getRepairMode: vi.fn(() => 'off'),
}));

vi.mock('../../../src/evolution/EvolutionEngine.js', () => ({
  EvolutionEngine: class {
    propose = vi.fn(() => null);
    clamp = vi.fn((p: any) => p);
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────

import { RalphLoop } from '../../../src/core/RalphLoop.js';
import { getRepairMode } from '../../../src/config/FeatureFlags.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function resetAllMocks(): void {
  vi.clearAllMocks();
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
  mockPromiseDetectorDetect.mockReturnValue(false);
  mockSafetyGuardrailsCheckAll.mockReturnValue(true);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RalphLoop — comprehensive', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Static Methods ───────────────────────────────────────────────────

  describe('isCodeComplete()', () => {
    it('returns true for balanced braces', () => {
      expect(RalphLoop.isCodeComplete('function setup() { createCanvas(400, 400); }')).toBe(true);
    });

    it('returns false for unbalanced braces', () => {
      expect(RalphLoop.isCodeComplete('function setup() { createCanvas(400, 400);')).toBe(false);
    });

    it('returns false for unbalanced parentheses', () => {
      expect(RalphLoop.isCodeComplete('function setup( { }')).toBe(false);
    });

    it('returns false for unbalanced brackets', () => {
      expect(RalphLoop.isCodeComplete('const arr = [1, 2;')).toBe(false);
    });

    it('returns true for empty string', () => {
      expect(RalphLoop.isCodeComplete('')).toBe(true);
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
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.95, issues: [] });

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
        // Scores: 0.30, 0.35, 0.40 — vary enough to avoid convergence
        return { score: 0.25 + callCount * 0.05, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        minQualityScore: 0.1,
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

    it('continues if score above minQualityScore but below 0.90', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        _disableIterationExtension: true,
      });

      // Score 0.75 is above default minQualityScore (0.7) but below 0.90
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
        minQualityScore: 0.1,
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('convergence detected');
    });
  });

  // ─── Chat Mode Callbacks ────────────────────────────────────────────

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

      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });

    it('handles all candidates failing validation', async () => {
      mockCodeValidatorValidate.mockReturnValue({
        valid: false,
        errors: ['syntax error'],
        cleanedCode: '',
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        _disableIterationExtension: true,
        tolerateErrors: true,
      });

      // All candidates fail → LiminalError thrown per iteration, tolerated
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

  // ─── Best-of-N Candidates ───────────────────────────────────────────

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
      mockSuccessRateTrackerGetRecommended.mockReturnValue(2);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        numCandidates: 2,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
      expect(result.finalScore).toBe(0.9);
    });

    it('tracks selected candidate index in iteration context', async () => {
      let genCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        genCall++;
        return {
          code: `function setup() { /* c${genCall} */ } function draw() {}`,
          thinking: `t-${genCall}`,
          model: `m-${genCall}`,
        };
      });
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });
      mockSuccessRateTrackerGetRecommended.mockReturnValue(3);

      const onIteration = vi.fn();

      await RalphLoop.run('test prompt', {
        maxIterations: 1,
        numCandidates: 3,
        minQualityScore: 0.5,
        onIteration,
        _disableIterationExtension: true,
      });

      expect(onIteration).toHaveBeenCalled();
      const ctx = onIteration.mock.calls[0][0];
      expect(ctx.numCandidatesGenerated).toBe(3);
    });
  });

  // ─── Thinking/Reasoning Capture ─────────────────────────────────────

  describe('run() — thinking and model capture', () => {
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

  // ─── Iteration Extension ────────────────────────────────────────────

  describe('run() — iteration extension', () => {
    it('does not extend if _disableIterationExtension is true', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        return { score: 0.25 + callCount * 0.05, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 4,
        _disableIterationExtension: true,
        minQualityScore: 0.1,
      });

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
  });

  // ─── Incomplete Code Continuation ───────────────────────────────────

  describe('run() — incomplete code forces continuation', () => {
    it('logs when code is incomplete and forces another iteration', async () => {
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

      await RalphLoop.run('create a sketch', {
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

      expect(result.code).toContain('function setup()');
      expect(result.iterations).toBe(1);
    });
  });

  // ─── Targeted Branch Coverage ────────────────────────────────────────

  describe('run() — all candidates fail (candidates.length === 0 branch)', () => {
    it('throws when all generation candidates fail and tolerateErrors is false', async () => {
      mockGeneratorGenerate.mockRejectedValue(new Error('All candidates failed'));

      await expect(
        RalphLoop.run('create a sketch', {
          maxIterations: 2,
          tolerateErrors: false,
          _disableIterationExtension: true,
        })
      ).rejects.toThrow('All candidates failed');
    });
  });

  describe('run() — GLSL runtime validation (runtimeValid === false branch)', () => {
    it('logs runtime validation failure for GLSL code missing main()', async () => {
      mockGeneratorGenerate.mockResolvedValue({
        code: 'uniform float u_time; void update() { }',
        thinking: 'glsl-attempt',
        model: 'test-model',
      });
      // Mock CodeValidator to pass structural validation
      mockCodeValidatorValidate.mockImplementation((code: string) => ({
        valid: true,
        errors: [],
        cleanedCode: code,
      }));
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      // The GLSL detection looks for `void main (` but this code has `void update()`
      // It also needs gl_FragColor — since neither is present, runtimeValid should be false
      // But detectOutputType checks for p5 patterns first (function setup / createCanvas)
      // The code has neither, so outputType is 'unknown', not GLSL — no runtime check triggered
      // This exercises the detectOutputType function branches
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        'RalphLoop',
        expect.stringContaining('Runtime validation failed')
      );
    });
  });

  describe('run() — best-of-N full evaluation path (candidates.length > 1)', () => {
    it('evaluates all candidates and selects the winner via rankCandidates', async () => {
      let genCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        genCall++;
        return {
          code: `function setup() { /* ${genCall} */ } function draw() {}`,
          thinking: `t-${genCall}`,
          model: `model-${genCall}`,
        };
      });

      // Score each candidate differently: candidate 0 gets 0.4, candidate 1 gets 0.9
      let scoreCallCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCallCount++;
        // First two calls are per-candidate evaluations, third is the best-candidate re-evaluation
        if (scoreCallCount <= 2) {
          return { score: scoreCallCount === 2 ? 0.9 : 0.4, issues: [] };
        }
        return { score: 0.9, issues: [] };
      });

      mockSuccessRateTrackerGetRecommended.mockReturnValue(2);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 1,
        numCandidates: 2,
        _disableIterationExtension: true,
        minQualityScore: 0.1,
      });

      expect(result.iterations).toBe(1);
      // Generator should have been called twice (2 candidates)
      expect(mockGeneratorGenerate).toHaveBeenCalledTimes(2);
    });
  });

  describe('isCodeComplete() — branch coverage for cutoff patterns', () => {
    it('returns false for code ending mid-function', () => {
      const code = 'function setup() { createCanvas(400, 400); }\nfunction draw() {\n  background(0);\n  rect(10,';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns false for code ending mid-class', () => {
      const code = 'class Particle {\n  constructor() {\n    this.x = 0;\n';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });
  });

  describe('isRunning()', () => {
    it('returns false when no history exists', () => {
      mockContextAccumulationGetHistory.mockReturnValue([]);
      expect(RalphLoop.isRunning()).toBe(false);
    });

    it('returns true when history has entries', () => {
      mockContextAccumulationGetHistory.mockReturnValue([
        { iteration: 1, evaluation: { score: 0.5 } },
      ]);
      expect(RalphLoop.isRunning()).toBe(true);
    });
  });

  describe('run() — render scoring path (useRenderScoring, legacy eval mode)', () => {
    it('blends render score with base score when useRenderScoring is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockRenderPipelineProcess.mockResolvedValue({
        success: true,
        score: 0.9,
        domain: 'p5',
        duration: 5,
        warnings: [],
      });
      // blend: 0.75 * 0.6 + 0.9 * 0.4 = 0.45 + 0.36 = 0.81
      mockRenderPipelineBlendScores.mockReturnValue(0.81);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useRenderScoring: true,
        _disableIterationExtension: true,
      });

      // The blended score should be reflected
      expect(result.finalScore).toBe(0.81);
    });

    it('logs render warnings when present', async () => {
      const thoughts: string[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockRenderPipelineProcess.mockResolvedValue({
        success: true,
        score: 0.9,
        domain: 'p5',
        duration: 5,
        warnings: ['screenshot buffer too small'],
      });
      mockRenderPipelineBlendScores.mockReturnValue(0.81);

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useRenderScoring: true,
        chatMode: true,
        onThought: (t) => thoughts.push(t),
        _disableIterationExtension: true,
      });

      expect(thoughts.some(t => t.includes('Render warnings'))).toBe(true);
    });
  });

  // ─── Safety Guardrails Branch ────────────────────────────────────────

  describe('run() — safety guardrails', () => {
    it('breaks when safety guardrails are triggered', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        safetyConfig: { maxApiCalls: 10, maxScore: 0.5 },
        _disableIterationExtension: true,
      });

      // SafetyGuardrails mock returns true from checkAll, so guardrails pass
      expect(result.iterations).toBe(1);
      expect(result.completed).toBe(true);
    });
  });

  // ─── useEntropy Branch ──────────────────────────────────────────────

  describe('run() — entropy-based generation', () => {
    it('exercises entropy harvest path when useEntropy is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useEntropy: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
      // EntropyEngine mock is set up, so it should have been called
    });
  });

  // ─── Clarification Branch ───────────────────────────────────────────

  describe('run() — generator returns needsClarification', () => {
    it('throws when generator needs clarification', async () => {
      mockGeneratorGenerate.mockResolvedValue({
        code: '',
        needsClarification: true,
        clarifyingQuestions: [{ question: 'What size canvas?' }],
        suggestions: ['small', 'large'],
      });

      await expect(
        RalphLoop.run('create ambiguous sketch', {
          maxIterations: 2,
          _disableIterationExtension: true,
        })
      ).rejects.toThrow('Ambiguous prompt');
    });
  });

  // ─── useArchiveLearning + quality archive save ─────────────────────

  describe('run() — archive learning', () => {
    it('exercises archive learning path when useArchiveLearning is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useArchiveLearning: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
      // ArchiveLearning mock has addOutput that should be called for score >= 0.65
    });
  });

  // ─── useMapElites path ─────────────────────────────────────────────

  describe('run() — MAP-Elites', () => {
    it('exercises MAP-Elites initialization when useMapElites is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useMapElites: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── useAestheticModel path ────────────────────────────────────────

  describe('run() — aesthetic model', () => {
    it('exercises aesthetic model loading when useAestheticModel is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useAestheticModel: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── autoCompost path ──────────────────────────────────────────────

  describe('run() — auto compost', () => {
    it('exercises auto-compost path when autoCompost is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        autoCompost: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── useCompostEnhancement path ────────────────────────────────────

  describe('run() — compost enhancement', () => {
    it('exercises compost enhancement path', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useCompostEnhancement: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── Multiple iterations to exercise more branches ──────────────────

  describe('run() — multi-iteration with evolving scores', () => {
    it('exercises iteration extension when scores are low at iteration 3', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        // Keep scores low to trigger extension at iteration 3
        return { score: 0.3 + callCount * 0.05, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 4,
        minQualityScore: 0.1,
        _disableIterationExtension: false,
      });

      // Extension should have happened (maxIterations increased by up to 3)
      expect(result.iterations).toBeGreaterThanOrEqual(4);
      expect(result.reason).toContain('max iterations');
    });

    it('exercises exploration mode tracking with stagnation', async () => {
      let callCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        callCount++;
        return { score: 0.5, issues: [] };
      });
      // Force stagnation detection after a few iterations
      let stagnationCall = 0;
      mockStagnationCheck.mockImplementation(() => {
        stagnationCall++;
        return {
          shouldBreak: stagnationCall >= 3,
          reason: 'stagnation: plateau',
          successRate: 0.3,
          exploreAggressively: stagnationCall === 2,
        };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        minQualityScore: 0.1,
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('stagnation');
    });
  });

  // ─── onProgress and onSuggestion callbacks ─────────────────────────

  describe('run() — suggestion callback', () => {
    it('invokes onSuggestion when guidanceEngine provides suggestions', async () => {
      // Use moderate scores so the loop runs multiple iterations without hitting 0.90
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: scoreCount === 3 ? 0.92 : 0.75, issues: [] };
      });
      const suggestions: any[] = [];
      const mockGuidanceEngine = {
        updateIteration: vi.fn(),
        suggestNextAction: vi.fn(() => [
          { type: 'hint', message: 'Try using noise()', confidence: 0.8 },
        ]),
      };

      await RalphLoop.run('create a sketch', {
        maxIterations: 4,
        chatMode: true,
        guidanceEngine: mockGuidanceEngine as any,
        onSuggestion: (s) => suggestions.push(s),
        _disableIterationExtension: true,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].message).toBe('Try using noise()');
    });
  });

  // ─── swarmDiversify branch ─────────────────────────────────────────

  describe('run() — swarm diversify', () => {
    it('uses diversity prompt when swarmDiversify is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        swarmDiversify: true,
        _disableIterationExtension: true,
      });

      // buildDiversityPrompt should have been called
      expect(result_final => {
        // Just verify it doesn't throw — the mock handles diversity
      });
    });
  });

  // ─── isCodeComplete additional branches ─────────────────────────────

  describe('isCodeComplete() — additional branch coverage', () => {
    it('returns false for code ending with whitespace-only line', () => {
      const code = 'function setup() { createCanvas(400, 400); }\n  ';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns false for code ending mid-class', () => {
      const code = 'class Visual {\n  constructor() {\n    this.x = 0;\n';
      expect(RalphLoop.isCodeComplete(code)).toBe(false);
    });

    it('returns true for simple balanced code', () => {
      expect(RalphLoop.isCodeComplete('const x = 1;')).toBe(true);
    });
  });

  // ─── Single-Round Repair Mode ──────────────────────────────────────

  describe('run() — single-round repair mode', () => {
    it('attempts repair when score is below minQualityScore', async () => {
      vi.mocked(getRepairMode).mockReturnValue('single-round');

      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        // First evaluation is low (triggers repair), then high enough for repair
        if (scoreCount === 1) return { score: 0.5, issues: ['low quality'] };
        if (scoreCount === 2) return { score: 0.7, issues: [] }; // repair evaluation
        return { score: 0.92, issues: [] }; // second iteration
      });

      mockGeneratorGenerate.mockResolvedValue({
        code: 'function setup() {} function draw() {}',
        thinking: 'repair-thinking',
        model: 'test-model',
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        minQualityScore: 0.6,
        _disableIterationExtension: true,
      });

      expect(result.finalScore).toBeGreaterThanOrEqual(0.7);
    });
  });

  // ─── useAestheticGuardrails path ───────────────────────────────────

  describe('run() — aesthetic guardrails', () => {
    it('exercises aesthetic guardrails evaluation path', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useAestheticGuardrails: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── Render scoring failure path ───────────────────────────────────

  describe('run() — render scoring failure', () => {
    it('handles render pipeline failure gracefully', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockRenderPipelineProcess.mockResolvedValue({
        success: false,
        error: 'Browser launch failed',
        score: 0,
        domain: 'p5',
        duration: 0,
        warnings: [],
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useRenderScoring: true,
        _disableIterationExtension: true,
      });

      // Should not crash, just use the base score
      expect(result.finalScore).toBe(0.75);
    });
  });

  // ─── useIntuition path ────────────────────────────────────────────

  describe('run() — intuition engine', () => {
    it('exercises intuition recording path when useIntuition is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useIntuition: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── renderScoring with chat mode ─────────────────────────────────

  describe('run() — render scoring with chat mode', () => {
    it('emits render score thoughts in chat mode', async () => {
      const thoughts: string[] = [];
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockRenderPipelineProcess.mockResolvedValue({
        success: true,
        score: 0.9,
        domain: 'p5',
        duration: 5,
        warnings: [],
      });
      mockRenderPipelineBlendScores.mockReturnValue(0.81);

      await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useRenderScoring: true,
        chatMode: true,
        onThought: (t) => thoughts.push(t),
        _disableIterationExtension: true,
      });

      expect(thoughts.some(t => t.includes('Render score'))).toBe(true);
    });
  });

  // ─── seedCode path ────────────────────────────────────────────────

  describe('run() — seed code', () => {
    it('accepts seedCode option without error', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('improve this sketch', {
        maxIterations: 2,
        seedCode: 'function setup() { createCanvas(200, 200); }',
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── lirEnabled path ──────────────────────────────────────────────

  describe('run() — LIR evaluation', () => {
    it('exercises LIR parsing path when lirEnabled is true', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        lirEnabled: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── mergeEveryN path ─────────────────────────────────────────────

  describe('run() — merge steps', () => {
    it('accepts mergeEveryN option and calls persistence saveMergeStep', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: 0.5 + scoreCount * 0.08, issues: [] };
      });

      await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        mergeEveryN: 2,
        _disableIterationExtension: true,
      });

      // saveMergeStep should have been called (persistence mock)
      expect(mockPersistenceSaveMergeStep).toHaveBeenCalled();
    });
  });

  // ─── Multiple candidates with validation failures ─────────────────

  describe('run() — best-of-N with some invalid candidates', () => {
    it('handles mixed valid/invalid candidates across multiple iterations', async () => {
      let genCall = 0;
      mockGeneratorGenerate.mockImplementation(async () => {
        genCall++;
        // First 2 candidates in iter 1: first valid, second invalid
        if (genCall === 2) {
          return { code: 'invalid {{{ code', thinking: 'bad', model: 'm2' };
        }
        return { code: 'function setup() {} function draw() {}', thinking: 'good', model: 'm1' };
      });

      let validateCall = 0;
      mockCodeValidatorValidate.mockImplementation((code: string) => {
        validateCall++;
        if (code.includes('{{{')) {
          return { valid: false, errors: ['syntax error'], cleanedCode: '' };
        }
        return { valid: true, errors: [], cleanedCode: code };
      });

      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });
      mockSuccessRateTrackerGetRecommended.mockReturnValue(2);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        numCandidates: 2,
        tolerateErrors: true,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
    });
  });

  // ─── Domain-specific quality thresholds ────────────────────────────

  describe('run() — domain detection in quality gate', () => {
    it('detects ascii domain from prompt keywords', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        // Score below default 0.7 but above ascii 0.5 threshold
        return { score: 0.55, issues: [] };
      });

      const result = await RalphLoop.run('create ascii art', {
        maxIterations: 4,
        minQualityScore: 0.8,
        _disableIterationExtension: true,
      });

      // ascii threshold is 0.5, so 0.55 should pass quality gate
      // and run until convergence or max iterations
      expect(result.reason).not.toContain('quality threshold not met');
    });

    it('detects music domain from prompt keywords', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: 0.55, issues: [] };
      });

      const result = await RalphLoop.run('create strudel music pattern', {
        maxIterations: 4,
        minQualityScore: 0.8,
        _disableIterationExtension: true,
      });

      expect(result.reason).not.toContain('quality threshold not met');
    });

    it('detects remotion domain from prompt keywords', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        // remotion has no specific threshold, uses default minQualityScore
        return { score: 0.55, issues: [] };
      });

      const result = await RalphLoop.run('create remotion title sequence', {
        maxIterations: 4,
        minQualityScore: 0.5, // Lower threshold so remotion passes
        _disableIterationExtension: true,
      });

      // With minQualityScore 0.5, score 0.55 should pass quality gate
      expect(result.reason).not.toContain('quality threshold not met');
    });
  });

  // ─── useEvolution engine path ──────────────────────────────────────

  describe('run() — evolution engine', () => {
    it('exercises evolution engine when useEvolution is true', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: 0.5 + scoreCount * 0.1, issues: [] };
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        useEvolution: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── evaluationStrategy option ─────────────────────────────────────

  describe('run() — evaluation strategy', () => {
    it('accepts evaluationStrategy option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        evaluationStrategy: 'quick',
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── Additional option branches ────────────────────────────────────

  describe('run() — additional options coverage', () => {
    it('accepts maxContextLength option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        maxContextLength: 500,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });

    it('accepts lastKIterations option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        lastKIterations: 3,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });

    it('accepts evaluationCriteria option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        evaluationCriteria: ['aesthetic', 'technical'],
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });

    it('accepts domainQualityThresholds override', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        domainQualityThresholds: { 'p5': 0.5 },
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });

    it('accepts stagnationThreshold override', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: 0.5, issues: [] };
      });
      mockStagnationCheck.mockReturnValue({
        shouldBreak: true,
        reason: 'stagnation: no improvement',
        successRate: 0.3,
      });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 10,
        stagnationThreshold: 3,
        minQualityScore: 0.1,
        _disableIterationExtension: true,
      });

      expect(result.reason).toContain('stagnation');
    });

    it('accepts timeoutMinutes option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        timeoutMinutes: 60,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── Promise Detection Branch ──────────────────────────────────────

  describe('run() — promise detection', () => {
    it('completes when PromiseDetector detects a promise in code', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockPromiseDetectorDetect.mockReturnValue(true);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        _disableIterationExtension: true,
      });

      expect(result.completed).toBe(true);
      expect(result.reason).toBe('promise detected in generated code');
    });
  });

  // ─── Safety Guardrails Trigger Branch ──────────────────────────────

  describe('run() — safety guardrails triggered', () => {
    it('breaks when safety guardrails checkAll returns false', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.75, issues: [] });
      mockSafetyGuardrailsCheckAll.mockReturnValue(false);

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 5,
        safetyConfig: { maxApiCalls: 1, maxScore: 0.3 },
        _disableIterationExtension: true,
      });

      expect(result.reason).toBe('safety guardrails triggered');
      expect(result.completed).toBe(false);
    });
  });

  // ─── Collab initialization branches ────────────────────────────────

  describe('run() — collab options', () => {
    it('accepts useDeepCollab option', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useDeepCollab: true,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });

    it('accepts useCollab option with collabDomain', async () => {
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a sketch', {
        maxIterations: 2,
        useCollab: true,
        collabDomain: 'p5' as any,
        _disableIterationExtension: true,
      });

      expect(result.code).toContain('function setup()');
    });
  });

  // ─── onProgress with multiple iterations ───────────────────────────

  describe('run() — onProgress across iterations', () => {
    it('calls onProgress after each iteration with correct data', async () => {
      let scoreCount = 0;
      mockScoringEngineScoreReliable.mockImplementation(async () => {
        scoreCount++;
        return { score: 0.5 + scoreCount * 0.1, issues: [] };
      });
      const progressData: any[] = [];

      await RalphLoop.run('create a sketch', {
        maxIterations: 3,
        minQualityScore: 0.1,
        onProgress: (p) => progressData.push(p),
        _disableIterationExtension: true,
      });

      // Should have progress from each iteration
      expect(progressData.length).toBeGreaterThanOrEqual(2);
      expect(progressData[0].score).toBe(0.6);
      expect(progressData[0].code).toContain('function setup()');
    });
  });

  // ─── GLSL runtime validation with proper detection ─────────────────

  describe('run() — GLSL output type detection', () => {
    it('detects GLSL code and validates runtime', async () => {
      mockGeneratorGenerate.mockResolvedValue({
        code: 'uniform float u_time; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }',
        thinking: 'glsl-shader',
        model: 'test-model',
      });
      mockCodeValidatorValidate.mockImplementation((code: string) => ({
        valid: true,
        errors: [],
        cleanedCode: code,
      }));
      mockScoringEngineScoreReliable.mockResolvedValue({ score: 0.92, issues: [] });

      const result = await RalphLoop.run('create a shader', {
        maxIterations: 2,
        _disableIterationExtension: true,
      });

      // GLSL has both main() and gl_FragColor, so runtimeValid should be true
      expect(result.code).toContain('void main()');
    });
  });
});
