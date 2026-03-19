/**
 * K-NN novelty scoring archive.
 * Pure data structure, no external dependencies.
 */

export class NoveltyArchive {
  private items: number[][];
  private capacity: number;
  private kNeighbors: number;

  constructor(capacity?: number, kNeighbors?: number) {
    this.capacity = capacity ?? 1000;
    this.kNeighbors = kNeighbors ?? 5;
    this.items = [];
  }

  add(behavior: number[]): void {
    if (this.items.length >= this.capacity) {
      this.items.shift(); // FIFO eviction
    }
    this.items.push([...behavior]);
  }

  /** Euclidean distance between two vectors, normalized by sqrt(dimensions) */
  private distance(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < dim; i++) {
      const ai = i < a.length ? a[i] : 0;
      const bi = i < b.length ? b[i] : 0;
      const diff = ai - bi;
      sum += diff * diff;
    }
    return Math.sqrt(sum) / Math.sqrt(dim);
  }

  /**
   * Compute novelty score for a behavior vector [0, 1].
   * Higher = more novel. Average Euclidean distance to k nearest neighbors.
   */
  noveltyScore(behavior: number[]): number {
    if (this.items.length === 0) return 1.0;

    const k = Math.min(this.kNeighbors, this.items.length);
    const distances = this.items.map((item) => this.distance(behavior, item));
    distances.sort((a, b) => a - b);

    let total = 0;
    for (let i = 0; i < k; i++) {
      total += distances[i];
    }
    return total / k;
  }

  /** Sparseness metric [0, 1]. Same as noveltyScore. */
  sparseness(behavior: number[]): number {
    return this.noveltyScore(behavior);
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}
