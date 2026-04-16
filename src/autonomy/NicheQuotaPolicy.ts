/**
 * NicheQuotaPolicy — Phase 14
 *
 * Ensures Cortex search doesn't collapse around one dominant style.
 * Allocates exploration budget to under-represented niches and prevents
 * over-investment in saturated cells.
 */

import type { ArchiveCell, DescriptorAxis } from '../emergence/types.js';

export interface NicheQuotaConfig {
  /** Maximum fraction of total budget for any single niche (default: 0.15) */
  maxNicheFraction?: number;
  /** Minimum budget allocation per empty niche (default: 0.05) */
  minEmptyNicheBudget?: number;
  /** Number of bins per axis for coverage computation (default: 10) */
  binsPerAxis?: number;
}

const DEFAULT_MAX_NICHE = 0.15;
const DEFAULT_MIN_EMPTY = 0.05;
const DEFAULT_BINS = 10;

export interface NicheAllocation {
  cellId: string;
  allocated: number;
  reason: 'over-represented' | 'under-represented' | 'empty' | 'balanced';
}

export class NicheQuotaPolicy {
  private readonly maxNicheFraction: number;
  private readonly minEmptyNicheBudget: number;
  private readonly binsPerAxis: number;

  constructor(config: NicheQuotaConfig = {}) {
    this.maxNicheFraction = config.maxNicheFraction ?? DEFAULT_MAX_NICHE;
    this.minEmptyNicheBudget = config.minEmptyNicheBudget ?? DEFAULT_MIN_EMPTY;
    this.binsPerAxis = config.binsPerAxis ?? DEFAULT_BINS;
  }

  /**
   * Compute allocation adjustments for all cells in the archive.
   * Returns per-cell budget fractions that favor under-represented niches.
   */
  computeAllocations(cells: ArchiveCell[], axes: DescriptorAxis[]): NicheAllocation[] {
    if (cells.length === 0) return [];

    const totalArtifacts = cells.reduce((sum, c) => {
      return sum + (c.elite ? 1 : 0) + c.nearElites.length;
    }, 0);

    if (totalArtifacts === 0) return [];

    // Count artifacts per cell
    const cellCounts = new Map<string, number>();
    for (const cell of cells) {
      const count = (cell.elite ? 1 : 0) + cell.nearElites.length;
      cellCounts.set(cell.cellId, count);
    }

    // Compute all possible cells
    const allCellIds = this.generateAllCellIds(axes);
    const occupiedIds = new Set(cells.map(c => c.cellId));

    const allocations: NicheAllocation[] = [];

    // Occupied cells
    for (const cell of cells) {
      const count = cellCounts.get(cell.cellId) ?? 0;
      const fraction = count / totalArtifacts;

      let reason: NicheAllocation['reason'];
      let allocated: number;

      if (fraction > this.maxNicheFraction) {
        reason = 'over-represented';
        allocated = 0; // No additional investment
      } else if (fraction < this.maxNicheFraction * 0.5) {
        reason = 'under-represented';
        allocated = this.maxNicheFraction * 1.5; // Bonus investment
      } else {
        reason = 'balanced';
        allocated = this.maxNicheFraction;
      }

      allocations.push({ cellId: cell.cellId, allocated, reason });
    }

    // Empty cells
    for (const cellId of allCellIds) {
      if (!occupiedIds.has(cellId)) {
        allocations.push({
          cellId,
          allocated: this.minEmptyNicheBudget,
          reason: 'empty',
        });
      }
    }

    // Normalize so total allocations sum to ~1.0
    const totalAlloc = allocations.reduce((s, a) => s + a.allocated, 0);
    if (totalAlloc > 0) {
      for (const a of allocations) {
        a.allocated = a.allocated / totalAlloc;
      }
    }

    return allocations;
  }

  /**
   * Get the top niches that need exploration (empty or under-represented).
   */
  getTargetNiches(cells: ArchiveCell[], axes: DescriptorAxis[], count: number = 5): NicheAllocation[] {
    const allocations = this.computeAllocations(cells, axes);
    return allocations
      .filter(a => a.reason === 'empty' || a.reason === 'under-represented')
      .sort((a, b) => b.allocated - a.allocated)
      .slice(0, count);
  }

  /**
   * Compute niche balance score (0 = collapsed on one niche, 1 = perfectly balanced).
   */
  getBalanceScore(cells: ArchiveCell[]): number {
    if (cells.length <= 1) return 0;

    const counts = cells.map(c => (c.elite ? 1 : 0) + c.nearElites.length);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    const actualFractions = counts.map(c => c / total);

    // Entropy-based balance measure
    let entropy = 0;
    for (const f of actualFractions) {
      if (f > 0) {
        entropy -= f * Math.log2(f);
      }
    }

    const maxEntropy = Math.log2(cells.length);
    return maxEntropy > 0 ? entropy / maxEntropy : 0;
  }

  /**
   * Generate all possible cell IDs for the given axes.
   * Capped at 1000 to avoid combinatorial explosion with many axes.
   */
  private generateAllCellIds(axes: DescriptorAxis[]): string[] {
    const total = Math.pow(this.binsPerAxis, axes.length);
    const cap = Math.min(total, 1000);
    const ids: string[] = [];

    for (let i = 0; i < cap; i++) {
      const parts: string[] = [];
      for (let a = axes.length - 1; a >= 0; a--) {
        const bin = Math.floor(i / Math.pow(this.binsPerAxis, a)) % this.binsPerAxis;
        parts.unshift(`${axes[a]}:${bin}`);
      }
      ids.push(parts.join('|'));
    }

    return ids;
  }
}
