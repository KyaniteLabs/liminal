/**
 * FitnessCombiner — multi-axis weighted fitness for creative evolution.
 *
 * Computes fitness as a weighted combination of:
 * - novelty (0-1): how different from previous outputs
 * - quality (0-1): code quality / aesthetic score
 * - technical (0-1): technical complexity / correctness
 * - diversity (0-1): behavior-space diversity contribution
 */

export interface FitnessWeights {
  novelty: number;
  quality: number;
  technical: number;
  diversity: number;
}

export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  novelty: 0.4,
  quality: 0.3,
  technical: 0.2,
  diversity: 0.1,
};

export interface FitnessComponents {
  novelty: number;
  quality: number;
  technical: number;
  diversity: number;
}

export interface RankedItem {
  id: string;
  fitness: number;
  components: FitnessComponents;
}

export class FitnessCombiner {
  private weights: FitnessWeights;

  constructor(weights?: Partial<FitnessWeights>) {
    this.weights = { ...DEFAULT_FITNESS_WEIGHTS, ...weights };
    this.validateWeights();
  }

  /** Compute weighted fitness from component scores. All inputs clamped to [0,1]. */
  calculate(components: FitnessComponents): number {
    const c = this.clampComponents(components);
    return c.novelty * this.weights.novelty
      + c.quality * this.weights.quality
      + c.technical * this.weights.technical
      + c.diversity * this.weights.diversity;
  }

  /** Batch calculation for multiple items. */
  calculateBatch(items: Array<{ id: string; components: FitnessComponents }>): RankedItem[] {
    return items.map(item => ({
      id: item.id,
      fitness: this.calculate(item.components),
      components: item.components,
    }));
  }

  /** Rank items by fitness (descending). */
  rank(items: Array<{ id: string; components: FitnessComponents }>): RankedItem[] {
    return this.calculateBatch(items).sort((a, b) => b.fitness - a.fitness);
  }

  /** Update weights. Validates they sum to ~1.0 (within 0.01 tolerance). */
  setWeights(weights: Partial<FitnessWeights>): void {
    this.weights = { ...this.weights, ...weights };
    this.validateWeights();
  }

  getWeights(): FitnessWeights { return { ...this.weights }; }

  private validateWeights(): void {
    const sum = this.weights.novelty + this.weights.quality + this.weights.technical + this.weights.diversity;
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(`Fitness weights must sum to 1.0, got ${sum.toFixed(3)}`);
    }
  }

  private clampComponents(c: FitnessComponents): FitnessComponents {
    return {
      novelty: Math.max(0, Math.min(1, c.novelty)),
      quality: Math.max(0, Math.min(1, c.quality)),
      technical: Math.max(0, Math.min(1, c.technical)),
      diversity: Math.max(0, Math.min(1, c.diversity)),
    };
  }
}
