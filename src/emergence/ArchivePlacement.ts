/**
 * ArchivePlacement — Phase 13E
 *
 * Places artifacts into a quality-diversity archive based on behavior descriptors.
 * Implements MAP-Elites style cell-based archiving: each cell in descriptor space
 * holds the best elite and near-elites for that region of behavior space.
 */

import { Logger } from '../utils/Logger.js';
import type {
  ArchiveCell,
  ArchiveEntry,
  BehaviorDescriptor,
  DescriptorValue,
  EmergenceSignals,
  LineageRecord,
  PlacementResult,
} from './types.js';
import type { LiminalObjectRef } from '../fs/types.js';

export interface ArchivePlacementConfig {
  /** Number of bins per descriptor axis (default: 10) */
  binsPerAxis?: number;
  /** Max near-elites per cell (default: 3) */
  nearEliteCapacity?: number;
  /** Minimum quality score to be considered for placement (default: 0.3) */
  minQuality?: number;
}

const DEFAULT_BINS = 10;
const DEFAULT_NEAR_ELITE_CAPACITY = 3;
const DEFAULT_MIN_QUALITY = 0.3;

export class ArchivePlacement {
  private readonly binsPerAxis: number;
  private readonly nearEliteCapacity: number;
  private readonly minQuality: number;
  private cells: Map<string, ArchiveCell> = new Map();
  private index: Map<string, string> = new Map(); // artifactId → cellId

  constructor(config: ArchivePlacementConfig = {}) {
    this.binsPerAxis = config.binsPerAxis ?? DEFAULT_BINS;
    this.nearEliteCapacity = config.nearEliteCapacity ?? DEFAULT_NEAR_ELITE_CAPACITY;
    this.minQuality = config.minQuality ?? DEFAULT_MIN_QUALITY;
  }

  /**
   * Attempt to place an artifact into the archive.
   * Returns the placement result (accepted, cell, outcome).
   */
  place(params: {
    artifactRef: LiminalObjectRef;
    descriptor: BehaviorDescriptor;
    lineage: LineageRecord;
    qualityScore: number;
    signals: EmergenceSignals;
  }): PlacementResult {
    const { artifactRef, descriptor, lineage, qualityScore, signals } = params;
    const cellId = this.computeCellId(descriptor);

    // Quality gate
    if (qualityScore < this.minQuality) {
      return { accepted: false, cellId, outcome: 'rejected' };
    }

    const entry: ArchiveEntry = {
      id: artifactRef.uri,
      artifactRef,
      descriptor,
      lineage,
      qualityScore,
      signals,
      archivedAt: new Date().toISOString(),
    };

    let cell = this.cells.get(cellId);

    if (!cell) {
      // New cell — this artifact becomes the elite
      cell = {
        cellId,
        coordinates: this.computeCellCoordinates(descriptor),
        elite: entry,
        nearElites: [],
        capacity: this.nearEliteCapacity + 1,
      };
      this.cells.set(cellId, cell);
      this.index.set(entry.id, cellId);

      Logger.info('ArchivePlacement', `New cell ${cellId} — elite ${entry.id} (q=${qualityScore.toFixed(2)})`);
      return { accepted: true, cellId, outcome: 'new-cell' };
    }

    // Existing cell — compare with current elite
    if (!cell.elite || qualityScore > cell.elite.qualityScore) {
      const displaced = cell.elite;
      // Demote current elite to near-elite
      if (displaced) {
        cell.nearElites.push(displaced);
        // Trim near-elites if over capacity
        if (cell.nearElites.length > this.nearEliteCapacity) {
          cell.nearElites.sort((a, b) => b.qualityScore - a.qualityScore);
          cell.nearElites = cell.nearElites.slice(0, this.nearEliteCapacity);
        }
      }
      cell.elite = entry;
      this.index.set(entry.id, cellId);

      Logger.info('ArchivePlacement', `Replaced elite in ${cellId} — ${entry.id} (q=${qualityScore.toFixed(2)}) beat ${displaced?.id ?? 'empty'}`);
      return { accepted: true, cellId, outcome: 'replaced-elite', displaced };
    }

    // Not elite-worthy — try near-elite
    if (cell.nearElites.length < this.nearEliteCapacity || qualityScore > cell.nearElites[cell.nearElites.length - 1].qualityScore) {
      const displaced = cell.nearElites.length >= this.nearEliteCapacity
        ? cell.nearElites.pop()!
        : undefined;

      cell.nearElites.push(entry);
      cell.nearElites.sort((a, b) => b.qualityScore - a.qualityScore);
      this.index.set(entry.id, cellId);

      Logger.info('ArchivePlacement', `Near-elite in ${cellId} — ${entry.id} (q=${qualityScore.toFixed(2)})`);
      return { accepted: true, cellId, outcome: 'near-elite', displaced };
    }

    return { accepted: false, cellId, outcome: 'rejected' };
  }

  /**
   * Get the elite entry for a specific cell.
   */
  getElite(cellId: string): ArchiveEntry | undefined {
    return this.cells.get(cellId)?.elite;
  }

  /**
   * Get a cell by ID.
   */
  getCell(cellId: string): ArchiveCell | undefined {
    return this.cells.get(cellId);
  }

  /**
   * Find which cell an artifact belongs to.
   */
  findCellForArtifact(artifactId: string): ArchiveCell | undefined {
    const cellId = this.index.get(artifactId);
    return cellId ? this.cells.get(cellId) : undefined;
  }

  /**
   * Get all occupied cells.
   */
  getAllCells(): ArchiveCell[] {
    return Array.from(this.cells.values());
  }

  /**
   * Get all elites across all cells.
   */
  getAllElites(): ArchiveEntry[] {
    return Array.from(this.cells.values())
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry => e !== undefined);
  }

  /**
   * Find empty cells in descriptor space (for Cortex exploration targeting).
   */
  findEmptyCells(descriptors: DescriptorValue[]): string[] {
    const empty: string[] = [];
    // Generate all possible cell IDs for the given axes
    const axes = descriptors.map(d => d.axis);
    const totalBins = Math.pow(this.binsPerAxis, axes.length);

    for (let i = 0; i < Math.min(totalBins, 1000); i++) {
      const coords = axes.map((_, axisIdx) => {
        const bin = Math.floor(i / Math.pow(this.binsPerAxis, axisIdx)) % this.binsPerAxis;
        return bin / this.binsPerAxis;
      });

      const cellValues = axes.map((axis, idx) => `${axis}:${coords[idx].toFixed(1)}`);
      const cellId = cellValues.join('|');

      if (!this.cells.has(cellId)) {
        empty.push(cellId);
      }
    }

    return empty;
  }

  /**
   * Get archive statistics.
   */
  getStats(): {
    totalCells: number;
    totalElites: number;
    totalNearElites: number;
    avgQuality: number;
    coverage: number;
  } {
    const cells = this.getAllCells();
    const elites = this.getAllElites();
    const totalNearElites = cells.reduce((sum, c) => sum + c.nearElites.length, 0);
    const avgQuality = elites.length > 0
      ? elites.reduce((sum, e) => sum + e.qualityScore, 0) / elites.length
      : 0;

    return {
      totalCells: cells.length,
      totalElites: elites.length,
      totalNearElites,
      avgQuality,
      coverage: cells.length > 0 ? 1 : 0, // Will be more meaningful with known total cells
    };
  }

  /**
   * Export the full archive state for persistence.
   */
  exportState(): { cells: Map<string, ArchiveCell>; index: Map<string, string> } {
    return {
      cells: new Map(this.cells),
      index: new Map(this.index),
    };
  }

  /**
   * Import archive state from persistence.
   */
  importState(state: { cells: Array<[string, ArchiveCell]>; index: Array<[string, string]> }): void {
    this.cells = new Map(state.cells);
    this.index = new Map(state.index);
  }

  /**
   * Compute a cell ID from a behavior descriptor by binning each axis.
   */
  private computeCellId(descriptor: BehaviorDescriptor): string {
    return descriptor.values
      .map(v => {
        const bin = Math.min(Math.floor(v.value * this.binsPerAxis), this.binsPerAxis - 1);
        return `${v.axis}:${bin}`;
      })
      .join('|');
  }

  /**
   * Compute cell center coordinates for a descriptor.
   */
  private computeCellCoordinates(descriptor: BehaviorDescriptor): DescriptorValue[] {
    return descriptor.values.map(v => {
      const bin = Math.min(Math.floor(v.value * this.binsPerAxis), this.binsPerAxis - 1);
      return {
        axis: v.axis,
        value: (bin + 0.5) / this.binsPerAxis,
      };
    });
  }
}
