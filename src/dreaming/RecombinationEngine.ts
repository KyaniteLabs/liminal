/**
 * RecombinationEngine — Phase 15
 *
 * Combines artifacts by blending descriptor vectors, merging
 * structural elements, and generating candidate descriptors.
 * This is the core of dreaming — creating novel artifacts from
 * existing ones without executing code.
 */

export interface RecombinationResult {
  /** The recombined descriptor vector */
  descriptor: number[];
  /** Strategy used */
  strategy: RecombinationStrategy;
  /** Parent IDs */
  parentIds: string[];
  /** How novel the recombination is vs parents */
  noveltyScore: number;
}

export type RecombinationStrategy =
  | 'interpolate'
  | 'extrapolate'
  | 'crossover'
  | 'mutation';

export interface RecombinationConfig {
  /** Interpolation blend factor (0–1, default: 0.5) */
  blendFactor?: number;
  /** Mutation magnitude for mutation strategy (default: 0.15) */
  mutationMagnitude?: number;
  /** Extrapolation distance (default: 0.3) */
  extrapolationDistance?: number;
}

const DEFAULT_BLEND = 0.5;
const DEFAULT_MUTATION = 0.15;
const DEFAULT_EXTRAPOLATION = 0.3;

export class RecombinationEngine {
  private readonly blendFactor: number;
  private readonly mutationMagnitude: number;
  private readonly extrapolationDistance: number;

  constructor(config: RecombinationConfig = {}) {
    this.blendFactor = config.blendFactor ?? DEFAULT_BLEND;
    this.mutationMagnitude = config.mutationMagnitude ?? DEFAULT_MUTATION;
    this.extrapolationDistance = config.extrapolationDistance ?? DEFAULT_EXTRAPOLATION;
  }

  /**
   * Recombine two parent artifacts into a candidate descriptor.
   */
  recombine(
    parentA: { id: string; descriptor: number[] },
    parentB: { id: string; descriptor: number[] },
    strategy?: RecombinationStrategy,
  ): RecombinationResult {
    const strat = strategy ?? 'interpolate';
    let descriptor: number[];

    switch (strat) {
      case 'interpolate':
        descriptor = this.interpolate(parentA.descriptor, parentB.descriptor);
        break;
      case 'extrapolate':
        descriptor = this.extrapolate(parentA.descriptor, parentB.descriptor);
        break;
      case 'crossover':
        descriptor = this.crossover(parentA.descriptor, parentB.descriptor);
        break;
      case 'mutation':
        descriptor = this.mutate(parentA.descriptor);
        break;
    }

    const noveltyScore = this.computeNovelty(descriptor, parentA.descriptor, parentB.descriptor);

    return {
      descriptor,
      strategy: strat,
      parentIds: [parentA.id, parentB.id],
      noveltyScore,
    };
  }

  /**
   * Interpolate: weighted average of parent descriptors.
   */
  private interpolate(a: number[], b: number[]): number[] {
    const dim = Math.max(a.length, b.length);
    const result: number[] = [];
    for (let i = 0; i < dim; i++) {
      const va = a[i] ?? 0.5;
      const vb = b[i] ?? 0.5;
      result.push(Math.max(0, Math.min(1, va * this.blendFactor + vb * (1 - this.blendFactor))));
    }
    return result;
  }

  /**
   * Extrapolate: extend beyond the line between parents.
   */
  private extrapolate(a: number[], b: number[]): number[] {
    const dim = Math.max(a.length, b.length);
    const result: number[] = [];
    for (let i = 0; i < dim; i++) {
      const va = a[i] ?? 0.5;
      const vb = b[i] ?? 0.5;
      const mid = (va + vb) / 2;
      const dir = vb - va;
      const ext = mid + dir * this.extrapolationDistance;
      result.push(Math.max(0, Math.min(1, ext)));
    }
    return result;
  }

  /**
   * Crossover: take some dimensions from each parent.
   */
  private crossover(a: number[], b: number[]): number[] {
    const dim = Math.max(a.length, b.length);
    const result: number[] = [];
    const crossPoint = Math.floor(dim / 2);
    for (let i = 0; i < dim; i++) {
      const va = a[i] ?? 0.5;
      const vb = b[i] ?? 0.5;
      result.push(i < crossPoint ? va : vb);
    }
    return result;
  }

  /**
   * Mutate: small random perturbation of a single parent.
   */
  private mutate(a: number[]): number[] {
    return a.map(v => {
      const shift = (Math.random() - 0.5) * 2 * this.mutationMagnitude;
      return Math.max(0, Math.min(1, v + shift));
    });
  }

  /**
   * Compute how novel the recombination is compared to its parents.
   */
  private computeNovelty(child: number[], parentA: number[], parentB: number[]): number {
    const distA = this.euclideanDist(child, parentA);
    const distB = this.euclideanDist(child, parentB);
    const avgDist = (distA + distB) / 2;
    // Normalize by max possible distance in the unit hypercube
    const maxDist = Math.sqrt(child.length);
    return maxDist > 0 ? Math.min(1, avgDist / maxDist) : 0;
  }

  private euclideanDist(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      const va = a[i] ?? 0.5;
      const vb = b[i] ?? 0.5;
      sumSq += (va - vb) ** 2;
    }
    return Math.sqrt(sumSq);
  }
}
