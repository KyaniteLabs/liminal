/**
 * C3 regression: the eagerly-constructed, seeded SemanticArtMemory ("artBrain")
 * must actually INFLUENCE guidance, not be discarded.
 *
 * Before the wire, GuidanceEngine's constructor did `void this.artBrain` and the
 * technique suggestion came from a static per-domain list — the entire seeded
 * ArtKnowledgeGraph / EpisodicMemory build was paid for on every
 * ConversationManager/TUI hot path for ZERO output.
 *
 * After the wire, `getSuggestedTechniques(domain, prompt)` queries the seeded
 * knowledge graph (`artBrain.suggestTechnique(prompt)`, filtered to the active
 * domain) and surfaces those concept names in the technique suggestion. These
 * tests assert the concrete knowledge-graph-derived hint reaches the suggestion,
 * and that without an artBrain the static fallback is used.
 */
import { describe, it, expect } from 'vitest';
import { GuidanceEngine } from '../../../src/chat/GuidanceEngine.js';
import { SemanticArtMemory } from '../../../src/brain/archive/SemanticArtMemory.js';
import type { GenerationContext } from '../../../src/chat/types.js';

/**
 * Drive the engine into the state where `shouldSuggestTechnique()` fires:
 * currentIteration >= 3 AND a plateauing recent-score history (zero variance).
 */
function primeTechniqueTrigger(guidance: GuidanceEngine): void {
  guidance.currentIteration = 4;
  // Identical scores => variance < 0.001 => isPlateauing() true.
  guidance.recentScores = [0.5, 0.5, 0.5, 0.5];
}

function contextFor(prompt: string, domain: GenerationContext['domain']): GenerationContext {
  return {
    prompt,
    domain,
    techniques: [],
    constraints: [],
    references: [],
    iteration: 4,
    currentScore: 0.5,
  };
}

describe('GuidanceEngine artBrain wiring (C3)', () => {
  it('surfaces seeded knowledge-graph techniques into the technique suggestion', () => {
    const guidance = new GuidanceEngine(new SemanticArtMemory());
    primeTechniqueTrigger(guidance);

    const suggestion = guidance
      .suggestNextAction(contextFor('create noise patterns', 'p5'))
      .find(s => s.type === 'technique');

    expect(suggestion).toBeTruthy();
    // Concrete, deterministic concept from the seeded p5 knowledge graph — proves
    // the artBrain output (NOT the static list) reached the suggestion.
    expect(suggestion!.description).toContain('Perlin Noise');
    // The static-list p5 default must be absent when the artBrain matched.
    expect(suggestion!.description).not.toContain('Particle systems');
  });

  it('prefers techniques whose domain matches the active domain', () => {
    const guidance = new GuidanceEngine(new SemanticArtMemory());
    primeTechniqueTrigger(guidance);

    const suggestion = guidance
      .suggestNextAction(contextFor('create noise patterns', 'p5'))
      .find(s => s.type === 'technique');

    // "create noise patterns" also matches strudel/music concepts, but with domain
    // 'p5' only the p5-domain concepts are surfaced (strudel's "Recursive Patterns"
    // must be filtered out).
    expect(suggestion!.description).not.toContain('Recursive Patterns');
    expect(suggestion!.description).toContain('Perlin Noise');
  });

  it('falls back to the static per-domain list when no artBrain is wired', () => {
    const guidance = new GuidanceEngine(); // no artBrain
    primeTechniqueTrigger(guidance);

    const suggestion = guidance
      .suggestNextAction(contextFor('create noise patterns', 'p5'))
      .find(s => s.type === 'technique');

    expect(suggestion).toBeTruthy();
    // Static p5 fallback list is used; no knowledge-graph concept name appears.
    expect(suggestion!.description).toContain('Particle systems');
    expect(suggestion!.description).not.toContain('Perlin Noise');
  });

  it('falls back to the static list when the artBrain has no prompt-relevant match', () => {
    const guidance = new GuidanceEngine(new SemanticArtMemory());
    primeTechniqueTrigger(guidance);

    const suggestion = guidance
      .suggestNextAction(contextFor('cook a recipe', 'p5'))
      .find(s => s.type === 'technique');

    expect(suggestion).toBeTruthy();
    // "cook a recipe" matches nothing in the knowledge graph => static fallback.
    expect(suggestion!.description).toContain('Particle systems');
  });
});
