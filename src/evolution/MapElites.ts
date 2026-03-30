/**
 * MAP-Elites quality-diversity optimization grid.
 * Pure data structure, no external dependencies.
 *
 * Supports N-dimensional behavior descriptors.
 * Backward compatible with 2D `[number, number]` constructor args.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface MapElitesCell {
  creationId: string;
  fitness: number;
  behavior: number[];
}

export class MapElites {
  private grid: Map<string, MapElitesCell>;
  private dims: number[];

  constructor(dims?: [number, number] | number[]) {
    this.dims = dims ?? [10, 10];
    this.grid = new Map();
  }

  /** Map a behavior vector to cell coordinates, one per dimension */
  private behaviorToCell(behavior: number[]): number[] {
    return this.dims.map((dimSize, i) => {
      const b = Math.max(0, Math.min(1, behavior[i] ?? 0));
      return Math.max(0, Math.min(dimSize - 1, Math.floor(b * (dimSize - 1))));
    });
  }

  /** Insert a creation. Returns true if it was added (new cell or better fitness). */
  insert(creationId: string, behavior: number[], fitness: number): boolean {
    const coords = this.behaviorToCell(behavior);
    const key = coords.join(',');
    const existing = this.grid.get(key);
    if (existing === undefined || fitness > existing.fitness) {
      this.grid.set(key, { creationId, fitness, behavior: [...behavior] });
      return true;
    }
    return false;
  }

  /** Get cell at (x, y) — legacy 2D accessor */
  get(x: number, y: number): MapElitesCell | null {
    return this.grid.get(`${x},${y}`) ?? null;
  }

  /** Get top N elites by fitness across all cells */
  getElites(n: number): Array<{ creationId: string; fitness: number }> {
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
   * Compute average pairwise Euclidean distance between all cell behaviors.
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
        const a = cells[i].behavior;
        const b = cells[j].behavior;
        const maxLen = Math.max(a.length, b.length);
        let distSq = 0;
        for (let k = 0; k < maxLen; k++) {
          const diff = (a[k] ?? 0) - (b[k] ?? 0);
          distSq += diff * diff;
        }
        totalDist += Math.sqrt(distSq);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDist / pairCount : 0;
  }
}
