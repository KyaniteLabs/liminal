/**
 * SuccessRateTracker - Tracks rolling success rate for adaptive exploration
 *
 * Monitors the last N attempts and calculates success rate.
 * When success rate drops below threshold (1/5th = 20%),
 * triggers high-exploration mode to increase diversity.
 */

export interface SuccessRateConfig {
  /** Number of recent attempts to track (default: 20) */
  windowSize?: number;
  /** Success rate threshold for high-exploration mode (default: 0.2 = 20%) */
  explorationThreshold?: number;
  /** Success rate to recover to before exiting high-exploration mode (default: 0.3 = 30%) */
  recoveryThreshold?: number;
}

export interface SuccessRateSnapshot {
  /** Current rolling success rate (0-1) */
  successRate: number;
  /** Number of attempts in window */
  attempts: number;
  /** Number of successes in window */
  successes: number;
  /** Whether currently in high-exploration mode */
  isHighExploration: boolean;
  /** How long (in attempts) we've been in high-exploration mode */
  highExplorationDuration: number;
}

/**
 * Tracks success/failure of attempts and provides rolling success rate.
 * Triggers high-exploration mode when success rate drops below threshold.
 */
export class SuccessRateTracker {
  private readonly windowSize: number;
  private readonly explorationThreshold: number;
  private readonly recoveryThreshold: number;
  private readonly attempts: boolean[] = [];
  private isHighExploration = false;
  private highExplorationStartIndex = 0;

  constructor(config: SuccessRateConfig = {}) {
    this.windowSize = config.windowSize ?? 20;
    this.explorationThreshold = config.explorationThreshold ?? 0.2;
    this.recoveryThreshold = config.recoveryThreshold ?? 0.3;
  }

  /**
   * Record an attempt result
   * @param success - Whether the attempt was successful
   */
  recordAttempt(success: boolean): void {
    this.attempts.push(success);

    // Maintain window size
    if (this.attempts.length > this.windowSize) {
      this.attempts.shift();
    }

    // Check if we should enter or exit high-exploration mode
    this.updateExplorationMode();
  }

  /**
   * Get the current rolling success rate (0-1)
   * Returns 0 if no attempts recorded yet
   */
  getSuccessRate(): number {
    if (this.attempts.length === 0) {
      return 0;
    }

    const successes = this.attempts.filter(a => a).length;
    return successes / this.attempts.length;
  }

  /**
   * Get the number of attempts in the current window
   */
  getAttemptCount(): number {
    return this.attempts.length;
  }

  /**
   * Get the number of successes in the current window
   */
  getSuccessCount(): number {
    return this.attempts.filter(a => a).length;
  }

  /**
   * Check if we should explore aggressively (success rate below threshold)
   */
  shouldExploreAggressively(): boolean {
    return this.isHighExploration;
  }

  /**
   * Get a snapshot of current success rate metrics
   */
  getSnapshot(): SuccessRateSnapshot {
    return {
      successRate: this.getSuccessRate(),
      attempts: this.getAttemptCount(),
      successes: this.getSuccessCount(),
      isHighExploration: this.isHighExploration,
      highExplorationDuration: this.getHighExplorationDuration(),
    };
  }

  /**
   * Reset the tracker (clears all history)
   */
  reset(): void {
    this.attempts.length = 0;
    this.isHighExploration = false;
    this.highExplorationStartIndex = 0;
  }

  /**
   * Get recommended number of candidates based on current mode
   * @param baseCandidates - Base number of candidates
   * @returns Adjusted number of candidates
   */
  getRecommendedCandidates(baseCandidates: number): number {
    if (this.isHighExploration) {
      // In high-exploration mode, generate more candidates
      return Math.max(baseCandidates + 2, Math.ceil(baseCandidates * 1.5));
    }
    return baseCandidates;
  }

  /**
   * Get recommended quality threshold adjustment
   * @returns Multiplier for quality threshold (lower = more lenient)
   */
  getQualityThresholdMultiplier(): number {
    if (this.isHighExploration) {
      // Lower threshold in high-exploration mode (more lenient)
      return 0.85;
    }
    return 1.0;
  }

  private updateExplorationMode(): void {
    const successRate = this.getSuccessRate();

    if (!this.isHighExploration) {
      // Check if we should enter high-exploration mode
      // Only trigger if we have enough samples (at least 5 attempts)
      // Use strict < comparison: need LESS than 20% (not <=)
      if (this.attempts.length >= 5 && successRate < this.explorationThreshold) {
        this.isHighExploration = true;
        this.highExplorationStartIndex = this.attempts.length;
      }
    } else {
      // Check if we should exit high-exploration mode
      // Require higher threshold to exit (hysteresis to avoid flapping)
      if (successRate >= this.recoveryThreshold) {
        this.isHighExploration = false;
        this.highExplorationStartIndex = 0;
      }
    }
  }

  private getHighExplorationDuration(): number {
    if (!this.isHighExploration) {
      return 0;
    }
    return this.attempts.length - this.highExplorationStartIndex;
  }
}

/**
 * Factory function to create a SuccessRateTracker with default config
 */
export function createSuccessRateTracker(config?: SuccessRateConfig): SuccessRateTracker {
  return new SuccessRateTracker(config);
}
