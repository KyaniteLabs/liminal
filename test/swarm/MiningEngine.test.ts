import { describe, it, expect } from 'vitest';
/**
 * MiningEngine tests
 */

import { MiningEngine } from '../../src/swarm/MiningEngine.js';
import type { MinedFragment, SwarmOutput, SwarmResult, RoundResult } from '../../src/swarm/types.js';
import { SwarmMode } from '../../src/swarm/types.js';

describe('MiningEngine', () => {
  describe('mineSession', () => {
    const mockSession = {
      session_id: 'test_session',
      rounds: [
        {
          round_num: 1,
          winner_id: 'sam',
          winner_content: 'The golden light shimmered across the cold water like a mirror of forgotten dreams.',
          seed: 'Write about light',
        },
        {
          round_num: 2,
          winner_id: 'eve',
          winner_content: 'Truth is a paradox of memory and forgetting.',
          seed: 'What remains',
        },
        {
          round_num: 3,
          winner_id: 'max',
          winner_content: 'Less.',
          seed: 'Be brief',
        },
      ],
    };

    it('should mine fragments above threshold', () => {
      const fragments = MiningEngine.mineSession(mockSession, 7, 'hybrid');

      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments[0].persona).toBeTruthy();
      expect(fragments[0].score).toBeGreaterThanOrEqual(7);
    });

    it('should give higher scores to sensory-rich content', () => {
      const sensorySession = {
        session_id: 'sensory_test',
        rounds: [
          {
            round_num: 1,
            winner_id: 'sam',
            winner_content: 'The warm scent of cinnamon filled the cold room. Light danced like fire on the textured walls. A taste of copper lingered.',
            seed: 'Write about a room',
          },
        ],
      };

      const fragments = MiningEngine.mineSession(sensorySession, 5, 'hybrid');
      expect(fragments.length).toBe(1);
      expect(fragments[0].score).toBeGreaterThanOrEqual(10); // Base 5 + sam 2 + hybrid 1 + sensory words + length
    });

    it('should give bonus to Sam (Muse persona)', () => {
      const samSession = {
        session_id: 'sam_test',
        rounds: [
          {
            round_num: 1,
            winner_id: 'sam',
            winner_content: 'A riddle wrapped in shadow and warm light.',
            seed: 'Test',
          },
        ],
      };

      const fragments = MiningEngine.mineSession(samSession, 5, 'competitive');
      expect(fragments.length).toBe(1);
      expect(fragments[0].score).toBeGreaterThanOrEqual(7); // Base 5 + sam 2
    });

    it('should give length bonus for 50-300 char content', () => {
      const mediumSession = {
        session_id: 'length_test',
        rounds: [
          {
            round_num: 1,
            winner_id: 'sam',
            winner_content: 'The shimmer of light on cold water, a texture of memory folded like crystal into the echo of time itself.',
            seed: 'Test',
          },
        ],
      };

      const fragments = MiningEngine.mineSession(mediumSession, 5, 'hybrid');
      expect(fragments.length).toBe(1);
      expect(fragments[0].score).toBeGreaterThanOrEqual(9); // Base 5 + sam 2 + hybrid 1 + sensory + length
    });

    it('should filter fragments below threshold', () => {
      const shortSession = {
        session_id: 'short_test',
        rounds: [
          {
            round_num: 1,
            winner_id: 'max',
            winner_content: 'Ok.',
            seed: 'Test',
          },
        ],
      };

      const fragments = MiningEngine.mineSession(shortSession, 20, 'competitive');
      expect(fragments.length).toBe(0);
    });

    it('should skip rounds with empty winner content', () => {
      const emptySession = {
        session_id: 'empty_test',
        rounds: [
          {
            round_num: 1,
            winner_id: 'max',
            winner_content: '',
            seed: 'Test',
          },
        ],
      };

      const fragments = MiningEngine.mineSession(emptySession, 1, 'competitive');
      expect(fragments.length).toBe(0);
    });
  });

  describe('mineResult', () => {
    it('should mine from SwarmResult', () => {
      const roundResult: RoundResult = {
        roundNum: 1,
        seed: 'Test prompt',
        outputs: new Map(),
        votes: new Map(),
        scores: new Map(),
        winnerId: 'sam',
        winnerContent: 'The golden light shimmered across the cold water.',
        constraint: 'Add spectral imagery',
      };

      const swarmResult: SwarmResult = {
        rounds: [roundResult],
        converged: false,
        convergenceRound: null,
        finalOutput: 'The golden light shimmered across the cold water.',
        totalDurationMs: 5000,
        mode: SwarmMode.HYBRID,
        allOutputs: [],
      };

      const fragments = MiningEngine.mineResult(swarmResult, 7);
      expect(fragments.length).toBeGreaterThan(0);
    });
  });

  describe('hybridize', () => {
    it('should combine fragments from different personas', () => {
      const fragments: MinedFragment[] = [
        {
          id: 'f1',
          text: 'Light echoes through crystal corridors.',
          source: 'session1',
          round: 1,
          persona: 'eve',
          score: 8,
          mode: 'hybrid',
          tags: ['eve'],
          sessionPrompt: 'Light',
          extractedAt: '2026-03-19T00:00:00.000Z',
        },
        {
          id: 'f2',
          text: 'The warm scent of rain on stone.',
          source: 'session1',
          round: 2,
          persona: 'sam',
          score: 9,
          mode: 'hybrid',
          tags: ['sam'],
          sessionPrompt: 'Rain',
          extractedAt: '2026-03-19T00:00:00.000Z',
        },
      ];

      const result = MiningEngine.hybridize(fragments);
      expect(result).toContain('Synthesize and evolve');
      expect(result).toContain('crystal corridors');
      expect(result).toContain('warm scent');
    });

    it('should return single fragment as-is', () => {
      const fragments: MinedFragment[] = [
        {
          id: 'f1',
          text: 'Only fragment.',
          source: 'session1',
          round: 1,
          persona: 'max',
          score: 5,
          mode: 'competitive',
          tags: ['max'],
          sessionPrompt: 'Test',
          extractedAt: '2026-03-19T00:00:00.000Z',
        },
      ];

      const result = MiningEngine.hybridize(fragments);
      expect(result).toBe('Only fragment.');
    });

    it('should return empty string for empty fragments', () => {
      expect(MiningEngine.hybridize([])).toBe('');
    });

    it('should select at most 3 fragments from different personas', () => {
      const fragments: MinedFragment[] = [
        { id: 'f1', text: 'From eve.', source: 's', round: 1, persona: 'eve', score: 8, mode: 'hybrid', tags: ['eve'], sessionPrompt: '', extractedAt: '' },
        { id: 'f2', text: 'From sam.', source: 's', round: 2, persona: 'sam', score: 9, mode: 'hybrid', tags: ['sam'], sessionPrompt: '', extractedAt: '' },
        { id: 'f3', text: 'From kai.', source: 's', round: 3, persona: 'kai', score: 7, mode: 'hybrid', tags: ['kai'], sessionPrompt: '', extractedAt: '' },
        { id: 'f4', text: 'From ben.', source: 's', round: 4, persona: 'ben', score: 6, mode: 'hybrid', tags: ['ben'], sessionPrompt: '', extractedAt: '' },
      ];

      const result = MiningEngine.hybridize(fragments);
      expect(result).toContain('From eve.');
      expect(result).toContain('From sam.');
      expect(result).toContain('From kai.');
      expect(result).not.toContain('From ben.');
    });
  });

  describe('findGlitches', () => {
    it('should detect safety triggers', () => {
      const outputs = new Map<string, SwarmOutput>();
      outputs.set('max', {
        personaId: 'max',
        personaName: 'The Minimalist',
        content: "I cannot fulfill this request as it may be harmful.",
        model: 'test',
        tokensUsed: 10,
        latencyMs: 100,
        roundNum: 1,
      });

      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches).toHaveLength(1);
      expect(glitches[0].content).toContain('safety-trigger');
    });

    it('should detect degenerate repetition', () => {
      const outputs = new Map<string, SwarmOutput>();
      outputs.set('joy', {
        personaId: 'joy',
        personaName: 'The Enthusiast',
        content: 'light light light light light light light light light light light light light light light light light light light light',
        model: 'test',
        tokensUsed: 20,
        latencyMs: 100,
        roundNum: 1,
      });

      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches.length).toBeGreaterThan(0);
      expect(glitches[0].content).toContain('degenerate-repetition');
    });

    it('should detect truncated output', () => {
      const outputs = new Map<string, SwarmOutput>();
      outputs.set('max', {
        personaId: 'max',
        personaName: 'The Minimalist',
        content: 'Too short',
        model: 'test',
        tokensUsed: 2,
        latencyMs: 100,
        roundNum: 1,
      });

      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches).toHaveLength(1);
      expect(glitches[0].content).toContain('truncated');
    });

    it('should return empty for normal outputs', () => {
      const outputs = new Map<string, SwarmOutput>();
      outputs.set('sam', {
        personaId: 'sam',
        personaName: 'The Storyteller',
        content: 'The golden light shimmered across the cold water like a mirror of forgotten dreams.',
        model: 'test',
        tokensUsed: 15,
        latencyMs: 100,
        roundNum: 1,
      });

      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches).toHaveLength(0);
    });
  });
});
