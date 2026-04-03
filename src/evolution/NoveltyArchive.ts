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

  /**
   * Retrieve the most novel examples from the archive.
   * Since items don't have content/prompts directly, this returns
   * behavior vectors with their novelty scores.
   * @param count - Number of examples to return
   * @returns Array of behavior vectors sorted by novelty (most novel first)
   */
  retrieveNovelExamples(count: number): Array<{ behavior: number[]; noveltyScore: number }> {
    if (this.items.length === 0) return [];

    // Calculate novelty score for each item relative to the rest
    const scored = this.items.map((item, index) => {
      // Compute novelty against all other items except self
      const others = this.items.filter((_, i) => i !== index);
      const k = Math.min(this.kNeighbors, others.length);
      
      let noveltyScore = 1.0;
      if (others.length > 0) {
        const distances = others.map((other) => this.distance(item, other));
        distances.sort((a, b) => a - b);
        
        let total = 0;
        for (let i = 0; i < k; i++) {
          total += distances[i];
        }
        noveltyScore = others.length > 0 ? total / k : 1.0;
      }

      return { behavior: [...item], noveltyScore };
    });

    // Sort by novelty score descending and return top count
    return scored
      .sort((a, b) => b.noveltyScore - a.noveltyScore)
      .slice(0, count);
  }

  /**
   * Retrieve novel examples that are maximally different from a reference behavior.
   * Useful for finding examples that diverge from the current generation.
   * @param referenceBehavior - Behavior vector to compare against
   * @param topK - Number of examples to return
   * @returns Array of behavior vectors most different from reference
   */
  retrieveNovelFromReference(
    referenceBehavior: number[],
    topK: number
  ): Array<{ behavior: number[]; distance: number }> {
    if (this.items.length === 0) return [];

    const scored = this.items.map((item) => ({
      behavior: [...item],
      distance: this.distance(item, referenceBehavior),
    }));

    return scored
      .sort((a, b) => b.distance - a.distance)
      .slice(0, topK);
  }
}
