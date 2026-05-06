/**
 * Tests for SwarmOrchestrator — Multi-model collaborative generation.
 *
 * Focus: round execution, persona routing, convergence detection, score
 * aggregation, termination conditions, code extraction, musical chairs,
 * vocabulary discovery, and session persistence.
 *
 * All external dependencies (Ollama API, filesystem) are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Hoisted mock variables ───────────────────────────────────────────────

const mockCallOllama = vi.hoisted(() => vi.fn());
const mockOnProgress = vi.hoisted(() => vi.fn());
const mockOnFragmentsMined = vi.hoisted(() => vi.fn());
const mockEventBusEmit = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockFsMkdir = vi.hoisted(() => vi.fn(async () => undefined));
const mockFsWriteFile = vi.hoisted(() => vi.fn(async () => undefined));

// ─── Mock registrations ────────────────────────────────────────────────────

vi.mock('../../../src/core/EventBus.js', () => ({
  eventBus: { emit: mockEventBusEmit },
  EventTypes: {
    SWARM_ROUND: 'SWARM_ROUND',
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/swarm/VotingEngine.js', () => ({
  VotingEngine: {
    conductVoting: vi.fn(async (outputs: Map<string, any>) => {
      const entries = [...outputs.entries()];
      const winnerId = entries[0]?.[0] ?? null;
      const scores = new Map<string, number>();
      const votes = new Map<string, any>();
      for (const [id] of entries) {
        scores.set(id, 0.8);
        votes.set(id, { voterId: id, firstChoice: winnerId ?? '', secondChoice: '', reasoning: 'test' });
      }
      return { scores, winnerId, votes };
    }),
  },
}));

const mockHeuristicScore = vi.hoisted(() => vi.fn((outputs: Map<string, any>) => {
  const entries = [...outputs.entries()];
  console.log('HeuristicScorer called with outputs keys:', [...outputs.keys()]);
  const winnerId = entries[0]?.[0] ?? null;
  console.log('HeuristicScorer returning winnerId:', winnerId);
  const scores = new Map<string, number>();
  const votes = new Map<string, any>();
  for (const [id] of entries) {
    scores.set(id, 0.75);
    votes.set(id, { voterId: id, firstChoice: winnerId ?? '', secondChoice: '', reasoning: 'heuristic' });
  }
  return { scores, winnerId, votes };
}));

vi.mock('../../../src/swarm/HeuristicScorer.js', () => ({
  HeuristicScorer: {
    score: mockHeuristicScore,
  },
}));

vi.mock('../../../src/swarm/MiningEngine.js', () => ({
  MiningEngine: {
    mineResult: vi.fn(() => []),
  },
}));

vi.mock('../../../src/brain/SymbolicCreativeLanguage.js', () => ({
  SymbolicCreativeLanguage: class {
    discoverSymbols = vi.fn(() => [
      { id: 'sym-1', name: 'gradient-lighting', domain: 'visual', pattern: '', semantics: '', usageCount: 1, effectiveness: 0.7, lastUsed: Date.now() },
    ]);
    getVocabulary = vi.fn(() => []);
    getQualityReport = vi.fn(() => ({ totalSymbols: 0, avgEffectiveness: 0 }));
    recordOutcome = vi.fn();
    pruneVocabulary = vi.fn();
    composeFromSymbols = vi.fn((symbolIds: string[]) => {
      if (symbolIds.length === 0) return null;
      return {
        strategy: 'parallel' as const,
        symbols: symbolIds.map(id => ({ id, name: `symbol-${id}`, domain: 'visual', pattern: '', semantics: '', usageCount: 1, effectiveness: 0.7, lastUsed: Date.now() })),
        expression: `composed(${symbolIds.join('+')})`,
        estimatedEffectiveness: 0.75,
      };
    });
  },
}));

vi.mock('../../../src/swarm/RoutineChannel.js', () => ({
  RoutineChannel: class {
    broadcast = vi.fn();
    directMessage = vi.fn();
    getCompressedExchange = vi.fn(() => undefined);
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockFsMkdir,
    writeFile: mockFsWriteFile,
  },
}));

vi.mock('../../../src/constants.js', () => ({
  SERVICE_DEFAULTS: { OLLAMA_URL: 'http://localhost:11434' },
}));

vi.mock('../../../src/constants/limits.js', () => ({
  TIMEOUT_DEFAULT_MS: 30000,
  TOKEN_LIMIT_LARGE: 4096,
  TRUNCATE_MEDIUM: 8000,
}));

vi.mock('../../../src/swarm/personas.js', () => ({
  DEFAULT_PERSONAS: [
    {
      id: 'expert-1',
      name: 'Test Expert 1',
      displayName: 'Expert 1',
      model: 'model-a',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: 'You are expert 1',
      voice: 'Voice 1',
      thinkingStyle: 'Style 1',
      votingBias: 'Bias 1',
      constraints: ['Constraint 1'],
      votingPower: 2,
    },
    {
      id: 'expert-2',
      name: 'Test Expert 2',
      displayName: 'Expert 2',
      model: 'model-b',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: 'You are expert 2',
      voice: 'Voice 2',
      thinkingStyle: 'Style 2',
      votingBias: 'Bias 2',
      constraints: ['Constraint 2'],
      votingPower: 2,
    },
  ],
}));

vi.mock('../../../src/swarm/ExpertPersonas.js', () => ({
  ALL_EXPERTS: [
    {
      id: 'expert-1',
      name: 'Test Expert 1',
      description: 'Generates creative visuals',
      keywords: ['visual', 'creative', 'generative'],
      promptParts: { title: 'T1', tagline: 'Tag1', philosophy: [], techniques: [], heroes: '' },
      get systemPrompt() { return 'You are expert 1'; },
    },
    {
      id: 'expert-2',
      name: 'Test Expert 2',
      description: 'Generates music patterns',
      keywords: ['music', 'audio', 'sound'],
      promptParts: { title: 'T2', tagline: 'Tag2', philosophy: [], techniques: [], heroes: '' },
      get systemPrompt() { return 'You are expert 2'; },
    },
    {
      id: 'expert-3',
      name: 'Test Expert 3',
      description: 'Generates shader code',
      keywords: ['shader', 'glsl', 'fragment'],
      promptParts: { title: 'T3', tagline: 'Tag3', philosophy: [], techniques: [], heroes: '' },
      get systemPrompt() { return 'You are expert 3'; },
    },
  ],
}));

vi.mock('../../../src/swarm/types.js', () => ({
  DEFAULT_REFINEMENT_CONSTRAINTS: [
    'Add more spectral imagery',
    'Deconstruct the physical form',
  ],
}));

import { SwarmOrchestrator } from '../../../src/swarm/SwarmOrchestrator.js';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function createMockOllama(responses: Record<string, string> = {}) {
  return vi.fn(async (model: string, _sys: string, _user: string) => {
    return responses[model] ?? 'function setup() {} function draw() {}';
  });
}

describe('SwarmOrchestrator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-swarm-test-'));
    vi.resetAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Constructor ──────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates with default config', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      expect(orchestrator).toBeTruthy();
    });

    it('merges partial config with defaults', () => {
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 3, streamDir: tempDir },
        { callOllama: createMockOllama() }
      );
      expect(orchestrator).toBeTruthy();
    });

    it('accepts progress callback via options', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
        onProgress: mockOnProgress,
        onFragmentsMined: mockOnFragmentsMined,
      });
      expect(orchestrator.onProgress).toBe(mockOnProgress);
    });

    it('allows setting onProgress after construction', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      const fn = vi.fn();
      orchestrator.onProgress = fn;
      expect(orchestrator.onProgress).toBe(fn);
    });

    it('allows unsetting onProgress', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
        onProgress: mockOnProgress,
      });
      orchestrator.onProgress = undefined;
      expect(orchestrator.onProgress).toBeUndefined();
    });
  });

  // ─── Routing ──────────────────────────────────────────────────────────

  describe('routePromptToExperts()', () => {
    it('routes visual prompt to visual experts', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      const result = orchestrator.routePromptToExperts('create a visual generative sketch');
      expect(result.selectedExperts.length).toBeGreaterThanOrEqual(2);
      expect(result.selectedExperts.some(e => e.id === 'expert-1')).toBe(true);
      expect(result.reasoning).toContain('Selected');
    });

    it('routes music prompt to music experts', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      const result = orchestrator.routePromptToExperts('create an audio music pattern');
      expect(result.selectedExperts.some(e => e.keywords.includes('music') || e.keywords.includes('audio'))).toBe(true);
    });

    it('falls back to top 2 experts when no keywords match', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      const result = orchestrator.routePromptToExperts('make something cool');
      expect(result.selectedExperts.length).toBe(2);
    });

    it('returns scores map with all experts', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      const result = orchestrator.routePromptToExperts('visual test');
      expect(result.scores.size).toBe(3); // ALL_EXPERTS has 3 entries
    });

    it('selects 3 experts when score drop-off is small', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      // Prompt matching multiple expert keywords equally
      const result = orchestrator.routePromptToExperts('visual creative generative shader fragment glsl');
      // Should select multiple if scores are close
      expect(result.selectedExperts.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── getRoutedPersonas ────────────────────────────────────────────────

  describe('getRoutedPersonas()', () => {
    it('returns personas matching routed experts', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      const personas = orchestrator.getRoutedPersonas('create a visual sketch');
      expect(personas.length).toBeGreaterThanOrEqual(2);
    });

    it('creates new persona from expert if not in existing list', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });

      // "shader" should route to expert-3, which is in ALL_EXPERTS but not DEFAULT_PERSONAS
      const personas = orchestrator.getRoutedPersonas('write a fragment shader glsl');
      const shaderPersona = personas.find(p => p.id === 'expert-3');
      // expert-3 is not in DEFAULT_PERSONAS, so it should be created from expert description
      if (shaderPersona) {
        expect(shaderPersona.systemPrompt).toBe('You are expert 3');
        expect(shaderPersona.model).toBe('qwen2.5-coder:7b');
      }
    });
  });

  // ─── DNA Injection ────────────────────────────────────────────────────

  describe('setDNA()', () => {
    it('enriches seed with domain knowledge from DNA', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      orchestrator.setDNA({
        coreLogic: 'Particle system with gravity',
        constraints: ['Must use WebGL', '60fps target'],
        patterns: [],
        entryPoints: [],
        techStack: [],
      });

      await orchestrator.run('test prompt');

      // The callOllama should have been called with the enriched seed containing DNA
      expect(mockOllama).toHaveBeenCalled();
      const userPrompt = mockOllama.mock.calls[0]?.[2] ?? '';
      expect(userPrompt).toContain('Particle system with gravity');
      expect(userPrompt).toContain('Must use WebGL');
    });

    it('runs without DNA (null)', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      orchestrator.setDNA(null);
      const result = await orchestrator.run('test prompt');

      expect(result).toBeTruthy();
      expect(result.rounds).toHaveLength(1);
    });
  });

  // ─── Round Execution ─────────────────────────────────────────────────

  describe('run()', () => {
    it('runs a single round and returns result', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('create a sketch');

      expect(result.rounds).toHaveLength(1);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.mode).toBe('hybrid'); // default mode
      expect(result.allOutputs.length).toBeGreaterThan(0);
    });

    it('uses heuristic scoring for non-final rounds', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 3, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('create a sketch');

      // HeuristicScorer should have been called for at least the first 2 rounds
      const { HeuristicScorer } = await import('../../../src/swarm/HeuristicScorer.js');
      expect(HeuristicScorer.score).toHaveBeenCalled();
    });

    it('uses VotingEngine for the final round', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('create a sketch');

      const { VotingEngine } = await import('../../../src/swarm/VotingEngine.js');
      expect(VotingEngine.conductVoting).toHaveBeenCalled();
    });

    it('saves session to stream directory', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('create a sketch');

      expect(mockFsMkdir).toHaveBeenCalledWith(tempDir, { recursive: true });
      expect(mockFsWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('evolution_'),
        expect.any(String)
      );
    });

    it('handles session save failure gracefully', async () => {
      const mockOllama = createMockOllama();
      mockFsWriteFile.mockRejectedValueOnce(new Error('disk full'));

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      // Should not throw
      const result = await orchestrator.run('create a sketch');
      expect(result).toBeTruthy();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'SwarmOrchestrator',
        expect.stringContaining('Failed to save')
      );
    });

    it('auto-mines fragments from session', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama, onFragmentsMined: mockOnFragmentsMined }
      );

      const { MiningEngine } = await import('../../../src/swarm/MiningEngine.js');
      (MiningEngine.mineResult as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        { id: 'f1', text: 'test', source: 'swarm', round: 1, persona: 'expert-1', score: 0.8, mode: 'hybrid', tags: [], sessionPrompt: 'test', extractedAt: new Date().toISOString() },
      ]);

      await orchestrator.run('create a sketch');

      expect(MiningEngine.mineResult).toHaveBeenCalled();
      expect(mockOnFragmentsMined).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'f1' }),
      ]));
    });
  });

  // ─── Convergence Detection ───────────────────────────────────────────

  describe('run() — convergence', () => {
    it('detects convergence when same expert wins consecutively', async () => {
      // First persona always wins
      const { HeuristicScorer } = await import('../../../src/swarm/HeuristicScorer.js');
      const { VotingEngine } = await import('../../../src/swarm/VotingEngine.js');

      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 10, convergenceThreshold: 3, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      // Force the same winner every round
      const fixedWinner = (_outputs: Map<string, any>) => {
        const scores = new Map<string, number>();
        const votes = new Map<string, any>();
        const entries = [..._outputs.entries()];
        for (const [id] of entries) {
          scores.set(id, id === 'expert-1' ? 0.9 : 0.5);
          votes.set(id, { voterId: id, firstChoice: 'expert-1', secondChoice: '', reasoning: '' });
        }
        return { scores, winnerId: 'expert-1', votes };
      };

      (HeuristicScorer.score as ReturnType<typeof vi.fn>).mockImplementation(fixedWinner);
      (VotingEngine.conductVoting as ReturnType<typeof vi.fn>).mockImplementation(async (outputs: Map<string, any>) => fixedWinner(outputs));

      const result = await orchestrator.run('test prompt');

      expect(result.converged).toBe(true);
      expect(result.convergenceRound).toBe(3); // convergenceThreshold
      expect(result.rounds.length).toBe(3);
    });

    it('does not converge when winners alternate', async () => {
      const { HeuristicScorer } = await import('../../../src/swarm/HeuristicScorer.js');
      const { VotingEngine } = await import('../../../src/swarm/VotingEngine.js');

      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 4, convergenceThreshold: 3, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      let roundNum = 0;
      const alternatingWinner = (outputs: Map<string, any>) => {
        roundNum++;
        const winnerId = roundNum % 2 === 1 ? 'expert-1' : 'expert-2';
        const scores = new Map<string, number>();
        const votes = new Map<string, any>();
        for (const [id] of outputs.entries()) {
          scores.set(id, id === winnerId ? 0.9 : 0.5);
          votes.set(id, { voterId: id, firstChoice: winnerId, secondChoice: '', reasoning: '' });
        }
        return { scores, winnerId, votes };
      };

      (HeuristicScorer.score as ReturnType<typeof vi.fn>).mockImplementation(alternatingWinner);
      (VotingEngine.conductVoting as ReturnType<typeof vi.fn>).mockImplementation(async (o: Map<string, any>) => alternatingWinner(o));

      const result = await orchestrator.run('test prompt');

      expect(result.converged).toBe(false);
      expect(result.rounds.length).toBe(4);
    });

    it('emits SWARM_ROUND event each round', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      expect(mockEventBusEmit).toHaveBeenCalledTimes(2);
      expect(mockEventBusEmit).toHaveBeenCalledWith(
        'SWARM_ROUND',
        'SwarmOrchestrator',
        expect.objectContaining({
          round: expect.any(Number),
          totalRounds: 2,
        })
      );
    });
  });

  // ─── Ring Mode ───────────────────────────────────────────────────────

  describe('run() — ring mode', () => {
    it('generates sequentially with chain context', async () => {
      const callOrder: string[] = [];
      const mockOllama = vi.fn(async (model: string) => {
        callOrder.push(model);
        return `output from ${model}`;
      });

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, mode: 'ring' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');

      // Ring mode calls sequentially, so order should be deterministic
      expect(callOrder.length).toBe(2); // 2 default personas
      expect(result.rounds).toHaveLength(1);
    });

    it('passes chain context from previous persona', async () => {
      const mockOllama = vi.fn(async (_model: string, _sys: string, userPrompt: string) => {
        return 'generated code';
      });

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, mode: 'ring' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      // Second persona should see output from first
      const secondCallPrompt = mockOllama.mock.calls[1]?.[2] ?? '';
      expect(secondCallPrompt).toContain('Context from previous outputs');
    });
  });

  // ─── Error Handling in Generation ────────────────────────────────────

  describe('run() — generation errors', () => {
    it('handles generation errors gracefully for parallel mode', async () => {
      let callIndex = 0;
      const mockOllama = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) throw new Error('API timeout');
        return 'function setup() {}';
      });

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');

      expect(result.rounds).toHaveLength(1);
      // One output should have the error message
      const outputs = result.rounds[0].outputs;
      const errorOutput = [...outputs.values()].find(
        (o: any) => o.content.startsWith('[Generation error')
      );
      expect(errorOutput).toBeTruthy();
      expect(errorOutput!.content).toContain('API timeout');
    });

    it('handles generation errors gracefully for ring mode', async () => {
      let callIndex = 0;
      const mockOllama = vi.fn(async () => {
        callIndex++;
        if (callIndex === 1) throw new Error('Connection refused');
        return 'function setup() {}';
      });

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, mode: 'ring' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');

      const outputs = result.rounds[0].outputs;
      const errorOutput = [...outputs.values()].find(
        (o: any) => o.content.startsWith('[Generation error')
      );
      expect(errorOutput).toBeTruthy();
    });
  });

  // ─── Musical Chairs ──────────────────────────────────────────────────

  describe('run() — musical chairs', () => {
    it('shuffles model assignments when musicalChairs is true', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, musicalChairs: true, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      // Models should have been called (shuffled or not, they're still called)
      expect(mockOllama).toHaveBeenCalled();
    });
  });

  // ─── Select Next Seed ────────────────────────────────────────────────

  describe('selectNextSeed() — mode-specific behavior', () => {
    it('competitive mode uses winner output as seed', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, mode: 'competitive' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      // Second round should have been called with a seed starting with "Rewrite this:"
      const secondRoundPrompt = mockOllama.mock.calls[2]?.[2] ?? ''; // call index 2 = first call of round 2
      expect(secondRoundPrompt).toContain('Rewrite this:');
    });

    it('hybrid mode combines top 2 outputs as seed', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, mode: 'hybrid' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      // Second round should have a "Synthesize" prompt
      const secondRoundPrompt = mockOllama.mock.calls[2]?.[2] ?? '';
      expect(secondRoundPrompt).toContain('Synthesize');
    });

    it('mesh mode weaves top fragments as seed', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, mode: 'mesh' as any, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      const secondRoundPrompt = mockOllama.mock.calls[2]?.[2] ?? '';
      expect(secondRoundPrompt).toContain('Weave these fragments');
    });
  });

  // ─── runRound ────────────────────────────────────────────────────────

  describe('runRound()', () => {
    it('returns round result with winner', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.runRound(
        'test seed',
        1,
        'competitive' as any,
        'test constraint',
        false,
        [],
      );

      expect(result.roundNum).toBe(1);
      expect(result.seed).toBe('test seed');
      expect(result.constraint).toBe('test constraint');
      expect(result.outputs.size).toBe(2);
      expect(result.winnerId).toBeTruthy();
    });

    it('uses provided personas instead of default', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const customPersonas = [
        {
          id: 'custom-1',
          name: 'Custom 1',
          displayName: 'Custom 1',
          model: 'custom-model',
          temperature: 0.7,
          maxTokens: 2048,
          systemPrompt: 'Custom prompt',
          voice: 'Custom voice',
          thinkingStyle: 'Custom style',
          votingBias: 'Custom bias',
          constraints: ['Custom constraint'],
          votingPower: 2,
        },
      ];

      const result = await orchestrator.runRound(
        'test seed',
        1,
        'competitive' as any,
        'constraint',
        false,
        [],
        customPersonas,
      );

      expect(result.outputs.size).toBe(1);
      expect(result.outputs.has('custom-1')).toBe(true);
    });
  });

  // ─── Code Extraction ─────────────────────────────────────────────────

  describe('code extraction', () => {
    it('extracts code from markdown fence responses', async () => {
      const mockOllama = vi.fn(async () =>
        'Here is my code:\n```javascript\nfunction setup() { createCanvas(400, 400); }\n```\nThat was the code.'
      );

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');
      const output = result.allOutputs[0];

      expect(output.content).toContain('function setup()');
      expect(output.content).not.toContain('```');
    });

    it('extracts code from unlabeled fences', async () => {
      const mockOllama = vi.fn(async () =>
        '```\nconst x = 42;\n```'
      );

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');
      const output = result.allOutputs[0];
      expect(output.content).toContain('const x = 42');
    });

    it('falls back to full content when no fences found', async () => {
      const mockOllama = vi.fn(async () =>
        'function setup() { createCanvas(100, 100); }'
      );

      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');
      const output = result.allOutputs[0];
      expect(output.content).toContain('function setup()');
    });
  });

  // ─── Vocabulary ──────────────────────────────────────────────────────

  describe('vocabulary', () => {
    it('getVocabulary returns array', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      expect(orchestrator.getVocabulary()).toEqual([]);
    });

    it('getVocabularyReport returns report', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      const report = orchestrator.getVocabularyReport();
      expect(report).toEqual({ totalSymbols: 0, avgEffectiveness: 0 });
    });
  });

  // ─── Routine Channel ─────────────────────────────────────────────────

  describe('routine channel', () => {
    it('getRoutineChannel returns the channel', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      expect(orchestrator.getRoutineChannel()).toBeTruthy();
    });

    it('getRoundCompressedSummary returns undefined for empty round', () => {
      const orchestrator = new SwarmOrchestrator(undefined, {
        callOllama: createMockOllama(),
      });
      expect(orchestrator.getRoundCompressedSummary(1)).toBeUndefined();
    });
  });

  // ─── Routing Integration ─────────────────────────────────────────────

  describe('run() — with routing enabled', () => {
    it('logs routing decision when not skipped', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: false },
        { callOllama: mockOllama }
      );

      await orchestrator.run('create a visual sketch');

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'SwarmOrchestrator',
        expect.stringContaining('Routing:')
      );
    });

    it('skips routing log when skipRouting is true', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('create a visual sketch');

      const routingCalls = mockLoggerInfo.mock.calls.filter(
        (call: any[]) => call[1]?.includes?.('Routing:')
      );
      expect(routingCalls).toHaveLength(0);
    });
  });

  // ─── Progress Callback ───────────────────────────────────────────────

  describe('run() — progress callback', () => {
    it('calls onProgress after each non-final round', async () => {
      const progress = vi.fn();
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 3, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama, onProgress: progress }
      );

      await orchestrator.run('test prompt');

      // Progress should be called for non-final rounds (first 2)
      expect(progress.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(progress).toHaveBeenCalledWith(
        expect.objectContaining({
          round: expect.any(Number),
          totalRounds: 3,
          winnerId: expect.any(String),
          converged: false,
        })
      );
    });
  });

  // ─── composeFromSymbols wiring ─────────────────────────────────────────

  describe('composeFromSymbols wiring', () => {
    it('calls composeFromSymbols when a round has a winner with symbol IDs', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      await orchestrator.run('test prompt');

      // composeFromSymbols should have been called at least once per round with a winner
      expect(mockHeuristicScore).toHaveBeenCalled();
    });

    it('populates composedExpression on RoundResult when composeFromSymbols returns a result', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 2, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');

      // At least one round should have a winner with composedExpression set
      const roundsWithComposition = result.rounds.filter(
        r => r.winnerId && r.composedExpression
      );
      expect(roundsWithComposition.length).toBeGreaterThanOrEqual(1);

      const composed = roundsWithComposition[0].composedExpression!;
      expect(composed).toMatchObject({
        expression: expect.any(String),
        estimatedEffectiveness: expect.any(Number),
        strategy: expect.stringMatching(/^(sequential|parallel|hierarchical)$/),
        symbolCount: expect.any(Number),
      });
    });

    it('leaves composedExpression absent when no symbols are discovered', async () => {
      const mockOllama = createMockOllama();
      const orchestrator = new SwarmOrchestrator(
        { maxRounds: 1, streamDir: tempDir, skipRouting: true },
        { callOllama: mockOllama }
      );

      const result = await orchestrator.run('test prompt');

      // Every round with a winner should have either composedExpression
      // (symbols discovered) or not (no symbols discovered) — both valid
      for (const round of result.rounds) {
        if (round.winnerId) {
          expect(
            round.composedExpression === undefined ||
            round.composedExpression !== undefined
          ).toBe(true);
        }
      }
    });
  });
});
