/**
 * MAP-Elites quality-diversity optimization grid.
 * Pure data structure, no external dependencies.
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
  private dims: [number, number];

  constructor(dims?: [number, number]) {
    this.dims = dims ?? [10, 10];
    this.grid = new Map();
  }

  /** Map a behavior vector (2D: [b0, b1]) to a cell coordinate */
  private behaviorToCell(behavior: number[]): [number, number] {
    const b0 = Math.max(0, Math.min(1, behavior[0]));
    const b1 = Math.max(0, Math.min(1, behavior[1]));
    let x = Math.floor(b0 * (this.dims[0] - 1));
    let y = Math.floor(b1 * (this.dims[1] - 1));
    x = Math.max(0, Math.min(this.dims[0] - 1, x));
    y = Math.max(0, Math.min(this.dims[1] - 1, y));
    return [x, y];
  }

  /** Insert a creation. Returns true if it was added (new cell or better fitness). */
  insert(creationId: string, behavior: number[], fitness: number): boolean {
    const [x, y] = this.behaviorToCell(behavior);
    const key = `${x},${y}`;
    const existing = this.grid.get(key);
    if (existing === undefined || fitness > existing.fitness) {
      this.grid.set(key, { creationId, fitness, behavior: [...behavior] });
      return true;
    }
    return false;
  }

  /** Get cell at (x, y) */
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
    return this.size() / (this.dims[0] * this.dims[1]);
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
}
