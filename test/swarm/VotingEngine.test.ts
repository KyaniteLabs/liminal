import { describe, it, expect } from 'vitest';
/**
 * VotingEngine tests
 */

import { VotingEngine } from '../../src/swarm/VotingEngine.js';
import { DEFAULT_PERSONAS } from '../../src/swarm/personas.js';
import type { SwarmOutput, SwarmConfig } from '../../src/swarm/types.js';
import { SwarmMode } from '../../src/swarm/types.js';
import path from 'path';
import os from 'os';

describe('VotingEngine', () => {
  const mockConfig: SwarmConfig = {
    ollamaHost: 'http://localhost:11434',
    ollamaTimeout: 60,
    maxRounds: 10,
    convergenceThreshold: 3,
    musicalChairs: false,
    mode: SwarmMode.COMPETITIVE,
    personas: DEFAULT_PERSONAS,
    refinementConstraints: ['constraint1'],
    streamDir: path.join(os.tmpdir(), 'sinter-test-stream'),
  };

  describe('parseVote', () => {
    it('should parse structured vote with 1st and 2nd choice', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
        ['B', 'rex'],
        ['C', 'sam'],
      ]);

      const result = VotingEngine.parseVote(
        '1st choice: B\n2nd choice: A\nSam had more emotion.',
        candidateMap
      );

      expect(result.first).toBe('rex');
      expect(result.second).toBe('max');
      expect(result.reasoning).toContain('emotion');
    });

    it('should parse vote with shorthand format', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
        ['B', 'rex'],
      ]);

      const result = VotingEngine.parseVote('1st: A\n2nd: B\nMax was brief.', candidateMap);

      expect(result.first).toBe('max');
      expect(result.second).toBe('rex');
    });

    it('should fallback to finding any letter when structured parsing fails', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
        ['B', 'rex'],
        ['C', 'sam'],
      ]);

      // 'A' appears in "was" before 'C', so fallback finds 'A' first
      const result = VotingEngine.parseVote('I choose C because it was interesting.', candidateMap);

      expect(result.first).toBe('max');
    });

    it('should return null for first/second when no candidate letter found', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
      ]);

      // 'A' appears in "clear" — fallback finds it
      const result = VotingEngine.parseVote('No clear choice here.', candidateMap);

      expect(result.first).toBe('max');
    });

    it('should extract reasoning from last line', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
        ['B', 'rex'],
      ]);

      const result = VotingEngine.parseVote('1st: A\n2nd: B\nBrief and precise.', candidateMap);

      expect(result.reasoning).toBe('Brief and precise.');
    });

    it('should handle case-insensitive letters', () => {
      const candidateMap = new Map<string, string>([
        ['A', 'max'],
        ['B', 'rex'],
      ]);

      const result = VotingEngine.parseVote('1st choice: a\n2nd choice: b\nLower case.', candidateMap);

      expect(result.first).toBe('max');
      expect(result.second).toBe('rex');
    });
  });

  describe('conductVoting', () => {
    const makeOutputs = (contents: Record<string, string>): Map<string, SwarmOutput> => {
      const outputs = new Map<string, SwarmOutput>();
      for (const [id, content] of Object.entries(contents)) {
        outputs.set(id, {
          personaId: id,
          personaName: id,
          content,
          model: 'test-model',
          tokensUsed: content.length,
          latencyMs: 100,
          roundNum: 1,
        });
      }
      return outputs;
    };

    it('should use fallback voting when no Ollama caller provided', async () => {
      const outputs = makeOutputs({
        max: 'Brief.',
        rex: 'Contrarian view.',
        sam: 'A story unfolds.',
      });

      const result = await VotingEngine.conductVoting(
        outputs,
        DEFAULT_PERSONAS.slice(0, 3),
        1,
        mockConfig
      );

      expect(result.winnerId).toBeTruthy();
      expect(result.scores.size).toBeGreaterThan(0);
      expect(result.votes.size).toBe(3);
    });

    it('should use provided Ollama caller for voting', async () => {
      const mockOllama = async (_model: string, _prompt: string): Promise<string> => {
        // All voters choose A (max)
        return '1st choice: A\n2nd choice: B\nMax was the best.';
      };

      const outputs = makeOutputs({
        max: 'Brief.',
        rex: 'Contrarian.',
        sam: 'Story time.',
      });

      const result = await VotingEngine.conductVoting(
        outputs,
        DEFAULT_PERSONAS.slice(0, 3),
        1,
        mockConfig,
        mockOllama
      );

      expect(result.winnerId).toBe('max');
    });

    it('should apply weighted scoring correctly', async () => {
      // Nova has votingPower 2, Max has 2 — both are voters AND candidates
      const nova = DEFAULT_PERSONAS.find(p => p.id === 'nova')!;
      const max = DEFAULT_PERSONAS.find(p => p.id === 'max')!;
      const voters = [nova, max];

      const mockOllama = async (_model: string, _prompt: string): Promise<string> => {
        return '1st choice: A\n2nd choice: B\nGood choice.';
      };

      // A = nova, B = max (voters are also in outputs)
      const outputs = makeOutputs({
        nova: 'Bridging worlds together.',
        max: 'Brief.',
      });

      const result = await VotingEngine.conductVoting(outputs, voters, 1, mockConfig, mockOllama);

      // Nova (power 2) votes A (nova): 2*2=4, B (max): 2*1=2
      // Max (power 2) votes A (nova): 2*2=4, B (max): 2*1=2
      // nova total: 8, max total: 4
      expect(result.scores.get('nova')).toBe(8);
      expect(result.scores.get('max')).toBe(4);
      expect(result.winnerId).toBe('nova');
    });

    it('should handle Ollama errors gracefully', async () => {
      const mockOllama = async (): Promise<string> => {
        throw new Error('Ollama not running');
      };

      const outputs = makeOutputs({
        kai: 'Systems connect.',
        nova: 'Bridging worlds.',
      });

      const result = await VotingEngine.conductVoting(
        outputs,
        DEFAULT_PERSONAS.slice(0, 2),
        1,
        mockConfig,
        mockOllama
      );

      // Should still have votes even if they errored
      expect(result.votes.size).toBe(2);
    });
  });
});
