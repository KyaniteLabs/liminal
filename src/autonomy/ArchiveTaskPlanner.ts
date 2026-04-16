/**
 * ArchiveTaskPlanner — Phase 14
 *
 * Plans Cortex tasks based on archive state: empty-cell filling,
 * local improvement, fertile lineage revisiting, and dead-end revival.
 * Integrates with NicheQuotaPolicy for balanced exploration.
 */

import type { ArchiveEntry, CreativeTaskType, DescriptorAxis } from '../emergence/types.js';
import type { ArchiveCell } from '../emergence/types.js';
import { NicheQuotaPolicy } from './NicheQuotaPolicy.js';

export interface ArchiveTaskPlan {
  tasks: Array<{
    type: CreativeTaskType;
    priority: number;
    targetCellId?: string;
    parentEntry?: ArchiveEntry;
    reason: string;
  }>;
  /** Summary of archive state that drove the plan */
  archiveSummary: {
    totalCells: number;
    emptyNiches: number;
    underRepresented: number;
    balanceScore: number;
  };
}

export interface ArchiveTaskPlannerConfig {
  /** Maximum tasks to plan per cycle (default: 10) */
  maxTasks?: number;
  /** Minimum quality for local improvement targets (default: 0.5) */
  minQualityForImprovement?: number;
  /** Minimum fertility score for lineage revisiting (default: 0.6) */
  minFertilityForRevist?: number;
}

const DEFAULT_MAX_TASKS = 10;
const DEFAULT_MIN_QUALITY = 0.5;
const DEFAULT_MIN_FERTILITY = 0.6;

export class ArchiveTaskPlanner {
  private readonly nichePolicy: NicheQuotaPolicy;
  private readonly maxTasks: number;
  private readonly minQualityForImprovement: number;
  private readonly minFertilityForRevist: number;

  constructor(config: ArchiveTaskPlannerConfig = {}) {
    this.nichePolicy = new NicheQuotaPolicy();
    this.maxTasks = config.maxTasks ?? DEFAULT_MAX_TASKS;
    this.minQualityForImprovement = config.minQualityForImprovement ?? DEFAULT_MIN_QUALITY;
    this.minFertilityForRevist = config.minFertilityForRevist ?? DEFAULT_MIN_FERTILITY;
  }

  /**
   * Plan the next cycle of creative tasks based on archive state.
   */
  plan(
    cells: ArchiveCell[],
    axes: DescriptorAxis[],
    preferenceCounts?: Map<string, { positive: number; negative: number }>,
  ): ArchiveTaskPlan {
    const tasks: ArchiveTaskPlan['tasks'] = [];

    // 0. Empty archive — plan fresh exploration to bootstrap
    if (cells.length === 0) {
      tasks.push({
        type: 'fresh-exploration',
        priority: 1.0,
        reason: 'Bootstrap empty archive',
      });
    }

    // 1. Empty niche filling
    const targetNiches = this.nichePolicy.getTargetNiches(cells, axes, 3);
    for (const niche of targetNiches) {
      if (tasks.length >= this.maxTasks) break;
      tasks.push({
        type: 'fresh-exploration',
        priority: 0.9,
        targetCellId: niche.cellId,
        reason: niche.reason === 'empty' ? 'Fill empty niche' : 'Boost under-represented niche',
      });
    }

    // 2. Local improvement: find cells where quality can be improved
    const improvable = this.findImprovableCells(cells);
    for (const entry of improvable) {
      if (tasks.length >= this.maxTasks) break;
      tasks.push({
        type: 'perturbation-probe',
        priority: 0.7,
        targetCellId: this.findCellForEntry(entry, cells),
        parentEntry: entry,
        reason: `Improve quality in cell (current: ${entry.qualityScore.toFixed(2)})`,
      });
    }

    // 3. Fertile lineage revisiting
    const fertile = this.findFertileLineages(cells);
    for (const entry of fertile) {
      if (tasks.length >= this.maxTasks) break;
      tasks.push({
        type: 'branch-from-pinned',
        priority: 0.6,
        parentEntry: entry,
        reason: `Branch from fertile lineage (${entry.signals.fertility.toFixed(2)})`,
      });
    }

    // 4. User-pinned entries get replay priority
    if (preferenceCounts) {
      const pinned = this.findPinnedEntries(cells, preferenceCounts);
      for (const entry of pinned) {
        if (tasks.length >= this.maxTasks) break;
        tasks.push({
          type: 'replay-promising',
          priority: 0.8,
          parentEntry: entry,
          reason: 'Replay user-pinned artifact',
        });
      }
    }

    // Sort by priority descending
    tasks.sort((a, b) => b.priority - a.priority);

    const balanceScore = this.nichePolicy.getBalanceScore(cells);
    const occupiedCells = cells.filter(c => c.elite !== undefined);

    return {
      tasks: tasks.slice(0, this.maxTasks),
      archiveSummary: {
        totalCells: occupiedCells.length,
        emptyNiches: targetNiches.filter(n => n.reason === 'empty').length,
        underRepresented: targetNiches.filter(n => n.reason === 'under-represented').length,
        balanceScore,
      },
    };
  }

  private findImprovableCells(cells: ArchiveCell[]): ArchiveEntry[] {
    return cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry =>
        e !== undefined && e.qualityScore >= this.minQualityForImprovement && e.qualityScore < 0.9,
      )
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 3);
  }

  private findFertileLineages(cells: ArchiveCell[]): ArchiveEntry[] {
    return cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry =>
        e !== undefined && e.signals.fertility >= this.minFertilityForRevist,
      )
      .sort((a, b) => b.signals.fertility - a.signals.fertility)
      .slice(0, 3);
  }

  private findPinnedEntries(
    cells: ArchiveCell[],
    preferenceCounts: Map<string, { positive: number; negative: number }>,
  ): ArchiveEntry[] {
    return cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry => {
        if (!e) return false;
        const prefs = preferenceCounts.get(e.id);
        return prefs !== undefined && prefs.positive > prefs.negative;
      })
      .slice(0, 3);
  }

  private findCellForEntry(entry: ArchiveEntry, cells: ArchiveCell[]): string | undefined {
    for (const cell of cells) {
      if (cell.elite?.id === entry.id) return cell.cellId;
      if (cell.nearElites.some(ne => ne.id === entry.id)) return cell.cellId;
    }
    return undefined;
  }
}
