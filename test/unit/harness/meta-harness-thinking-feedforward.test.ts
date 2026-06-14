/**
 * B3 regression: the harness's most expensive feed-forward channel
 * (analyzeGeneratorThinking — a ~30s LLM call) must have a real downstream
 * effect, not just Logger.debug.
 *
 * Before the fix, a high-confidence "communicate better" analysis was logged and
 * discarded. The fix records it as a SUCCESSFUL `prompt` adaptation, which the
 * generation path already reads forward:
 *   harnessMemory.getSuccessfulAdaptations()
 *     -> TierBasedGenerator.getRecentAdaptations()
 *     -> PromptContext.recentAdaptations
 *     -> PromptBuilder <learned_guidance> block.
 *
 * These tests pin the MetaHarnessIntegration end of that wire: given a
 * high-confidence analysis, a successful `prompt` adaptation carrying the
 * "how to communicate better" guidance is recorded; low-confidence analyses are
 * NOT fed forward. Boundaries (harnessMemory persistence, the LLM call,
 * failure/provider config) are mocked; MetaHarnessIntegration is the unit under
 * test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockRecordAdaptation,
  mockRecordEpisode,
  mockGenerate,
} = vi.hoisted(() => ({
  mockRecordAdaptation: vi.fn(() => 'adapt_id'),
  mockRecordEpisode: vi.fn(() => 'ep_id'),
  mockGenerate: vi.fn(),
}));

// Keep the insight-trace write hermetic (no real ~/.sinter pollution).
vi.mock('node:fs/promises', () => ({
  default: { mkdir: vi.fn(async () => undefined), writeFile: vi.fn(async () => undefined) },
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: {
    initialize: vi.fn(async () => undefined),
    shutdown: vi.fn(async () => undefined),
    getStatus: vi.fn(() => ({ tasksTotal: 0, adaptationsTotal: 0, episodesTotal: 0 })),
    recordEpisode: mockRecordEpisode,
    recordAdaptation: mockRecordAdaptation,
    recordPatternOccurrence: vi.fn(),
  },
}));

vi.mock('../../../src/harness/FailureLogger.js', () => ({
  failureLogger: {
    getRecentFailures: vi.fn(() => []),
    getSessionId: vi.fn(() => 'session'),
    log: vi.fn(),
  },
}));

vi.mock('../../../src/harness/PatternDetector.js', () => ({
  patternDetector: {
    analyze: vi.fn(() => []),
    getHighImpactPatterns: vi.fn(() => []),
  },
}));

vi.mock('../../../src/harness/MultiProviderConfig.js', () => ({
  getActiveProvider: vi.fn(() => 'glm'),
  getActiveProviderConfig: vi.fn(() => ({ baseUrl: 'https://api.z.ai/v1', model: 'glm' })),
  getHarnessProviderConfig: vi.fn(() => ({ baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M3' })),
  listConfiguredProviders: vi.fn(() => ['glm']),
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    static loadRoles = vi.fn(async () => undefined);
    generate = mockGenerate;
  },
}));

import { MetaHarnessIntegration } from '../../../src/harness/MetaHarnessIntegration.js';

const HIGH_CONF_ANALYSIS = JSON.stringify({
  whereWentWrong: 'generator assumed a 2D context',
  howToCommunicateBetter: 'state explicitly that the canvas is WebGL',
  systemImprovement: 'add a WebGL note to the p5 prompt template',
  confidence: 0.9,
});

const LOW_CONF_ANALYSIS = JSON.stringify({
  whereWentWrong: 'unclear',
  howToCommunicateBetter: 'maybe add an example',
  systemImprovement: 'consider clearer wording',
  confidence: 0.5,
});

function generationResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    model: 'glm',
    domain: 'p5',
    prompt: 'a flow field',
    duration: 1200,
    thinking: 'I will use createCanvas without WEBGL...',
    ...overrides,
  };
}

describe('MetaHarnessIntegration thinking feed-forward (B3)', () => {
  let harness: MetaHarnessIntegration;

  beforeEach(() => {
    mockRecordAdaptation.mockClear();
    mockRecordEpisode.mockClear();
    mockGenerate.mockReset();
    harness = new MetaHarnessIntegration();
  });

  it('records the high-confidence guidance as a SUCCESSFUL prompt adaptation (fed forward)', async () => {
    mockGenerate.mockResolvedValue({ success: true, code: HIGH_CONF_ANALYSIS });

    await harness.onGenerationComplete(generationResult());

    expect(mockRecordAdaptation).toHaveBeenCalledTimes(1);
    expect(mockRecordAdaptation).toHaveBeenCalledWith({
      patternName: 'thinking-analysis:p5',
      patternSeverity: 'low',
      fixType: 'prompt',
      description: 'state explicitly that the canvas is WebGL',
      success: true,
    });
  });

  it('does NOT feed forward when confidence is at/below the 0.8 threshold', async () => {
    mockGenerate.mockResolvedValue({ success: true, code: LOW_CONF_ANALYSIS });

    await harness.onGenerationComplete(generationResult());

    expect(mockRecordAdaptation).not.toHaveBeenCalled();
  });

  it('falls back to systemImprovement when howToCommunicateBetter is absent', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      code: JSON.stringify({
        whereWentWrong: 'x',
        systemImprovement: 'tighten the contrast instruction',
        confidence: 0.95,
      }),
    });

    await harness.onGenerationComplete(generationResult());

    expect(mockRecordAdaptation).toHaveBeenCalledWith(
      expect.objectContaining({
        fixType: 'prompt',
        success: true,
        description: 'tighten the contrast instruction',
      }),
    );
  });

  it('does not analyze (no adaptation) when the generation carried no thinking', async () => {
    await harness.onGenerationComplete(generationResult({ thinking: undefined }));

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockRecordAdaptation).not.toHaveBeenCalled();
  });
});
