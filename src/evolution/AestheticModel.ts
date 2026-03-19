/**
 * K-NN weighted average prediction from human feedback.
 * Predicts quality [0, 1] for a behavior vector based on similar rated creations.
 */

import fs from 'fs/promises';

export interface AestheticDataPoint {
  behavior: number[];
  rating: number;    // 0-5
  domain: string;
}

export class AestheticModel {
  private data: AestheticDataPoint[];
  private kNeighbors: number;

  constructor(kNeighbors?: number) {
    this.kNeighbors = kNeighbors ?? 5;
    this.data = [];
  }

  /** Euclidean distance between two vectors, with zero-padding for dimension mismatch */
  private distance(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < dim; i++) {
      const ai = i < a.length ? a[i] : 0;
      const bi = i < b.length ? b[i] : 0;
      const diff = ai - bi;
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Predict quality [0, 1] for a behavior vector based on similar rated creations.
   * Uses inverse-distance weighted average of k nearest neighbors' ratings.
   * Domain bonus: matching domain multiplies weight by 1.5.
   */
  predict(behavior: number[], metadata: { domain: string }): number {
    if (this.data.length === 0) return 0.5;

    const k = Math.min(this.kNeighbors, this.data.length);
    const distances = this.data.map((point) => ({
      point,
      dist: this.distance(behavior, point.behavior),
    }));
    distances.sort((a, b) => a.dist - b.dist);

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < k; i++) {
      const { point, dist } = distances[i];
      let weight = dist === 0 ? 1.0 : 1.0 / dist;
      if (point.domain === metadata.domain) {
        weight *= 1.5;
      }
      weightedSum += weight * point.rating;
      totalWeight += weight;
    }

    return (weightedSum / totalWeight) / 5;
  }

  /** Add training data from human feedback */
  update(feedbacks: AestheticDataPoint[]): void {
    this.data.push(...feedbacks);
  }

  /** Save model data to JSON file */
  async save(path: string): Promise<void> {
    await fs.writeFile(path, JSON.stringify(this.data), 'utf-8');
  }

  /** Load model data from JSON file */
  async load(path: string): Promise<void> {
    const raw = await fs.readFile(path, 'utf-8');
    this.data = JSON.parse(raw) as AestheticDataPoint[];
  }

  /** Get number of training data points */
  size(): number {
    return this.data.length;
  }

  /** Clear all training data */
  clear(): void {
    this.data = [];
  }
}
