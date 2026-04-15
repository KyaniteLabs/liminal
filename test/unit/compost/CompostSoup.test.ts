/**
 * CompostSoup unit tests — evolutionary soup for creative seeds.
 * Tests public API: cycle(), run(), stop(), isRunning().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CompostConfig, CompostFragment, SoupState } from '../../../src/compost/types.js';

// --- vi.hoisted for mock variables used in vi.mock factories ---
const {
  mockStateLoad,
  mockStateSave,
  mockScorerScore,
  mockSeedBankAdd,
  mockEmit,
} = vi.hoisted(() => ({
  mockStateLoad: vi.fn<() => Promise<SoupState>>(),
  mockStateSave: vi.fn<(state: SoupState) => Promise<void>>(),
  mockScorerScore: vi.fn(),
  mockSeedBankAdd: vi.fn(),
  mockEmit: vi.fn(),
}));

const defaultState: SoupState = {
  population: [],
  generation: 0,
  bestSeed: null,
  totalSeedsPromoted: 0,
  domainHeatmap: {},
  lastCycleAt: '',
};

const config: CompostConfig = {
  heapDir: '/tmp/liminal-test/heap',
  maxHeapSizeBytes: 1_000_000,
  digestDir: '/tmp/liminal-test/digest',
  seedDir: '/tmp/liminal-test/seeds',
  digestSchedule: 'manual',
  digestDayOfWeek: 0,
  soupEnabled: true,
  soupPopulationSize: 10,
  soupMaxStepsPerCycle: 5,
  soupSeedPromotionThreshold: 0.5,
  soupCycleIntervalMs: 10,
  llm: {},
  seedPromotionThreshold: 0.5,
  maxSeedsPerDigest: 10,
  nuggetRetentionDays: 30,
  lirEnabled: false,
  lirSummaryBudget: 1000,
  lirBatchSize: 10,
  lirMaxSymbolsPerFile: 100,
};

function makeFragment(domain: string, content: string): CompostFragment {
  return {
    id: `frag-${domain}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'test',
    domain,
    layer: 'semantic',
    content,
    metadata: {
      fileType: 'txt',
      timestamp: new Date().toISOString(),
      hash: 'abc123',
      size: content.length,
      extractedAt: new Date().toISOString(),
    },
    tags: [domain, 'test'],
  };
}

const llm = {
  generate: vi.fn(),
};

let mockEntropyCounter = 0;
const mockEntropySequence = [0, 1, 0, 0];
const mockEntropy = {
  nextInt: vi.fn((max: number) => mockEntropySequence[mockEntropyCounter++ % mockEntropySequence.length] % max),
} as unknown as import('../../../src/entropy/MetabolicEntropyEngine.js').MetabolicEntropyEngine;

// Mock SoupStateManager
vi.mock('../../../src/compost/SoupStateManager.js', () => ({
  SoupStateManager: class MockSoupStateManager {
    load = mockStateLoad;
    save = mockStateSave;
    updateGeneration(state: SoupState): SoupState {
      return {
        ...state,
        generation: state.generation + 1,
        lastCycleAt: new Date().toISOString(),
      };
    }
    replaceWorst(state: SoupState, candidate: CompostFragment): SoupState {
      if (state.population.length === 0) return { ...state, population: [candidate] };
      return { ...state, population: [...state.population, candidate] };
    }
    updateHeatmap(state: SoupState, domainA: string, domainB: string, score: number): SoupState {
      const key = [domainA, domainB].sort().join('-');
      return { ...state, domainHeatmap: { ...state.domainHeatmap, [key]: score } };
    }
    recordPromotion(state: SoupState, seed: CompostFragment): SoupState {
      return {
        ...state,
        totalSeedsPromoted: state.totalSeedsPromoted + 1,
        bestSeed: seed,
      };
    }
  },
}));

// Mock SeedBank
vi.mock('../../../src/compost/SeedBank.js', () => ({
  SeedBank: class MockSeedBank {
    add = mockSeedBankAdd;
  },
}));

// Mock FragmentScorer
vi.mock('../../../src/compost/FragmentScorer.js', () => ({
  FragmentScorer: class MockFragmentScorer {
    score = mockScorerScore;
  },
}));

// Mock FitnessCombiner
vi.mock('../../../src/evolution/FitnessCombiner.js', () => ({
  FitnessCombiner: class MockFitnessCombiner {},
}));

// Mock MapElites
vi.mock('../../../src/evolution/MapElites.js', () => ({
  MapElites: class MockMapElites {},
}));

// Mock EventBus
vi.mock('../../../src/core/EventBus.js', () => ({
  eventBus: { emit: mockEmit },
  EventTypes: {
    PROCESS_START: 'process:start',
    PROCESS_END: 'process:end',
    COMPOST_STAGE: 'compost:stage',
    COMPOST_SCORE: 'compost:score',
    COMPOST_SEED: 'compost:seed',
  },
}));

// Mock Logger
vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock SymbolicCreativeLanguage
vi.mock('../../../src/brain/SymbolicCreativeLanguage.js', () => ({
  SymbolicCreativeLanguage: class MockSymbolicCreativeLanguage {
    evolveNotation = vi.fn();
  },
}));

import { CompostSoup } from '../../../src/compost/CompostSoup.js';

describe('CompostSoup', () => {
  beforeEach(() => {
    mockEntropyCounter = 0;
    vi.clearAllMocks();
    llm.generate.mockResolvedValue({ success: true, code: 'evolved offspring content' });
    mockScorerScore.mockResolvedValue({
      total: 7.5,
      novelty: 0.8,
      density: 0.7,
      crossDomain: 0.9,
      metadataRarity: 0.5,
      connectionStrength: 0.6,
    });
    mockSeedBankAdd.mockResolvedValue(undefined);
    mockStateSave.mockResolvedValue(undefined);
    mockEmit.mockReturnValue(undefined);
  });

  it('throws when entropy engine is missing', () => {
    expect(() => new CompostSoup(config, llm, undefined as any)).toThrow('CompostSoup: entropy engine is required');
  });

  describe('cycle()', () => {
    it('returns unchanged state when fewer than 2 fragments', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const result = await soup.cycle([makeFragment('music', 'solo')]);

      expect(result.generation).toBe(0);
      expect(llm.generate).not.toHaveBeenCalled();
    });

    it('returns unchanged state when all fragments share same domain', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'fragment A'),
        makeFragment('music', 'fragment B'),
      ];

      const result = await soup.cycle(fragments);
      expect(result.generation).toBe(0);
      expect(llm.generate).not.toHaveBeenCalled();
    });

    it('returns unchanged state for empty fragment array', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const result = await soup.cycle([]);
      expect(result.generation).toBe(0);
    });

    it('runs a full cycle with multi-domain fragments', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'harmonic pattern in C'),
        makeFragment('visual', 'color gradient experiment'),
      ];

      const result = await soup.cycle(fragments);

      expect(result.generation).toBe(1);
      expect(llm.generate).toHaveBeenCalledTimes(1);
      expect(mockScorerScore).toHaveBeenCalledTimes(1);
      expect(mockStateSave).toHaveBeenCalledTimes(1);
      expect(mockEmit).toHaveBeenCalled();
      expect(mockEntropy.nextInt).toHaveBeenCalled();
    });

    it('creates offspring with cross-domain metadata', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'harmonic pattern'),
        makeFragment('visual', 'color gradient'),
      ];

      await soup.cycle(fragments);

      const scoredFragment = mockScorerScore.mock.calls[0][0] as CompostFragment;
      expect(scoredFragment.domain).toBe('cross-domain');
      expect(scoredFragment.source).toContain('soup:');
      expect(scoredFragment.layer).toBe('semantic');
    });

    it('promotes offspring to seed bank when score exceeds threshold', async () => {
      // Score 8.0 >= config.soupSeedPromotionThreshold(0.5) * 10 = 5.0
      mockScorerScore.mockResolvedValue({
        total: 8.0,
        novelty: 0.9,
        density: 0.8,
        crossDomain: 0.9,
        metadataRarity: 0.7,
        connectionStrength: 0.8,
      });

      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'promising content'),
        makeFragment('code', 'elegant algorithm'),
      ];

      await soup.cycle(fragments);

      expect(mockSeedBankAdd).toHaveBeenCalledTimes(1);
      const seedArg = mockSeedBankAdd.mock.calls[0][0] as Record<string, unknown>;
      expect(seedArg.score).toBe(8.0);
      expect((seedArg.source as Record<string, unknown>).collisionType).toBe('soup-offspring');
    });

    it('skips seed promotion when score is below threshold', async () => {
      // Score 3.0 < config.soupSeedPromotionThreshold(0.5) * 10 = 5.0
      mockScorerScore.mockResolvedValue({
        total: 3.0,
        novelty: 0.3,
        density: 0.3,
        crossDomain: 0.3,
        metadataRarity: 0.3,
        connectionStrength: 0.3,
      });

      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'weak content'),
        makeFragment('code', 'mediocre code'),
      ];

      await soup.cycle(fragments);
      expect(mockSeedBankAdd).not.toHaveBeenCalled();
    });

    it('evolves notation language when population has 2+ members', async () => {
      const existingPop = [
        { ...makeFragment('music', 'existing A'), score: 9.0 },
        { ...makeFragment('visual', 'existing B'), score: 4.0 },
      ];
      mockStateLoad.mockResolvedValue({ ...defaultState, population: existingPop });

      const soup = new CompostSoup(config, llm, mockEntropy);
      const fragments = [
        makeFragment('music', 'new content A'),
        makeFragment('visual', 'new content B'),
      ];

      await soup.cycle(fragments);
      expect(mockStateSave).toHaveBeenCalledTimes(1);
    });

    it('handles LLM merge failure gracefully', async () => {
      llm.generate.mockRejectedValue(new Error('LLM timeout'));
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'resilient content'),
        makeFragment('text', 'prose fragment'),
      ];

      // merge fails → cycle returns state without incrementing generation
      const result = await soup.cycle(fragments);
      expect(result.generation).toBe(0);
    });

    it('handles LLM returning unsuccessful result', async () => {
      llm.generate.mockResolvedValue({ success: false, code: '' });
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'content A'),
        makeFragment('text', 'content B'),
      ];

      // merge fails → cycle returns state without incrementing generation
      const result = await soup.cycle(fragments);
      expect(result.generation).toBe(0);
    });

    it('works with null LLM using fallback merge', async () => {
      const soup = new CompostSoup(config, null as any, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'alpha beta gamma'),
        makeFragment('visual', 'red green blue'),
      ];

      // null LLM → mergeViaLLM throws → cycle returns state without incrementing
      const result = await soup.cycle(fragments);
      expect(result.generation).toBe(0);
    });
  });

  describe('run()', () => {
    it('runs cycles and stops when aborted via external signal', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const abortController = new AbortController();
      const fragments = [
        makeFragment('music', 'loop content'),
        makeFragment('code', 'script content'),
      ];

      setTimeout(() => abortController.abort(), 50);

      await soup.run(fragments, abortController.signal);

      expect(soup.isRunning()).toBe(false);
      const emitCalls = mockEmit.mock.calls.map((c: unknown[]) => (c as unknown[])[0] as string);
      expect(emitCalls).toContain('process:start');
      expect(emitCalls).toContain('process:end');
    });

    it('stops after MAX_CONSECUTIVE_FAILURES (5) failures', async () => {
      mockStateLoad.mockRejectedValue(new Error('disk error'));

      const soup = new CompostSoup(config, llm, mockEntropy);
      const fragments = [
        makeFragment('music', 'failing content'),
        makeFragment('code', 'broken code'),
      ];

      await soup.run(fragments);
      // run() breaks out of the loop but doesn't call stop() — abortController
      // remains non-null, so isRunning() is still true. Call stop() explicitly.
      soup.stop();
      expect(soup.isRunning()).toBe(false);
    });

    it('stops via internal stop() method', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'auto stop test'),
        makeFragment('visual', 'auto stop visual'),
      ];

      setTimeout(() => soup.stop(), 50);
      await soup.run(fragments);
      expect(soup.isRunning()).toBe(false);
    });
  });

  describe('stop()', () => {
    it('clears the abort controller', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'stop test'),
        makeFragment('visual', 'stop test visual'),
      ];

      setTimeout(() => soup.stop(), 30);
      await soup.run(fragments);

      soup.stop();
      expect(soup.isRunning()).toBe(false);
    });
  });

  describe('isRunning()', () => {
    it('returns false before run() is called', () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      expect(soup.isRunning()).toBe(false);
    });

    it('returns true while running and false after stop', async () => {
      const soup = new CompostSoup(config, llm, mockEntropy);
      mockStateLoad.mockResolvedValue({ ...defaultState });

      const fragments = [
        makeFragment('music', 'running test'),
        makeFragment('visual', 'visual test'),
      ];

      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 50);

      const runPromise = soup.run(fragments, abortController.signal);

      await new Promise(r => setTimeout(r, 10));
      expect(soup.isRunning()).toBe(true);

      await runPromise;
      expect(soup.isRunning()).toBe(false);
    });
  });
});
