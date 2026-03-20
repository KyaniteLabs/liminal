/**
 * TokenMillOrchestrator tests
 */

import { TokenMillOrchestrator } from '../../src/swarm/TokenMillOrchestrator.js';
import { SwarmMode } from '../../src/swarm/types.js';
import type { SwarmConfig } from '../../src/swarm/types.js';

// Mock Ollama caller that returns deterministic responses per persona
const createMockOllama = (): (model: string, prompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string> => {
  return async (_model: string, prompt: string): Promise<string> => {
    if (prompt.includes('You are Max')) return 'Brief. Precise.';
    if (prompt.includes('You are Rex')) return 'This is wrong. Challenge it.';
    if (prompt.includes('You are Sam')) return 'The warm light touched her face as she remembered.';
    if (prompt.includes('You are Kai')) return 'The system connects flows through hidden networks.';
    if (prompt.includes('You are Nova')) return 'Two worlds bridge into one unified vision.';
    if (prompt.includes('1st choice') || prompt.includes('2nd choice')) return '1st choice: C\n2nd choice: A\nSam had the most emotion.';
    return 'Default response.';
  };
};

describe('TokenMillOrchestrator', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const orchestrator = new TokenMillOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should create with custom config', () => {
      const config: Partial<SwarmConfig> = {
        maxRounds: 3,
        convergenceThreshold: 2,
        mode: SwarmMode.COMPETITIVE,
        musicalChairs: false,
      };

      const orchestrator = new TokenMillOrchestrator(config);
      expect(orchestrator).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run a full swarm evolution with mock Ollama', async () => {
      const orchestrator = new TokenMillOrchestrator(
        { maxRounds: 2, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Write about light');

      expect(result).toBeDefined();
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.finalOutput).toBeTruthy();
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.mode).toBe(SwarmMode.HYBRID);
    }, 10000);

    it('should run in competitive mode', async () => {
      const orchestrator = new TokenMillOrchestrator(
        { maxRounds: 2, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Test prompt', SwarmMode.COMPETITIVE);

      expect(result.mode).toBe(SwarmMode.COMPETITIVE);
      expect(result.rounds.length).toBe(2);
    }, 10000);

    it('should run in ring mode', async () => {
      const orchestrator = new TokenMillOrchestrator(
        { maxRounds: 1, musicalChairs: false, streamDir: './test-stream' },
        { callOllama: createMockOllama() }
      );

      const result = await orchestrator.run('Test', SwarmMode.RING);

      expect(result.mode).toBe(SwarmMode.RING);
      expect(result.rounds.length).toBe(1);
    }, 10000);

    it('should call progress callback', async () => {
      const progressCalls: Array<{ round: number; winnerId: string | null }> = [];
      const orchestrator = new TokenMillOrchestrator(
        { maxRounds: 1, musicalChairs: false, streamDir: './test-stream' },
        {
          callOllama: createMockOllama(),
          onProgress: (data) => progressCalls.push(data),
        }
      );

      await orchestrator.run('Test');

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].round).toBe(1);
    }, 10000);

    it('should detect convergence', async () => {
      // Use a custom 2-persona set where alpha always scores higher on heuristic dimensions.
      // Alpha produces richer output → higher vocabulary, better length, etc.
      const convergingPersonas = [
        {
          id: 'alpha',
          name: 'Alpha',
          displayName: 'Alpha',
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 80,
          systemPrompt: 'You are Alpha. Write rich, varied vocabulary.',
          voice: 'Rich.',
          thinkingStyle: 'Linear.',
          votingBias: 'Votes for A.',
          constraints: ['Be rich in vocabulary and varied in word choice'],
          votingPower: 2,
        },
        {
          id: 'beta',
          name: 'Beta',
          displayName: 'Beta',
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 80,
          systemPrompt: 'You are Beta.',
          voice: 'Flat.',
          thinkingStyle: 'Linear.',
          votingBias: 'Votes for B.',
          constraints: ['Be brief'],
          votingPower: 2,
        },
      ];

      let callCount = 0;
      const convergingMock = async (_model: string, prompt: string): Promise<string> => {
        callCount++;
        // Alpha: rich vocabulary, good length → higher heuristic score
        if (prompt.includes('You are Alpha')) {
          return 'Spectral luminance cascades through crystalline corridors, weaving ephemeral tapestries of shimmering resonance across vast undulating landscapes.';
        }
        // Beta: minimal output → lower scores on vocabulary and length
        if (prompt.includes('You are Beta')) {
          return 'Short.';
        }
        // LLM voting (final round only): vote for alpha
        return '1st choice: A\n2nd choice: B\nAlpha is better.';
      };

      const orchestrator = new TokenMillOrchestrator(
        {
          maxRounds: 6,
          convergenceThreshold: 3,
          musicalChairs: false,
          personas: convergingPersonas,
          streamDir: './test-stream',
        },
        { callOllama: convergingMock }
      );

      const result = await orchestrator.run('Test');

      // Alpha should consistently win on heuristic dimensions (richer vocab, better length)
      expect(result.converged).toBe(true);
      expect(result.convergenceRound).toBeLessThanOrEqual(6);
    }, 30000);
  });

  describe('checkConvergence', () => {
    it('should detect convergence with 3 consecutive wins', () => {
      const rounds = [
        { roundNum: 1, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
        { roundNum: 2, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
        { roundNum: 3, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
      ];

      expect(TokenMillOrchestrator.checkConvergence(rounds, 3)).toBe(true);
    });

    it('should not detect convergence with different winners', () => {
      const rounds = [
        { roundNum: 1, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
        { roundNum: 2, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'eve', winnerContent: '', constraint: '' },
        { roundNum: 3, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
      ];

      expect(TokenMillOrchestrator.checkConvergence(rounds, 3)).toBe(false);
    });

    it('should not detect convergence with insufficient rounds', () => {
      const rounds = [
        { roundNum: 1, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: 'sam', winnerContent: '', constraint: '' },
      ];

      expect(TokenMillOrchestrator.checkConvergence(rounds, 3)).toBe(false);
    });

    it('should handle null winner IDs', () => {
      const rounds = [
        { roundNum: 1, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: null, winnerContent: '', constraint: '' },
        { roundNum: 2, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: null, winnerContent: '', constraint: '' },
        { roundNum: 3, seed: '', outputs: new Map(), votes: new Map(), scores: new Map(), winnerId: null, winnerContent: '', constraint: '' },
      ];

      expect(TokenMillOrchestrator.checkConvergence(rounds, 3)).toBe(true);
    });
  });
});
