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

  constructor() {
    // GuidanceEngine consolidated - uses HarnessMemory for suggestions
  }

  /**
   * Generate suggestions based on current generation context
   */
  async generateSuggestions(context: GenerationContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Update score history
    this.updateScoreHistory(context.currentScore);

    // Check various conditions and add relevant suggestions
    const swarmSuggestion = this.createSwarmSuggestion(context);
    if (swarmSuggestion) suggestions.push(swarmSuggestion);

    const compostSuggestion = this.createCompostSuggestion(context);
    if (compostSuggestion) suggestions.push(compostSuggestion);

    const techniqueSuggestion = this.createTechniqueSuggestion(context);
    if (techniqueSuggestion) suggestions.push(techniqueSuggestion);

    const evolutionSuggestion = this.createEvolutionSuggestion(context);
    if (evolutionSuggestion) suggestions.push(evolutionSuggestion);

    const archiveSuggestion = this.createArchiveSuggestion();
    if (archiveSuggestion) suggestions.push(archiveSuggestion);

    return this.sortByPriority(suggestions);
  }

  /**
   * Update score history for trend analysis
   */
  private updateScoreHistory(score: number): void {
    this.scoreHistory.scores.push(score);
    if (this.scoreHistory.scores.length > this.scoreHistory.maxLength) {
      this.scoreHistory.scores.shift();
    }
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
   * Create swarm suggestion if appropriate
   */
  private createSwarmSuggestion(context: GenerationContext): Suggestion | null {
    // Suggest swarm for high-ambition prompts or when stuck
    if (context.iteration > 5 && context.currentScore < 0.6) {
      return {
        type: 'swarm',
        title: 'Try multi-persona swarm',
        description: 'Multiple perspectives might help break through this creative block.',
        priority: 'high',
        action: async () => {
          // Would trigger swarm mode
        }
      };
    }

    if (context.currentScore > 0.8 && context.iteration < 3) {
      return {
        type: 'swarm',
        title: 'Explore with swarm',
        description: 'Good start! Swarm mode can explore multiple artistic approaches.',
        priority: 'medium',
        action: async () => {
          // Would trigger swarm mode
        }
      };
    }

    return null;
  }

  /**
   * Create compost suggestion if we have relevant past work
   */
  private createCompostSuggestion(_context: GenerationContext): Suggestion | null {
    // Compost integration temporarily disabled during consolidation
    // Will be restored using HarnessMemory for fragment retrieval
    return null;
  }

  /**
   * Create technique suggestion when stuck
   */
  private createTechniqueSuggestion(context: GenerationContext): Suggestion | null {
    // Only suggest techniques when scores are trending down
    if (!this.isTrendingDown()) return null;

    // Don't suggest too early
    if (context.iteration < 3) return null;

    const techniques = this.getSuggestedTechniques(context.domain);

    return {
      type: 'technique',
      title: 'Try a new technique',
      description: `Consider: ${techniques.join(', ')}`,
      priority: 'high',
      action: async () => {
        // Would inject technique suggestions into prompt
      }
    };
  }

  /**
   * Create MAP-Elites suggestion for diversity
   */
  private createEvolutionSuggestion(context: GenerationContext): Suggestion | null {
    // Suggest MAP-Elites for exploration when we have good scores
    if (context.currentScore < 0.7) return null;

    return {
      type: 'evolution',
      title: 'Enable evolutionary diversity',
      description: 'MAP-Elites can explore the space of possibilities and find unexpected gems.',
      priority: 'low',
      action: async () => {
        // Would enable MAP-Elites
      }
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
      action: async () => {
        // Enable archive learning for next iteration
        // This would be wired into the generation pipeline via PromptEnhancer
      }
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
  async getCompostSuggestions(context: GenerationContext): Promise<Suggestion[]> {
    const suggestion = this.createCompostSuggestion(context);
    return suggestion ? [suggestion] : [];
  }

  /**
   * Get technique suggestions for a domain
   */
  private getSuggestedTechniques(domain: string): string[] {
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
}
