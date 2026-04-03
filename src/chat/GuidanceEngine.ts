/**
 * GuidanceEngine - Proactive suggestions during generation
 *
 * Analyzes generation context and suggests relevant actions:
 * - Swarm: Explore multiple artistic approaches
 * - Compost: Use past work for inspiration
 * - Technique: Try new techniques when stuck
 * - Evolution: Enable MAP-Elites for diversity
 * - Archive: Use high-quality examples from archive
 */

import { SemanticArtMemory } from '../brain/SemanticArtMemory.js';
import type { CompostMill } from '../compost/CompostMill.js';
import type { SwarmOrchestrator } from '../swarm/SwarmOrchestrator.js';
import type { GenerationContext, Suggestion } from './types.js';

// Score history for trend analysis
interface ScoreHistory {
  scores: number[];
  maxLength: number;
}

/**
 * GuidanceEngine provides proactive suggestions during creative generation
 * by analyzing context, iteration progress, and subsystem state.
 */
export class GuidanceEngine {
  artBrain: SemanticArtMemory;
  private compostMill?: CompostMill;
  // TODO: Use swarmOrchestrator for swarm-based suggestions
  // private swarmOrchestrator?: SwarmOrchestrator;
  private scoreHistory: ScoreHistory;
  private currentIteration: number = 0;

  // Expose recentScores for testing compatibility
  recentScores: number[] = [];

  // Thresholds for suggestion triggers
  private static readonly COMPOST_SEED_THRESHOLD = 5;
  private static readonly SWARM_MAX_ITERATION = 3;
  private static readonly TECHNIQUE_MIN_ITERATION = 7;
  private static readonly PLATEAU_VARIANCE_THRESHOLD = 0.05;
  private static readonly PLATEAU_MIN_SAMPLES = 4;

  constructor(
    artBrain: SemanticArtMemory,
    compostMill?: CompostMill,
    _swarmOrchestrator?: SwarmOrchestrator
  ) {
    this.artBrain = artBrain;
    this.compostMill = compostMill;
    // TODO: Store swarmOrchestrator when implementing swarm suggestions
    // this.swarmOrchestrator = _swarmOrchestrator;
    this.scoreHistory = { scores: [], maxLength: 10 };
  }

  /**
   * Main entry point: analyze context and suggest actions
   */
  suggestNextAction(context: GenerationContext | null): Suggestion[] {
    if (!context) {
      return [];
    }

    const suggestions: Suggestion[] = [];

    // Check for swarm suggestion (early iterations, open-ended prompts)
    if (this.shouldSuggestSwarm(context, this.currentIteration)) {
      suggestions.push(this.createSwarmSuggestion(context));
    }

    // Check for compost suggestion (seeds available)
    // Note: This is async, so we'll suggest based on availability check
    if (this.compostMill) {
      const compostSuggestion = this.createCompostSuggestion();
      if (compostSuggestion) {
        suggestions.push(compostSuggestion);
      }
    }

    // Check for technique suggestion (iterating without progress)
    if (this.shouldSuggestTechnique()) {
      suggestions.push(...this.getTechniqueSuggestions(context));
    }

    // Check for evolution suggestion (scores plateauing)
    if (this.shouldSuggestEvolution()) {
      suggestions.push(this.createEvolutionSuggestion());
    }

    // Check for archive suggestion (high-quality examples available)
    const archiveSuggestion = this.createArchiveSuggestion();
    if (archiveSuggestion) {
      suggestions.push(archiveSuggestion);
    }

    // Sort by priority (high first)
    return this.sortByPriority(suggestions);
  }

  /**
   * Update iteration tracking for context-aware suggestions
   */
  updateIteration(iteration: number, score: number): void {
    this.currentIteration = iteration;
    this.scoreHistory.scores.push(score);
    if (this.scoreHistory.scores.length > this.scoreHistory.maxLength) {
      this.scoreHistory.scores.shift();
    }
    // Sync with recentScores for compatibility (after shift)
    this.recentScores = [...this.scoreHistory.scores];
  }

  /**
   * Check if swarm should be suggested
   */
  private shouldSuggestSwarm(context: GenerationContext, iteration: number): boolean {
    // Suggest swarm for early iterations (1-3)
    if (iteration > GuidanceEngine.SWARM_MAX_ITERATION) {
      return false;
    }

    // Don't suggest if techniques are already specified
    if (context.techniques && context.techniques.length > 0) {
      return false;
    }

    // Check for open-ended prompt indicators
    const openEndedKeywords = [
      'something', 'abstract', 'explore', 'experiment',
      'calming', 'interesting', 'creative', 'artistic'
    ];
    const promptLower = context.prompt.toLowerCase();
    return openEndedKeywords.some(keyword => promptLower.includes(keyword));
  }

  /**
   * Check if compost should be suggested
   */
  private async shouldSuggestCompost(): Promise<boolean> {
    if (!this.compostMill) {
      return false;
    }

    try {
      const seedCount = await this.compostMill.getSeedCount();
      return seedCount >= GuidanceEngine.COMPOST_SEED_THRESHOLD;
    } catch {
      return false;
    }
  }

  /**
   * Check if technique should be suggested
   */
  private shouldSuggestTechnique(): boolean {
    // Suggest techniques after many iterations without progress
    return this.currentIteration >= GuidanceEngine.TECHNIQUE_MIN_ITERATION;
  }

  /**
   * Check if evolution should be suggested
   */
  private shouldSuggestEvolution(): boolean {
    const recentScores = this.getRecentScoreTrend();
    return this.isPlateauing(recentScores);
  }

  /**
   * Get recent score trend for analysis
   */
  private getRecentScoreTrend(): number[] {
    return [...this.recentScores];
  }

  /**
   * Check if scores are plateauing (low variance and not improving)
   */
  private isPlateauing(scores: number[]): boolean {
    if (scores.length < GuidanceEngine.PLATEAU_MIN_SAMPLES) {
      return false;
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => {
      return sum + Math.pow(score - mean, 2);
    }, 0) / scores.length;

    // Check if scores are improving (positive trend)
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const improvement = secondAvg - firstAvg;

    // Plateauing if low variance AND not improving significantly
    return variance < GuidanceEngine.PLATEAU_VARIANCE_THRESHOLD && improvement < 0.1;
  }

  /**
   * Create swarm suggestion
   */
  private createSwarmSuggestion(context: GenerationContext): Suggestion {
    return {
      type: 'swarm',
      title: 'Explore 7 artistic approaches',
      description: `I can generate 7 variations using different artistic personas to find the best direction for your ${context.domain} work.`,
      priority: 'high',
    };
  }

  /**
   * Create compost suggestion (sync version based on availability)
   */
  private createCompostSuggestion(): Suggestion | null {
    // Return suggestion if compost mill is available
    // The actual seed count will be checked when the suggestion is triggered
    if (!this.compostMill) {
      return null;
    }

    return {
      type: 'compost',
      title: 'Use compost seeds',
      description: 'I have quality seeds from your past work. Want me to inject them into generation for inspiration?',
      priority: 'medium',
      action: async () => {
        // Enable compost seed injection for next iteration
        // This would be wired into the generation pipeline via PromptEnhancer
      }
    };
  }

  /**
   * Get technique suggestions from art brain
   */
  private getTechniqueSuggestions(context: GenerationContext): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Get technique suggestions from SemanticArtMemory
    const techniques = this.artBrain.suggestTechnique(context.prompt);

    // Take top 2 most relevant techniques
    for (const technique of techniques.slice(0, 2)) {
      suggestions.push({
        type: 'technique',
        title: `Try ${technique.name}`,
        description: technique.description,
        priority: 'medium',
      });
    }

    // Fallback: if no techniques found but we should suggest one, provide a generic suggestion
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'technique',
        title: 'Try a new technique',
        description: 'You\'ve been iterating for a while. Try experimenting with a different artistic technique to break through.',
        priority: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Create evolution suggestion
   */
  private createEvolutionSuggestion(): Suggestion {
    return {
      type: 'parameter',
      title: 'Enable diversity optimization',
      description: 'Scores are plateauing. MAP-Elites can explore diverse behaviors to help break through.',
      priority: 'high',
    };
  }

  /**
   * Create archive suggestion
   */
  private createArchiveSuggestion(): Suggestion | null {
    // Check if we have high-quality examples in episodic memory
    const pastArtworks = this.artBrain['artworkCache'];
    if (!pastArtworks || pastArtworks.size === 0) {
      return null;
    }

    const highQualityCount = Array.from(pastArtworks.values())
      .filter(art => (art.score || 0) >= 0.8).length;

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
  async getCompostSuggestions(): Promise<Suggestion[]> {
    if (!(await this.shouldSuggestCompost())) {
      return [];
    }

    try {
      const seedCount = await this.compostMill!.getSeedCount();

      return [{
        type: 'compost',
        title: 'Use compost seeds',
        description: `I have ${seedCount} quality seeds from your past work. Want me to inject them into generation?`,
        priority: 'medium',
        action: async () => {
          // Enable compost seed injection
        }
      }];
    } catch {
      return [];
    }
  }

  /**
   * Get swarm suggestions (async method for external access)
   */
  getSwarmSuggestions(context: GenerationContext): Suggestion[] {
    if (!this.shouldSuggestSwarm(context, this.currentIteration)) {
      return [];
    }

    return [{
      type: 'swarm',
      title: 'Explore 7 artistic approaches',
      description: 'I can generate 7 variations using different artistic personas to find the best direction.',
      priority: 'high',
    }];
  }

  /**
   * Get evolution suggestions (sync method for external access)
   */
  getEvolutionSuggestions(_context: GenerationContext): Suggestion[] {
    if (!this.shouldSuggestEvolution()) {
      return [];
    }

    return [this.createEvolutionSuggestion()];
  }
}
