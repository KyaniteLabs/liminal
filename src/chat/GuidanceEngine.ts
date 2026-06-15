/**
 * GuidanceEngine - Proactive suggestions during generation
 *
 * Analyzes generation context and suggests relevant actions:
 * - Swarm: Explore multiple artistic approaches
 * - Compost: Use past work for inspiration
 * - Technique: Try new techniques when stuck
 * - Evolution: Enable MAP-Elites for diversity
 * - Archive: Use high-quality examples from archive
 * 
 * Consolidated as part of Fix 8: Triple Redundancy - Now uses HarnessMemory.
 */

import { harnessMemory } from '../harness/HarnessMemory.js';
// Note: CompostMill integration removed as part of consolidation
// Note: SwarmOrchestrator type import removed - not used in consolidated version
import type { GenerationContext, Suggestion } from './types.js';
import type { SemanticArtMemory } from '../brain/archive/SemanticArtMemory.js';
import type { CompostMill } from '../compost/CompostMill.js';
import { createCreativePreferenceSuggestion } from './CreativePreferenceGuide.js';

/** Max knowledge-graph techniques to surface in a single suggestion. */
const MAX_ART_BRAIN_TECHNIQUES = 3;

// Score history for trend analysis
interface ScoreHistory {
  scores: number[];
  maxLength: number;
}

/**
 * GuidanceEngine provides proactive suggestions during creative generation
 * by analyzing context, iteration progress, and subsystem state.
 * 
 * Consolidated: Now uses HarnessMemory instead of SemanticArtMemory.
 */
export class GuidanceEngine {
  private scoreHistory: ScoreHistory = { scores: [], maxLength: 10 };
  private artBrain: SemanticArtMemory | undefined;
  private compostMill: CompostMill | undefined;
  private swarmOrchestrator: unknown | undefined;

  currentIteration = 0;
  recentScores: number[] = [];

  constructor(artBrain?: SemanticArtMemory, compostMill?: CompostMill, swarmOrchestrator?: unknown) {
    // artBrain is now consumed by getSuggestedTechniques() — the eagerly-constructed,
    // seeded SemanticArtMemory knowledge graph actually influences technique guidance
    // instead of being discarded (was: `void this.artBrain`).
    this.artBrain = artBrain;
    this.compostMill = compostMill;
    this.swarmOrchestrator = swarmOrchestrator;
    // swarmOrchestrator is retained as a property for test/back-compat; no consumer yet.
    void this.swarmOrchestrator;
  }

  /**
   * Generate suggestions based on current generation context
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generateSuggestions(context: GenerationContext): Promise<Suggestion[]> {
    return this.suggestNextAction(context);
  }

  /**
   * Suggest next actions based on current generation context (legacy API)
   */
  suggestNextAction(context: GenerationContext): Suggestion[] {
    if (!context) return [];

    const suggestions: Suggestion[] = [];

    // Update score history from recentScores if set externally
    if (this.recentScores.length > 0) {
      this.scoreHistory.scores = [...this.recentScores];
      while (this.scoreHistory.scores.length > this.scoreHistory.maxLength) {
        this.scoreHistory.scores.shift();
      }
    }

    // Use currentIteration if set, otherwise from context
    const iteration = this.currentIteration || context.iteration || 0;
    const ctx = { ...context, iteration };

    // Check various conditions and add relevant suggestions
    if (this.shouldSuggestSwarm(ctx, iteration)) {
      suggestions.push({
        type: 'swarm',
        title: 'Try a new artistic approach',
        description: 'Multiple perspectives might help break through this creative block.',
        priority: 'high',
        action: async () => {},
      });
    }

    const compostSuggestion = this.createCompostSuggestion(ctx);
    if (compostSuggestion) suggestions.push(compostSuggestion);

    if (this.shouldSuggestTechnique()) {
      const techniques = this.getSuggestedTechniques(ctx.domain, ctx.prompt);
      suggestions.push({
        type: 'technique',
        title: 'Try a new technique',
        description: `Consider: ${techniques.join(', ')}`,
        priority: 'high',
        action: async () => {},
      });
    }

    if (this.shouldSuggestEvolution()) {
      suggestions.push({
        type: 'parameter',
        title: 'Enable evolutionary diversity',
        description: 'MAP-Elites can explore the space of possibilities and find unexpected gems.',
        priority: 'medium',
        action: async () => {},
      });
    }

    const archiveSuggestion = this.createArchiveSuggestion();
    if (archiveSuggestion) suggestions.push(archiveSuggestion);

    const sessionTasteSuggestion = this.createSessionTasteSuggestion();
    if (sessionTasteSuggestion) suggestions.push(sessionTasteSuggestion);

    const creativePreferenceSuggestion = createCreativePreferenceSuggestion(ctx);
    if (creativePreferenceSuggestion) suggestions.push(creativePreferenceSuggestion);

    return this.sortByPriority(suggestions);
  }

  shouldSuggestSwarm(context: GenerationContext, iteration: number): boolean {
    if (context.techniques && context.techniques.length > 0) return false;
    if (iteration > 5) return false;
    return true;
  }

  async shouldSuggestCompost(): Promise<boolean> {
    if (!this.compostMill) return false;
    const count = await this.compostMill.getSeedCount();
    return count > 5;
  }

  shouldSuggestTechnique(): boolean {
    if (this.currentIteration < 3) return false;
    return this.isTrendingDown() || this.isPlateauing(this.recentScores);
  }

  shouldSuggestEvolution(): boolean {
    return this.isPlateauing(this.recentScores);
  }

  getRecentScoreTrend(): number[] {
    return [...this.recentScores];
  }

  isPlateauing(scores: number[]): boolean {
    if (scores.length < 2) return false;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
    return variance < 0.001;
  }

  /**
   * Update iteration tracking with current iteration and score (legacy API)
   */
  updateIteration(iteration: number, score: number): void {
    this.currentIteration = iteration;
    this.recentScores.push(score);
    if (this.recentScores.length > 10) {
      this.recentScores.shift();
    }
    this.scoreHistory.scores.push(score);
    if (this.scoreHistory.scores.length > this.scoreHistory.maxLength) {
      this.scoreHistory.scores.shift();
    }
  }

  /**
   * Get swarm suggestions for a context (legacy API)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getSwarmSuggestions(_context: GenerationContext): Promise<Suggestion[]> {
    if (this.shouldSuggestSwarm(_context, this.currentIteration || _context.iteration || 1)) {
      return [{
        type: 'swarm',
        title: 'Try a new artistic approach',
        description: 'Multiple perspectives might help break through this creative block.',
        priority: 'high',
        action: async () => {},
      }];
    }
    return [];
  }

  /**
   * Get evolution suggestions for a context (legacy API)
   */
  getEvolutionSuggestions(_context: GenerationContext): Suggestion[] {
    if (this.shouldSuggestEvolution()) {
      return [{
        type: 'parameter',
        title: 'Enable evolutionary diversity',
        description: 'MAP-Elites can explore the space of possibilities and find unexpected gems.',
        priority: 'medium',
        action: async () => {},
      }];
    }
    return [];
  }

  /**
   * Check if scores are trending downward
   */
  private isTrendingDown(): boolean {
    const scores = this.scoreHistory.scores;
    if (scores.length < 3) return false;

    // Simple trend check: compare first half average to second half
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return secondAvg < firstAvg * 0.9; // 10% decline
  }

  /**
   * Create compost suggestion if we have relevant past work
   */
  private createCompostSuggestion(_context: GenerationContext): Suggestion | null {
    if (!this.compostMill) return null;
    return {
      type: 'compost',
      title: 'Use compost inspiration',
      description: 'Past work in the compost heap might spark new ideas.',
      priority: 'medium',
      action: async () => {},
    };
  }

  /**
   * Create archive learning suggestion if we have high-quality past work
   */
  private createArchiveSuggestion(): Suggestion | null {
    // Check if we have high-quality examples in HarnessMemory
    const recentEpisodes = harnessMemory.getRecentEpisodes(50);
    const generationEpisodes = recentEpisodes.filter(ep => 
      ep.type === 'generation' && ep.score !== undefined
    );
    
    if (generationEpisodes.length === 0) {
      return null;
    }

    const highQualityCount = generationEpisodes
      .filter(ep => (ep.score || 0) >= 0.8).length;

    if (highQualityCount < 3) {
      return null;
    }

    return {
      type: 'archive',
      title: 'Use archive learning',
      description: `I have ${highQualityCount} high-quality examples. Archive learning can use them for few-shot improvement.`,
      priority: 'medium',
      // Wiring the action: record a 'prompt' adaptation so the next generation's
      // prompt actually leans on the archive's best work. This routes through the
      // proven feed-forward channel — getSuccessfulAdaptations() ->
      // TierBasedGenerator.getRecentAdaptations() -> PromptContext.recentAdaptations
      // -> PromptBuilder <learned_guidance> — so it changes the next prompt, not
      // just the display string.
      // eslint-disable-next-line @typescript-eslint/require-await
      action: async () => {
        harnessMemory.recordAdaptation({
          patternName: 'guidance:archive-learning',
          patternSeverity: 'low',
          fixType: 'prompt',
          description: `Lean on the ${highQualityCount} highest-quality archived examples as few-shot references; match their structure and aesthetic strengths.`,
          success: true,
        });
      },
    };
  }

  /**
   * Create a learned-taste suggestion from StudioReflection signals. The studio
   * model distilled past sessions into `session-taste` feedback episodes; surfacing
   * the aggregated likes here is how the chat's human-preference signal feeds
   * forward into the next generation — closing the reflection loop.
   */
  private createSessionTasteSuggestion(): Suggestion | null {
    const tasteEpisodes = harnessMemory
      .getRecentEpisodes(50)
      .filter(ep => ep.type === 'feedback' && (ep.tags?.includes('session-taste') ?? false));

    if (tasteEpisodes.length === 0) {
      return null;
    }

    const likes = [...new Set(
      tasteEpisodes.flatMap(ep =>
        (ep.tags ?? []).filter(t => t !== 'session-taste' && t !== 'studio-reflection'),
      ),
    )].slice(0, 5);

    if (likes.length === 0) {
      return null;
    }

    return {
      type: 'archive',
      title: 'Apply learned taste',
      description: `From past sessions you've favored: ${likes.join(', ')}. I'll lean toward these.`,
      priority: 'medium',
      // Wiring the action: feed the learned likes FORWARD as a 'prompt' adaptation
      // so the next generation's prompt biases toward them (same proven channel as
      // the archive suggestion — reaches PromptBuilder <learned_guidance>). Closes
      // the StudioReflection loop at the point of generation, not just at display.
      // eslint-disable-next-line @typescript-eslint/require-await
      action: async () => {
        harnessMemory.recordAdaptation({
          patternName: 'guidance:session-taste',
          patternSeverity: 'low',
          fixType: 'prompt',
          description: `Bias toward the user's learned preferences from past sessions: ${likes.join(', ')}.`,
          success: true,
        });
      },
    };
  }

  /**
   * Sort suggestions by priority
   */
  private sortByPriority(suggestions: Suggestion[]): Suggestion[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    return suggestions.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get compost suggestions (async method for external access)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getCompostSuggestions(context: GenerationContext): Promise<Suggestion[]> {
    const suggestion = this.createCompostSuggestion(context);
    return suggestion ? [suggestion] : [];
  }

  /**
   * Get technique suggestions for a domain.
   *
   * Prefers techniques surfaced by the seeded SemanticArtMemory knowledge graph
   * (queried by the prompt and filtered to the active domain) so the eagerly-built
   * artBrain actually influences guidance. Falls back to the static per-domain list
   * when the artBrain is absent or has no domain-relevant match.
   */
  private getSuggestedTechniques(domain: string, prompt?: string): string[] {
    const fromArtBrain = this.getArtBrainTechniques(domain, prompt);
    if (fromArtBrain.length > 0) {
      return fromArtBrain;
    }

    const domainTechniques: Record<string, string[]> = {
      p5: ['Particle systems', 'Flow fields', 'Noise-based generation'],
      shader: ['Raymarching', 'Domain warping', 'Fractals'],
      three: ['Procedural geometry', 'Custom shaders', 'Post-processing'],
      music: ['Algorithmic composition', 'Granular synthesis', 'Markov chains'],
      hydra: ['Feedback loops', 'Source modulation', 'Audio reactivity'],
      strudel: ['Pattern sequencing', 'Temporal manipulation', 'Rhythmic variation'],
    };

    return domainTechniques[domain] || ['Procedural generation', 'Algorithmic art'];
  }

  /**
   * Query the seeded artBrain knowledge graph for techniques relevant to the prompt,
   * preferring ones whose inferred domain matches the active domain. Returns up to
   * MAX_ART_BRAIN_TECHNIQUES technique names, or [] when no artBrain / no match.
   */
  private getArtBrainTechniques(domain: string, prompt?: string): string[] {
    if (!this.artBrain || !prompt) return [];

    const matches = this.artBrain.suggestTechnique(prompt);
    if (matches.length === 0) return [];

    // Prefer techniques whose domain matches the active domain; if none match the
    // domain, fall back to the cross-domain matches so the prompt-relevant signal
    // still reaches the suggestion.
    const domainMatches = matches.filter(t => t.domain === domain);
    const chosen = (domainMatches.length > 0 ? domainMatches : matches).slice(
      0,
      MAX_ART_BRAIN_TECHNIQUES,
    );

    return chosen.map(t => t.name);
  }
}
