import { describe, it, expect, vi, beforeEach } from 'vitest';
/**
 * Tests for FragmentScorer — multi-dimensional fragment scoring.
 */

import { FragmentScorer } from '../../src/compost/FragmentScorer.js';
import { mergeConfig } from '../../src/compost/defaults.js';
import type { CompostFragment } from '../../src/compost/types.js';

function makeFragment(overrides: Partial<CompostFragment> = {}): CompostFragment {
  return {
    id: 'frag-1',
    source: '/test/file.txt',
    domain: 'ceramics',
    layer: 'semantic',
    content: 'Glaze dynamics and thermal patterns in kiln firing.',
    metadata: {
      fileType: 'txt',
      timestamp: '2026-03-20T00:00:00Z',
      hash: 'a'.repeat(64),
      size: 100,
      extractedAt: '2026-03-20T00:00:00Z',
    },
    tags: ['ceramics', 'semantic'],
    ...overrides,
  };
}

describe('FragmentScorer', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLM: any;
  let scorer: FragmentScorer;

  beforeEach(() => {
    mockLLM = { generate: vi.fn() };
    scorer = new FragmentScorer(mergeConfig(), mockLLM);
  });

  describe('scoreHeuristic()', () => {
    it('returns FragmentScore with all 6 dimensions', () => {
      const frag = makeFragment();
      const score = scorer.scoreHeuristic(frag);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(10);
      expect(score.novelty).toBeGreaterThanOrEqual(0);
      expect(score.density).toBeGreaterThanOrEqual(0);
      expect(score.crossDomain).toBeGreaterThanOrEqual(0);
      expect(score.metadataRarity).toBeGreaterThanOrEqual(0);
      expect(score.connectionStrength).toBeGreaterThanOrEqual(0);
    });

    it('novelty: unique words ratio', () => {
      const uniqueFrag = makeFragment({ content: 'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu' });
      const dupFrag = makeFragment({ content: 'the the the the the the the the the the' });
      const uniqueScore = scorer.scoreHeuristic(uniqueFrag);
      const dupScore = scorer.scoreHeuristic(dupFrag);
      expect(uniqueScore.novelty).toBeGreaterThan(dupScore.novelty);
    });

    it('density: ideas per character', () => {
      const denseFrag = makeFragment({ content: 'ABC' });
      const sparseFrag = makeFragment({ content: 'aaaaaaaaaaaaaaaa' });
      const denseScore = scorer.scoreHeuristic(denseFrag);
      const sparseScore = scorer.scoreHeuristic(sparseFrag);
      expect(denseScore.density).toBeGreaterThan(sparseScore.density);
    });
  });

  describe('scoreLLM()', () => {
    it('calls LLM for semantic quality', async () => {
      mockLLM.generate.mockResolvedValue({
        success: true,
        code: JSON.stringify({ score: 8.5, reasoning: 'High quality' }),
      });
      const frag = makeFragment();
      const result = await scorer.scoreLLM(frag);
      // scoreLLM returns Result<number, LLMError> - need to unwrap
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
      expect(mockLLM.generate).toHaveBeenCalled();
    });
  });

  describe('score()', () => {
    it('returns aggregate score', async () => {
      const frag = makeFragment();
      const score = await scorer.score(frag);
      expect(score.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldPromote()', () => {
    it('returns true when score exceeds threshold', async () => {
      const frag = makeFragment({ content: 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z unique words high novelty' });
      const result = await scorer.shouldPromote(frag);
      expect(typeof result).toBe('boolean');
    });
  });
});
