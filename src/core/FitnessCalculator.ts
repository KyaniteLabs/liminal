/**
 * FitnessCalculator - Configurable fitness score aggregation
 *
 * Computes an overall fitness score from dimension scores using
 * configurable weights. Enables MetaMode to experiment with
 * weight ratios (e.g., prioritize novelty over technical quality).
 */

export interface FitnessWeights {
  technical?: number;
  aesthetic?: number;
  novelty?: number;
  /** Fallback weight for unrecognized dimensions */
  default?: number;
}

export interface DimensionScores {
  technical?: number;
  aesthetic?: number;
  novelty?: number;
  [key: string]: number | undefined;
}

export class FitnessCalculator {
  private weights: Required<FitnessWeights>;

  constructor(weights?: FitnessWeights) {
    this.weights = {
      technical: weights?.technical ?? 1,
      aesthetic: weights?.aesthetic ?? 1,
      novelty: weights?.novelty ?? 1,
      default: weights?.default ?? 1,
    };
  }

  /**
   * Calculate overall fitness from dimension scores.
   * Weighted average of all provided dimensions.
   *
   * @param scores - Object with dimension name → score (0-1)
   * @returns Overall fitness score (0-1)
   */
  calculate(scores: DimensionScores): number {
    const entries = Object.entries(scores).filter(
      ([, val]) => val !== undefined && val !== null,
    ) as [string, number][];

    if (entries.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [dimension, score] of entries) {
      const weight = this.weights[dimension as keyof FitnessWeights] ?? this.weights.default;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Get the current weights (for MetaMode inspection/logging).
   */
  getWeights(): Readonly<Required<FitnessWeights>> {
    return { ...this.weights };
  }

  /**
   * Update weights (e.g., from MetaMode experiment results).
   */
  setWeights(weights: Partial<FitnessWeights>): void {
    Object.assign(this.weights, weights);
  }

  /**
   * Legacy mode: compute fitness using hardcoded technical/creative ratio.
   * Matches CreativeEvaluator's default behavior: technical * 0.6 + creative * 0.4.
   */
  static legacy(technicalScore: number, creativeScore: number): number {
    return technicalScore * 0.6 + creativeScore * 0.4;
  }
}
