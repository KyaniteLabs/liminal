/**
 * MAP-Elites quality-diversity optimization grid.
 * Pure data structure, no external dependencies.
 *
 * Supports N-dimensional behavior descriptors.
 * Backward compatible with 2D `[number, number]` constructor args.
 * Now with embedding-based behavior descriptors for semantic diversity.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { cosineSimilarity } from '../utils/vectors.js';

export interface MapElitesCell {
  creationId: string;
  fitness: number;
  behavior: number[];
  /** Optional embedding vector for semantic behavior characterization */
  embedding?: number[];
  /** Content for embedding-based diversity (e.g., code, description) */
  content?: string;
}

/** Options for embedding-based diversity */
export interface EmbeddingDiversityOptions {
  /** Whether to use embedding-based diversity calculation */
  useEmbeddings: boolean;
  /** Weight for embedding diversity vs behavior diversity (0-1) */
  embeddingWeight: number;
}

export class MapElites {
  private grid: Map<string, MapElitesCell>;
  private dims: number[];
  private embeddingOptions: EmbeddingDiversityOptions;

  constructor(
    dims?: [number, number] | number[],
    embeddingOptions?: Partial<EmbeddingDiversityOptions>
  ) {
    this.dims = dims ?? [10, 10];
    this.grid = new Map();
    this.embeddingOptions = {
      useEmbeddings: embeddingOptions?.useEmbeddings ?? false,
      embeddingWeight: embeddingOptions?.embeddingWeight ?? 0.5,
    };
  }

  /** Map a behavior vector to cell coordinates, one per dimension */
  private behaviorToCell(behavior: number[]): number[] {
    return this.dims.map((dimSize, i) => {
      const b = Math.max(0, Math.min(1, behavior[i] ?? 0));
      return Math.max(
        0,
        Math.min(dimSize - 1, Math.floor(b * (dimSize - 1)))
      );
    });
  }

  /** Insert a creation. Returns true if it was added (new cell or better fitness). */
  insert(
    creationId: string,
    behavior: number[],
    fitness: number,
    embedding?: number[],
    content?: string
  ): boolean {
    const coords = this.behaviorToCell(behavior);
    const key = coords.join(',');
    const existing = this.grid.get(key);
    if (existing === undefined || fitness > existing.fitness) {
      this.grid.set(key, {
        creationId,
        fitness,
        behavior: [...behavior],
        embedding,
        content,
      });
      return true;
    }
    return false;
  }

  /** Get cell at (x, y) — legacy 2D accessor */
  get(x: number, y: number): MapElitesCell | null {
    return this.grid.get(`${x},${y}`) ?? null;
  }

  /** Get top N elites by fitness across all cells */
  getElites(
    n: number
  ): Array<{ creationId: string; fitness: number }> {
    return Array.from(this.grid.values())
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, n)
      .map((c) => ({ creationId: c.creationId, fitness: c.fitness }));
  }

  /** Fraction of grid cells that are occupied [0, 1] */
  coverage(): number {
    const totalCells = this.dims.reduce((acc, d) => acc * d, 1);
    return this.size() / totalCells;
  }

  /** Clear all cells */
  clear(): void {
    this.grid.clear();
  }

  /** Number of occupied cells */
  size(): number {
    return this.grid.size;
  }

  /** Get all cells as array */
  getAllCells(): MapElitesCell[] {
    return Array.from(this.grid.values());
  }

  /** Persist grid to JSON file */
  async save(filePath: string): Promise<void> {
    const data = {
      dims: this.dims,
      cells: Array.from(this.grid.entries()),
      embeddingOptions: this.embeddingOptions,
    };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');
  }

  /** Load grid from JSON file */
  async load(filePath: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      this.dims = data.dims ?? [10, 10];
      this.grid = new Map(data.cells ?? []);
      this.embeddingOptions = data.embeddingOptions ?? {
        useEmbeddings: false,
        embeddingWeight: 0.5,
      };
    } catch (loadError) {
      // File doesn't exist or is invalid — start fresh
    }
  }

  /**
   * Return a uniformly random occupied cell, or null if the grid is empty.
   * Useful for GA parent selection.
   */
  getRandomElite(): MapElitesCell | null {
    if (this.grid.size === 0) return null;
    const cells = Array.from(this.grid.values());
    const idx = Math.floor(Math.random() * cells.length);
    return cells[idx];
  }

  /**
   * Compute average pairwise distance between all cell behaviors.
   * Supports both traditional behavior vectors and embedding-based diversity.
   * Returns 0 if fewer than 2 cells are occupied.
   * O(n^2) — acceptable for the small grid sizes used.
   */
  getBehaviorDiversity(): number {
    const cells = this.getAllCells();
    if (cells.length < 2) return 0;

    let totalDist = 0;
    let pairCount = 0;

    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const dist = this.calculateDiversity(cells[i], cells[j]);
        totalDist += dist;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDist / pairCount : 0;
  }

  /**
   * Calculate diversity between two cells.
   * Uses embedding-based diversity if enabled and available,
   * otherwise uses traditional behavior vector distance.
   */
  private calculateDiversity(
    cellA: MapElitesCell,
    cellB: MapElitesCell
  ): number {
    const { useEmbeddings, embeddingWeight } = this.embeddingOptions;

    // Calculate traditional behavior distance
    const behaviorDist = this.behaviorDistance(
      cellA.behavior,
      cellB.behavior
    );

    // Calculate embedding-based diversity if enabled and available
    if (
      useEmbeddings &&
      embeddingWeight > 0 &&
      cellA.embedding &&
      cellB.embedding &&
      cellA.embedding.length > 0 &&
      cellB.embedding.length > 0
    ) {
      // Use cosine distance (1 - similarity) for embedding diversity
      const embeddingSimilarity = cosineSimilarity(
        cellA.embedding,
        cellB.embedding
      );
      const embeddingDist = 1 - embeddingSimilarity;

      // Weighted combination
      return (
        embeddingWeight * embeddingDist +
        (1 - embeddingWeight) * behaviorDist
      );
    }

    return behaviorDist;
  }

  /**
   * Get diverse high-quality elites using tournament selection.
   * Returns elites that are both high-fitness and behaviorally diverse.
   * Supports embedding-based diversity.
   * @param count - Number of elites to return
   * @returns Array of diverse elite cells
   */
  getDiverseElite(count: number): MapElitesCell[] {
    const cells = this.getAllCells();
    if (cells.length === 0) return [];
    if (cells.length <= count) return [...cells];

    // Sort by fitness descending for initial selection pool
    const sortedByFitness = [...cells].sort(
      (a, b) => b.fitness - a.fitness
    );

    // Take enough cells for the requested count with tournament selection
    // Each tournament uses up to 3 candidates, so we need count * 3 at minimum
    const poolSize = Math.max(
      count * 3,
      Math.ceil(sortedByFitness.length * 0.5)
    );
    const pool = sortedByFitness.slice(0, poolSize);

    const selected: MapElitesCell[] = [];
    const used = new Set<number>(); // Track indices, not creationIds

    // Tournament selection with diversity bonus
    while (selected.length < count && used.size < pool.length) {
      // Pick random candidates from pool (by index)
      const tournamentSize = Math.min(3, pool.length - used.size);
      const candidateIndices: number[] = [];

      // Get available indices
      const availableIndices = pool
        .map((_, i) => i)
        .filter((i) => !used.has(i));

      // Shuffle available indices
      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIndices[i], availableIndices[j]] = [
          availableIndices[j],
          availableIndices[i],
        ];
      }

      // Take first tournamentSize indices
      for (let i = 0; i < Math.min(tournamentSize, availableIndices.length); i++) {
        candidateIndices.push(availableIndices[i]);
      }

      if (candidateIndices.length === 0) break;

      // Mark all candidates as used for future tournaments
      for (const idx of candidateIndices) {
        used.add(idx);
      }

      // Select winner based on fitness + diversity bonus
      const candidates = candidateIndices.map((i) => pool[i]);
      let winner = candidates[0];
      let bestScore = winner.fitness;

      for (const candidate of candidates) {
        // Calculate diversity bonus based on distance from already selected
        let diversityBonus = 0;
        for (const sel of selected) {
          const dist = this.calculateDiversity(candidate, sel);
          diversityBonus += dist;
        }
        diversityBonus =
          selected.length > 0 ? diversityBonus / selected.length : 0.5;

        const score = candidate.fitness * 0.7 + diversityBonus * 0.3;
        if (score > bestScore) {
          bestScore = score;
          winner = candidate;
        }
      }

      selected.push(winner);
    }

    return selected;
  }

  /** Calculate Euclidean distance between two behavior vectors */
  private behaviorDistance(a: number[], b: number[]): number {
    const maxLen = Math.max(a.length, b.length);
    let distSq = 0;
    for (let k = 0; k < maxLen; k++) {
      const diff = (a[k] ?? 0) - (b[k] ?? 0);
      distSq += diff * diff;
    }
    const maxDist = Math.sqrt(maxLen); // Maximum possible distance
    return maxDist > 0 ? Math.sqrt(distSq) / maxDist : 0;
  }

  /**
   * Enable or disable embedding-based diversity.
   * @param enabled - Whether to use embeddings
   * @param weight - Weight for embedding diversity (0-1)
   */
  setEmbeddingOptions(
    enabled: boolean,
    weight = 0.5
  ): void {
    this.embeddingOptions = {
      useEmbeddings: enabled,
      embeddingWeight: Math.max(0, Math.min(1, weight)),
    };
  }

  /**
   * Get current embedding options.
   * @returns Current embedding options
   */
  getEmbeddingOptions(): EmbeddingDiversityOptions {
    return { ...this.embeddingOptions };
  }

  /**
   * Find elites similar to a query embedding.
   * @param queryEmbedding - Query embedding vector
   * @param topK - Number of similar elites to return
   * @returns Array of similar elites with similarity scores
   */
  findSimilarByEmbedding(
    queryEmbedding: number[],
    topK: number
  ): Array<{ cell: MapElitesCell; similarity: number }> {
    const cells = this.getAllCells().filter(
      (c) => c.embedding && c.embedding.length > 0
    );

    const scored = cells.map((cell) => ({
      cell,
      similarity: cosineSimilarity(queryEmbedding, cell.embedding!),
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Insert with embedding-based behavior characterization.
   * Automatically extracts behavior descriptor from embedding if provided.
   * @param creationId - Unique identifier for the creation
   * @param fitness - Fitness score
   * @param embedding - Semantic embedding vector
   * @param behavior - Optional behavior vector (derived from embedding if not provided)
   * @param content - Optional content string
   * @returns True if inserted successfully
   */
  insertWithEmbedding(
    creationId: string,
    fitness: number,
    embedding: number[],
    behavior?: number[],
    content?: string
  ): boolean {
    // If no behavior vector provided, derive from embedding
    // Use first N dimensions of embedding as behavior descriptor
    const derivedBehavior =
      behavior ?? this.deriveBehaviorFromEmbedding(embedding);

    return this.insert(
      creationId,
      derivedBehavior,
      fitness,
      embedding,
      content
    );
  }

  /**
   * Derive a behavior descriptor vector from an embedding.
   * Uses dimensionality reduction by selecting representative dimensions.
   * @param embedding - Full embedding vector
   * @returns Behavior descriptor vector
   */
  private deriveBehaviorFromEmbedding(embedding: number[]): number[] {
    // Simple approach: sample dimensions at regular intervals
    // More sophisticated approaches could use PCA or autoencoders
    const targetDims = this.dims.length;
    const samples: number[] = [];

    for (let i = 0; i < targetDims; i++) {
      const idx = Math.floor((i * embedding.length) / targetDims);
      // Normalize to [0, 1] range
      const value = (embedding[idx] + 1) / 2; // Assuming embeddings are normalized to [-1, 1]
      samples.push(Math.max(0, Math.min(1, value)));
    }

    return samples;
  }
}
