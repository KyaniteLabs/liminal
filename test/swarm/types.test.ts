import { describe, it, expect } from 'vitest';
/**
 * Swarm types tests
 */

import { SwarmMode } from '../../src/swarm/types.js';
import type {
  SwarmPersona,
  SwarmConfig,
  SwarmOutput,
  Vote,
  RoundResult,
  SwarmResult,
  MinedFragment,
} from '../../src/swarm/types.js';

describe('Swarm Types', () => {
  describe('SwarmMode enum', () => {
    it('should have all four modes', () => {
      expect(SwarmMode.COMPETITIVE).toBe('competitive');
      expect(SwarmMode.HYBRID).toBe('hybrid');
      expect(SwarmMode.RING).toBe('ring');
      expect(SwarmMode.MESH).toBe('mesh');
    });
  });

  describe('SwarmPersona interface', () => {
    it('should accept valid persona', () => {
      const persona: SwarmPersona = {
        id: 'test',
        name: 'Test',
        displayName: 'The Tester',
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 100,
        systemPrompt: 'You are a test persona.',
        voice: 'Analytical.',
        thinkingStyle: 'Logical.',
        votingBias: 'Votes for clarity.',
        constraints: ['Be brief'],
        votingPower: 1,
      };

      expect(persona.id).toBe('test');
      expect(persona.votingPower).toBe(1);
      expect(persona.constraints).toHaveLength(1);
    });
  });

  describe('SwarmConfig interface', () => {
    it('should accept valid config', () => {
      const config: SwarmConfig = {
        ollamaHost: 'http://localhost:11434',
        ollamaTimeout: 60,
        maxRounds: 10,
        convergenceThreshold: 3,
        musicalChairs: true,
        mode: SwarmMode.HYBRID,
        personas: [],
        refinementConstraints: ['constraint1'],
        streamDir: './stream',
      };

      expect(config.mode).toBe('hybrid');
      expect(config.maxRounds).toBe(10);
    });
  });

  describe('SwarmOutput interface', () => {
    it('should accept valid output', () => {
      const output: SwarmOutput = {
        personaId: 'max',
        personaName: 'The Minimalist',
        content: 'Brief output.',
        model: 'qwen2.5:0.5b',
        tokensUsed: 5,
        latencyMs: 100,
        roundNum: 1,
      };

      expect(output.personaId).toBe('max');
      expect(output.roundNum).toBe(1);
    });
  });

  describe('Vote interface', () => {
    it('should accept valid vote', () => {
      const vote: Vote = {
        voterId: 'max',
        firstChoice: 'sam',
        secondChoice: 'eve',
        reasoning: 'Most emotional piece.',
      };

      expect(vote.voterId).toBe('max');
      expect(vote.firstChoice).toBe('sam');
    });
  });

  describe('RoundResult interface', () => {
    it('should accept valid round result', () => {
      const round: RoundResult = {
        roundNum: 1,
        seed: 'Test prompt',
        outputs: new Map(),
        votes: new Map(),
        scores: new Map(),
        winnerId: 'sam',
        winnerContent: 'Winning text.',
        constraint: 'Be brief',
      };

      expect(round.roundNum).toBe(1);
      expect(round.winnerId).toBe('sam');
    });
  });

  describe('SwarmResult interface', () => {
    it('should accept valid swarm result', () => {
      const result: SwarmResult = {
        rounds: [],
        converged: false,
        convergenceRound: null,
        finalOutput: 'Final output.',
        totalDurationMs: 5000,
        mode: SwarmMode.HYBRID,
        allOutputs: [],
      };

      expect(result.converged).toBe(false);
      expect(result.totalDurationMs).toBe(5000);
    });
  });

  describe('MinedFragment interface', () => {
    it('should accept valid fragment', () => {
      const fragment: MinedFragment = {
        id: 'session1_r1',
        text: 'A beautiful fragment about light.',
        source: 'session1',
        round: 1,
        persona: 'sam',
        score: 8,
        mode: 'hybrid',
        tags: ['sam', 'hybrid'],
        sessionPrompt: 'Write about light',
        extractedAt: '2026-03-19T00:00:00.000Z',
      };

      expect(fragment.persona).toBe('sam');
      expect(fragment.score).toBe(8);
    });
  });
});
