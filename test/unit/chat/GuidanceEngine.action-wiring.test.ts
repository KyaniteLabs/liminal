/**
 * B10 regression: GuidanceEngine's archive-learning and session-taste suggestions
 * must carry a REAL `action` that mutates the next generation's prompt — not an
 * empty stub. Each action records a SUCCESSFUL `prompt` adaptation, which the
 * generation path already reads forward:
 *   harnessMemory.getSuccessfulAdaptations()
 *     -> TierBasedGenerator.getRecentAdaptations()
 *     -> PromptContext.recentAdaptations
 *     -> PromptBuilder <learned_guidance> block.
 *
 * The harnessMemory boundary is mocked with a STATEFUL in-memory fake (it really
 * stores episodes + adaptations) so the tests assert the concrete recorded
 * mutation — the same artifact that reaches the next prompt — and never touch the
 * real user-level ~/.sinter/memory store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

interface FakeEpisode {
  type: string;
  score?: number;
  tags?: string[];
}
interface FakeAdaptation {
  patternName: string;
  patternSeverity: string;
  fixType: string;
  description: string;
  success: boolean;
}

const { fakeMemory } = vi.hoisted(() => {
  const episodes: FakeEpisode[] = [];
  const adaptations: FakeAdaptation[] = [];
  return {
    fakeMemory: {
      episodes,
      adaptations,
      reset() {
        episodes.length = 0;
        adaptations.length = 0;
      },
      getRecentEpisodes: (_limit = 50) => [...episodes],
      recordAdaptation: (a: FakeAdaptation) => {
        adaptations.push(a);
        return 'adapt_id';
      },
      getSuccessfulAdaptations: () => adaptations.filter(a => a.success),
    },
  };
});

vi.mock('../../../src/harness/HarnessMemory.js', () => ({
  harnessMemory: fakeMemory,
}));

import { GuidanceEngine } from '../../../src/chat/GuidanceEngine.js';
import { SemanticArtMemory } from '../../../src/brain/archive/SemanticArtMemory.js';
import type { GenerationContext, Suggestion } from '../../../src/chat/types.js';

const CONTEXT: GenerationContext = {
  prompt: 'a calm generative bloom',
  domain: 'p5',
  techniques: [],
  constraints: [],
  references: [],
  iteration: 2,
  currentScore: 0.5,
};

describe('GuidanceEngine action wiring (B10)', () => {
  let guidance: GuidanceEngine;

  beforeEach(() => {
    fakeMemory.reset();
    guidance = new GuidanceEngine(new SemanticArtMemory());
  });

  describe('archive-learning suggestion action', () => {
    function seedHighQualityEpisodes(count: number): void {
      for (let i = 0; i < count; i++) {
        fakeMemory.episodes.push({ type: 'generation', score: 0.85 });
      }
    }

    it('records a successful prompt adaptation that feeds the archive into the next prompt', async () => {
      seedHighQualityEpisodes(4);

      const suggestion = guidance
        .suggestNextAction(CONTEXT)
        .find((s: Suggestion) => s.title === 'Use archive learning');
      expect(suggestion?.type).toBe('archive');

      // Action is a real body, not an empty stub.
      await suggestion!.action!();

      const adaptations = fakeMemory.getSuccessfulAdaptations();
      expect(adaptations).toHaveLength(1);
      expect(adaptations[0]).toMatchObject({
        patternName: 'guidance:archive-learning',
        fixType: 'prompt',
        success: true,
      });
      // The recorded description names the count of examples so the next prompt
      // actually leans on them (4 high-quality episodes seeded above).
      expect(adaptations[0].description).toContain('4 highest-quality');
    });

    it('records nothing until the action is invoked (was previously never called)', () => {
      seedHighQualityEpisodes(4);
      guidance.suggestNextAction(CONTEXT);
      // Building the suggestion must NOT mutate memory; only invoking the action does.
      expect(fakeMemory.getSuccessfulAdaptations()).toHaveLength(0);
    });
  });

  describe('session-taste suggestion action', () => {
    function seedTasteEpisode(tags: string[]): void {
      fakeMemory.episodes.push({ type: 'feedback', tags: ['session-taste', 'studio-reflection', ...tags] });
    }

    it('feeds the learned likes forward as a successful prompt adaptation', async () => {
      seedTasteEpisode(['restraint', 'dim-highlights']);

      const suggestion = guidance
        .suggestNextAction(CONTEXT)
        .find((s: Suggestion) => s.title === 'Apply learned taste');
      expect(suggestion?.type).toBe('archive');

      await suggestion!.action!();

      const adaptations = fakeMemory.getSuccessfulAdaptations();
      expect(adaptations).toHaveLength(1);
      expect(adaptations[0]).toMatchObject({
        patternName: 'guidance:session-taste',
        fixType: 'prompt',
        success: true,
      });
      expect(adaptations[0].description).toContain('restraint');
      expect(adaptations[0].description).toContain('dim-highlights');
    });
  });
});
