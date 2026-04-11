/**
 * StagnationDetector - Stagnation detection with self-reflection improvement
 *
 * Tracks iteration scores and detects when the loop is stagnating.
 * Uses SelfReflectionEngine to suggest improvements before breaking.
 *
 * Extracted from RalphLoop.ts (lines 604-650).
 */

import { SelfReflectionEngine } from '../improvement/SelfReflection.js';
import { ContextAccumulation } from './ContextAccumulation.js';
import { SuccessRateTracker, type SuccessRateConfig } from './SuccessRateTracker.js';

export interface StagnationCheckResult {
  shouldBreak: boolean;
  reason: string;
  /** Whether high-exploration mode is recommended */
  exploreAggressively?: boolean;
  /** Current success rate (0-1) */
  successRate?: number;
}

/**
 * Detects stagnation and attempts recovery via self-reflection.
 * Also tracks success rate for adaptive exploration.
 */
export class StagnationDetector {
  private bestScore = 0;
  private iterationsSinceLastImprovement = 0;
  private readonly selfReflection = new SelfReflectionEngine();
  private readonly successRateTracker: SuccessRateTracker;

  constructor(
    private stagnationThreshold: number,
    successRateConfig?: SuccessRateConfig
  ) {
    this.successRateTracker = new SuccessRateTracker(successRateConfig);
  }

  /**
   * Check for stagnation after each iteration.
   * Returns whether the loop should break and the reason.
   *
   * High novelty resets stagnation — the system is exploring
   * even if quality plateaus.
   */
  check(
    iteration: number,
    evaluationScore: number,
    noveltyScore: number,
    prompt: string,
    domain?: string,
  ): StagnationCheckResult {
    // Record this attempt for success rate tracking
    const isSuccess = evaluationScore > 0.7;
    this.successRateTracker.recordAttempt(isSuccess);

    // Feed quality data into self-reflection for trend analysis
    this.selfReflection.recordScore({
      iteration,
      timestamp: Date.now(),
      overallScore: evaluationScore,
      technicalScore: evaluationScore,
      aestheticScore: 0,
      noveltyScore,
      domain: domain ?? 'p5',
    });

    // High novelty resets stagnation
    if (noveltyScore > 0.5) {
      this.iterationsSinceLastImprovement = Math.max(0, this.iterationsSinceLastImprovement - 1);
    }

    if (evaluationScore > this.bestScore) {
      this.bestScore = evaluationScore;
      this.iterationsSinceLastImprovement = 0;
      return {
        shouldBreak: false,
        reason: '',
        exploreAggressively: this.successRateTracker.shouldExploreAggressively(),
        successRate: this.successRateTracker.getSuccessRate(),
      };
    }

    this.iterationsSinceLastImprovement++;

    if (
      this.stagnationThreshold != null &&
      this.stagnationThreshold > 0 &&
      this.iterationsSinceLastImprovement >= this.stagnationThreshold
    ) {
      // Use self-reflection to check if improvement is possible
      const suggestions = this.selfReflection.analyze();
      const improvementSpec = suggestions.length > 0
        ? this.selfReflection.designImprovementSpec(suggestions[0])
        : null;

      if (improvementSpec) {
        // Give the loop one more chance via improvement suggestion
        if (this.iterationsSinceLastImprovement === this.stagnationThreshold) {
          ContextAccumulation.save({
            iteration: iteration + 0.5,
            prompt,
            usedPrompt: improvementSpec,
            code: '',
            evaluation: { score: 0, issues: [suggestions[0].description] },
            timestamp: new Date().toISOString(),
            maxIterations: undefined,
          });
          // Reset counter to give improvement a chance
          this.iterationsSinceLastImprovement = 0;
          return {
            shouldBreak: false,
            reason: '',
            exploreAggressively: this.successRateTracker.shouldExploreAggressively(),
            successRate: this.successRateTracker.getSuccessRate(),
          };
        } else {
          return {
            shouldBreak: true,
            reason: `stagnation detected (${this.iterationsSinceLastImprovement} iterations without improvement)`,
            exploreAggressively: this.successRateTracker.shouldExploreAggressively(),
            successRate: this.successRateTracker.getSuccessRate(),
          };
        }
      } else {
        return {
          shouldBreak: true,
          reason: `stagnation detected (${this.iterationsSinceLastImprovement} iterations without improvement)`,
          exploreAggressively: this.successRateTracker.shouldExploreAggressively(),
          successRate: this.successRateTracker.getSuccessRate(),
        };
      }
    }

    return {
      shouldBreak: false,
      reason: '',
      exploreAggressively: this.successRateTracker.shouldExploreAggressively(),
      successRate: this.successRateTracker.getSuccessRate(),
    };
  }

  /**
   * Check if we should explore aggressively based on success rate.
   * Returns true when success rate drops below 1/5th (20%).
   */
  shouldExploreAggressively(): boolean {
    return this.successRateTracker.shouldExploreAggressively();
  }

  /**
   * Get the current success rate (0-1).
   */
  getSuccessRate(): number {
    return this.successRateTracker.getSuccessRate();
  }

  /**
   * Get a snapshot of success rate metrics.
   */
  getSuccessRateSnapshot() {
    return this.successRateTracker.getSnapshot();
  }
}
