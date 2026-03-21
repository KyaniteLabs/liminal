import { describe, it, expect } from 'vitest';
/**
 * MiningEngine unit tests
 */

import { MiningEngine } from '../../src/swarm/MiningEngine.js';
import { SwarmMode } from '../../src/swarm/types.js';
import type { MinedFragment } from '../../src/swarm/types.js';

describe('MiningEngine', () => {
  const makeSession = (rounds: Array<{ round_num: number; winner_id?: string; winner_content?: string; seed?: string }>) => ({
    session_id: 'test-session',
    rounds,
  });

  describe('mineSession', () => {
    it('should return fragments above threshold', () => {
      const session = makeSession([
        { round_num: 1, winner_id: 'eve', winner_content: 'The crystal ocean folds like a mirror, warm and cold.' },
      ]);
      const fragments = MiningEngine.mineSession(session, 5);
      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments[0].persona).toBe('eve');
      expect(fragments[0].score).toBeGreaterThanOrEqual(5);
    });

    it('should return empty for low-quality rounds', () => {
      const session = makeSession([
        { round_num: 1, winner_id: 'max', winner_content: 'ok' },
      ]);
      const fragments = MiningEngine.mineSession(session, 15);
      expect(fragments.length).toBe(0);
    });

    it('should handle empty winner content', () => {
      const session = makeSession([
        { round_num: 1, winner_id: 'max', winner_content: '' },
      ]);
      const fragments = MiningEngine.mineSession(session, 5);
      expect(fragments.length).toBe(0);
    });
  });

  describe('mineResult', () => {
    it('should convert SwarmResult to fragments', () => {
      const result = {
        rounds: [{
          roundNum: 1,
          seed: 'test prompt',
          outputs: new Map(),
          votes: new Map(),
          scores: new Map(),
          winnerId: 'eve',
          winnerContent: 'The warm light echoes through cold stone.',
          constraint: 'Be creative',
        }],
        converged: false,
        convergenceRound: null,
        finalOutput: 'The warm light echoes through cold stone.',
        totalDurationMs: 1000,
        mode: SwarmMode.HYBRID,
        allOutputs: [],
      };
      const fragments = MiningEngine.mineResult(result, 5);
      expect(fragments.length).toBeGreaterThan(0);
    });
  });

  describe('hybridize', () => {
    it('should return single fragment for single input', () => {
      const fragments: MinedFragment[] = [{
        id: 'f1', text: 'single', source: 's1',
        round: 1, persona: 'a', score: 8, mode: 'hybrid',
        tags: ['a', 'hybrid'], sessionPrompt: 'p', extractedAt: '',
      }];
      expect(MiningEngine.hybridize(fragments)).toBe('single');
    });

    it('should combine fragments from different personas', () => {
      const fragments: MinedFragment[] = [
        { id: 'f1', text: 'Alpha content', source: 's1', round: 1, persona: 'max', score: 8, mode: 'hybrid', tags: ['max', 'hybrid'], sessionPrompt: 'p', extractedAt: '' },
        { id: 'f2', text: 'Beta content', source: 's1', round: 1, persona: 'rex', score: 8, mode: 'hybrid', tags: ['rex', 'hybrid'], sessionPrompt: 'p', extractedAt: '' },
      ];
      const result = MiningEngine.hybridize(fragments);
      expect(result).toContain('Alpha content');
      expect(result).toContain('Beta content');
      expect(result).toContain('Synthesize');
    });

    it('should return empty for empty input', () => {
      expect(MiningEngine.hybridize([])).toBe('');
    });
  });

  describe('findGlitches', () => {
    it('should detect safety triggers', () => {
      const outputs = new Map([
        ['a', { personaId: 'a', personaName: 'A', content: 'I cannot generate this content', model: 'm', tokensUsed: 0, latencyMs: 0, roundNum: 1 }],
      ]);
      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches.length).toBe(1);
      expect(glitches[0].content).toContain('safety-trigger');
    });

    it('should detect degenerate repetition', () => {
      const repeated = 'the the the the the the the the the the the the the the the the the the';
      const outputs = new Map([
        ['a', { personaId: 'a', personaName: 'A', content: repeated, model: 'm', tokensUsed: 0, latencyMs: 0, roundNum: 1 }],
      ]);
      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches.length).toBe(1);
      expect(glitches[0].content).toContain('degenerate-repetition');
    });

    it('should detect contradictions', () => {
      const outputs = new Map([
        ['a', { personaId: 'a', personaName: 'A', content: 'This is not the same as it is', model: 'm', tokensUsed: 0, latencyMs: 0, roundNum: 1 }],
      ]);
      const glitches = MiningEngine.findGlitches(outputs);
      expect(glitches.length).toBe(1);
      expect(glitches[0].content).toContain('contradiction');
    });
  });
});
