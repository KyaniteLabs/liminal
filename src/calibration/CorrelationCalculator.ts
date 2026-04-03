/**
 * CorrelationCalculator - Statistical correlation functions for calibration
 *
 * Provides:
 * - Pearson correlation: linear relationship between two datasets
 * - Spearman rank correlation: monotonic relationship (rank-based)
 * - Linear regression: find optimal weights
 */

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export interface CorrelationResult {
  pearson: number;
  spearman: number;
  sampleSize: number;
  significance?: number;
}

export class CorrelationCalculator {
  /**
   * Calculate Pearson correlation coefficient (-1 to 1)
   * Measures linear correlation between two arrays
   */
  static pearson(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have same length');
    }
    if (x.length < 2) {
      return 0;
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * Calculate Spearman rank correlation coefficient (-1 to 1)
   * Measures monotonic correlation using ranks
   */
  static spearman(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have same length');
    }
    if (x.length < 2) {
      return 0;
    }

    const rankX = this.calculateRanks(x);
    const rankY = this.calculateRanks(y);

    return this.pearson(rankX, rankY);
  }

  /**
   * Calculate both Pearson and Spearman correlations
   */
  static calculateBoth(x: number[], y: number[]): CorrelationResult {
    return {
      pearson: this.pearson(x, y),
      spearman: this.spearman(x, y),
      sampleSize: x.length,
    };
  }

  /**
   * Calculate ranks for an array (for Spearman)
   * Uses average ranks for ties
   */
  private static calculateRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);

    const ranks = new Array(values.length);
    let i = 0;
    while (i < indexed.length) {
      let j = i;
      // Find all ties
      while (j < indexed.length && indexed[j].value === indexed[i].value) {
        j++;
      }
      // Average rank for ties (1-indexed)
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[indexed[k].index] = avgRank;
      }
      i = j;
    }

    return ranks;
  }

  /**
   * Perform simple linear regression: y = slope * x + intercept
   */
  static linearRegression(x: number[], y: number[]): RegressionResult {
    if (x.length !== y.length) {
      throw new Error('Arrays must have same length');
    }
    if (x.length < 2) {
      return { slope: 1, intercept: 0, rSquared: 0 };
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((total, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return total + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

    return { slope, intercept, rSquared };
  }

  /**
   * Find optimal weights to maximize correlation using gradient descent
   * Returns weights that minimize squared error between predicted and actual
   */
  static findOptimalWeights(
    features: number[][],
    target: number[],
    learningRate = 0.01,
    iterations = 1000,
  ): number[] {
    if (features.length === 0 || features[0].length === 0) {
      return [];
    }

    const numSamples = features.length;
    const numFeatures = features[0].length;

    // Initialize weights to 1/numFeatures (equal weighting)
    let weights = new Array(numFeatures).fill(1 / numFeatures);

    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new Array(numFeatures).fill(0);

      // Calculate gradients
      for (let i = 0; i < numSamples; i++) {
        const prediction = features[i].reduce((sum, feat, j) => sum + feat * weights[j], 0);
        const error = prediction - target[i];

        for (let j = 0; j < numFeatures; j++) {
          gradients[j] += (2 / numSamples) * error * features[i][j];
        }
      }

      // Update weights
      for (let j = 0; j < numFeatures; j++) {
        weights[j] -= learningRate * gradients[j];
      }

      // Normalize weights to sum to 1
      const sumWeights = weights.reduce((a, b) => a + b, 0);
      if (sumWeights !== 0) {
        weights = weights.map(w => w / sumWeights);
      }
    }

    return weights;
  }

  /**
   * Check if correlation is considered "good" (> 0.7)
   */
  static isGoodCalibration(correlation: number): boolean {
    return Math.abs(correlation) > 0.7;
  }

  /**
   * Calculate mean squared error between predicted and actual values
   */
  static meanSquaredError(predicted: number[], actual: number[]): number {
    if (predicted.length !== actual.length) {
      throw new Error('Arrays must have same length');
    }
    if (predicted.length === 0) {
      return 0;
    }

    const squaredErrors = predicted.map((p, i) => Math.pow(p - actual[i], 2));
    return squaredErrors.reduce((a, b) => a + b, 0) / predicted.length;
  }

  /**
   * Normalize array values to [0, 1] range
   */
  static normalize(values: number[]): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) {
      return values.map(() => 0.5);
    }

    return values.map(v => (v - min) / range);
  }
}
