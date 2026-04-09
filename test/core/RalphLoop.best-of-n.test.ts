/**
 * Tests for RalphLoop Best-of-N generation feature
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RalphLoop } from '../../src/core/RalphLoop.js';
import { ContextAccumulation } from '../../src/core/ContextAccumulation.js';

// Track calls for verification
const callTracker = {
  generateCalls: 0,
  scoreCalls: 0,
  generateResults: [] as string[],
  scoreInputs: [] as string[],
};

// Mock with stateful behavior controlled via module-level vars
let generateSequence: Array<{ code: string; error?: boolean }> = [];
let scoreSequence: Array<{ score: number; error?: boolean }> = [];
let validateFailures = new Set<number>();
let currentGenerateCall = 0;
let currentScoreCall = 0;

// Mock dependencies
vi.mock('../../src/core/PromptStore.js', () => ({
  PromptStore: {
    load: vi.fn(() => 'Test prompt'),
    injectContext: vi.fn((prompt) => prompt),
  },
}));

vi.mock('../../src/core/GenerationOrchestrator.js', () => ({
  GenerationOrchestrator: vi.fn(function() {
    return {
      generate: vi.fn(async () => {
        callTracker.generateCalls++;
        const idx = currentGenerateCall++;
        const result = generateSequence[idx] || { code: 'Default code' };
        if (result.error) {
          throw new Error('Generation failed');
        }
        callTracker.generateResults.push(result.code);
        return { code: result.code };
      }),
    };
  }),
}));

vi.mock('../../src/core/ScoringEngine.js', () => ({
  ScoringEngine: vi.fn(function() {
    const scoreFn = vi.fn(async ({ output }: { output: string }) => {
      callTracker.scoreCalls++;
      callTracker.scoreInputs.push(output);
      const idx = currentScoreCall++;
      const result = scoreSequence[idx] || { score: 0.7 };
      if (result.error) {
        throw new Error('Scoring failed');
      }
      return { score: result.score, issues: [] };
    });
    return {
      score: scoreFn,
      scoreReliable: scoreFn,
    };
  }),
}));

vi.mock('../../src/core/CodeValidator.js', () => ({
  CodeValidator: {
    validate: vi.fn((code: string) => {
      const idx = currentGenerateCall; // Corresponds to current generate call
      if (validateFailures.has(idx)) {
        return { valid: false, cleanedCode: '', errors: ['Syntax error'] };
      }
      return { valid: true, cleanedCode: code, errors: [] };
    }),
  },
}));

vi.mock('../../src/gallery/Gallery.js', () => ({
  Gallery: vi.fn(function() {
    return { save: vi.fn() };
  }),
}));

vi.mock('../../src/core/ContextBuilder.js', () => ({
  buildContextForInjection: vi.fn(() => 'Context'),
}));

vi.mock('../../src/core/PromptEnhancer.js', () => ({
  enhancePrompt: vi.fn((prompt) => Promise.resolve(prompt)),
}));

vi.mock('../../src/core/LoopPersistence.js', () => ({
  LoopPersistence: vi.fn(function() {
    return {
      saveIteration: vi.fn(),
      saveMergeStep: vi.fn(),
    };
  }),
}));

vi.mock('../../src/core/StagnationDetector.js', () => ({
  StagnationDetector: vi.fn(function() {
    return {
      check: vi.fn(() => ({ shouldBreak: false, reason: '' })),
    };
  }),
}));

vi.mock('../../src/core/EvolutionIntegration.js', () => ({
  EvolutionIntegration: vi.fn(function() {
    return {
      update: vi.fn(() => ({ noveltyScore: 0.5, hints: '' })),
    };
  }),
}));

vi.mock('../../src/core/SafetyGuardrails.js', () => ({
  SafetyGuardrails: vi.fn(function() {
    return {
      checkAll: vi.fn(() => true),
      recordApiCall: vi.fn(),
    };
  }),
}));

vi.mock('../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: vi.fn(function() {
    this.detect = vi.fn(() => []);
  }),
}));

vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: { emit: vi.fn() },
  EventTypes: {
    PROCESS_START: 'process:start',
    PROCESS_END: 'process:end',
    LOOP_ITERATION: 'loop:iteration',
    LOOP_EVALUATION: 'loop:evaluation',
  },
}));

vi.mock('../../src/harness/MetaHarnessIntegration.js', () => ({
  metaHarness: { onGenerationComplete: vi.fn() },
}));

vi.mock('../../src/git/GitIntegration.js', () => ({
  GitIntegration: vi.fn(function() {
    return {
      startRun: vi.fn().mockResolvedValue('test-branch'),
      commitIteration: vi.fn().mockResolvedValue(undefined),
      endRun: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ enabled: false }),
    };
  }),
}));

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('RalphLoop Best-of-N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ContextAccumulation.getCurrentInstance?.()?.clear?.() ?? new ContextAccumulation().clear();
    
    // Reset trackers
    callTracker.generateCalls = 0;
    callTracker.scoreCalls = 0;
    callTracker.generateResults = [];
    callTracker.scoreInputs = [];
    
    // Reset sequences
    generateSequence = [];
    scoreSequence = [];
    validateFailures.clear();
    currentGenerateCall = 0;
    currentScoreCall = 0;
  });

  afterEach(() => {
    vi.resetAllMocks();
    ContextAccumulation.getCurrentInstance?.()?.clear?.() ?? new ContextAccumulation().clear();
  });

  it('should generate multiple candidates when numCandidates > 1', async () => {
    // Setup: 3 candidates with middle one having highest score
    generateSequence = [
      { code: 'Candidate 0 code' },
      { code: 'Candidate 1 code' },
      { code: 'Candidate 2 code' },
    ];
    scoreSequence = [
      { score: 0.6 },
      { score: 0.8 },
      { score: 0.7 },
    ];

    const result = await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    // Should generate 3 candidates
    expect(callTracker.generateCalls).toBe(3);

    // Should score 3 candidates
    expect(callTracker.scoreCalls).toBe(3);

    // Should select the best candidate (index 1 with score 0.8)
    expect(result.code).toBe('Candidate 1 code');
    expect(result.finalScore).toBe(0.8);
  });

  it('should select candidate with highest score', async () => {
    generateSequence = [
      { code: 'Low quality code' },
      { code: 'Medium quality code' },
      { code: 'High quality code' },
    ];
    scoreSequence = [
      { score: 0.3 },
      { score: 0.6 },
      { score: 0.95 },
    ];

    const result = await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    expect(result.code).toBe('High quality code');
    expect(result.finalScore).toBe(0.95);
  });

  it('should default to numCandidates=1 when not specified', async () => {
    generateSequence = [{ code: 'Single candidate' }];
    scoreSequence = [{ score: 0.7 }];

    await RalphLoop.run('test prompt', {
      maxIterations: 1,
      _disableIterationExtension: true,
    });

    expect(callTracker.generateCalls).toBe(1);
    expect(callTracker.scoreCalls).toBe(1);
  });

  it('should track selected candidate index in iteration context', async () => {
    generateSequence = [
      { code: 'First' },
      { code: 'Second' },
      { code: 'Third' },
    ];
    scoreSequence = [
      { score: 0.5 },
      { score: 0.9 },  // Highest - should be selected
      { score: 0.7 },
    ];

    const onIteration = vi.fn();

    await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      minQualityScore: 0.5,
      onIteration,
      _disableIterationExtension: true,
    });

    expect(onIteration).toHaveBeenCalled();
    const context = onIteration.mock.calls[0][0];
    expect(context.selectedCandidateIndex).toBe(1);
    expect(context.numCandidatesGenerated).toBe(3);
  });

  it('should handle validation failures in some candidates', async () => {
    generateSequence = [
      { code: 'Valid code 1' },
      { code: 'Invalid code' },
      { code: 'Valid code 2' },
    ];
    // Mark second candidate as validation failure
    validateFailures.add(2);
    
    scoreSequence = [
      { score: 0.6 },
      { score: 0.8 },
    ];

    const result = await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    // Should select the best valid candidate
    expect(result.code).toBe('Valid code 2');
    expect(result.finalScore).toBe(0.8);
  });

  it('should handle all candidates failing validation', async () => {
    generateSequence = [
      { code: 'Invalid 1' },
      { code: 'Invalid 2' },
      { code: 'Invalid 3' },
    ];
    // All fail validation
    validateFailures.add(1);
    validateFailures.add(2);
    validateFailures.add(3);

    const result = await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    expect(result.iterations).toBe(1);
    expect(result.completed).toBe(false);
  });

  it('should respect numCandidates limit and not exceed it', async () => {
    generateSequence = Array(5).fill(null).map((_, i) => ({ code: `Code ${i}` }));
    scoreSequence = Array(5).fill(null).map(() => ({ score: 0.7 }));

    await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 5,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    expect(callTracker.generateCalls).toBe(5);
  });

  it('should handle generation errors in some candidates gracefully', async () => {
    generateSequence = [
      { code: 'Good code 1' },
      { code: '', error: true },  // Second fails
      { code: 'Good code 2' },
    ];
    scoreSequence = [
      { score: 0.7 },
      { score: 0.9 },
    ];

    const result = await RalphLoop.run('test prompt', {
      maxIterations: 1,
      numCandidates: 3,
      tolerateErrors: true,
      minQualityScore: 0.5,
      _disableIterationExtension: true,
    });

    expect(callTracker.generateCalls).toBe(3);
    expect(result.code).toBe('Good code 2');
    expect(result.finalScore).toBe(0.9);
  });
});
