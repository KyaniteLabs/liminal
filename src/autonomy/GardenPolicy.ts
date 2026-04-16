/**
 * GardenPolicy — Phase 15
 *
 * Explore/exploit policies for archive tending:
 * frontier seeking, local refinement, branch from fertile lineages,
 * resurrect old-but-promising states, retire stale niches.
 */

import type { ArchiveCell, ArchiveEntry } from '../emergence/types.js';
import { NicheQuotaPolicy } from './NicheQuotaPolicy.js';
import { GardenHealthMonitor } from './GardenHealthMonitor.js';

export type GardenAction =
  | 'frontier-seeking'
  | 'local-refinement'
  | 'branch-fertile'
  | 'resurrect-promising'
  | 'retire-stale';

export interface GardenPolicyDecision {
  action: GardenAction;
  targetCellId?: string;
  targetEntry?: ArchiveEntry;
  priority: number;
  reason: string;
}

export interface GardenPolicyConfig {
  /** Fraction of budget for exploration (default: 0.4) */
  explorationFraction?: number;
  /** Maximum niche age before stale retirement (default: 100 cycles) */
  staleThreshold?: number;
  /** Minimum fertility for fertile branching (default: 0.6) */
  fertileThreshold?: number;
}

const DEFAULT_EXPLORATION = 0.4;
const DEFAULT_FERTILE = 0.6;

export class GardenPolicy {
  private readonly nichePolicy: NicheQuotaPolicy;
  private readonly healthMonitor: GardenHealthMonitor;
  private readonly explorationFraction: number;
  private readonly fertileThreshold: number;
  private cycleCount = 0;

  constructor(config: GardenPolicyConfig = {}) {
    this.nichePolicy = new NicheQuotaPolicy();
    this.healthMonitor = new GardenHealthMonitor();
    this.explorationFraction = config.explorationFraction ?? DEFAULT_EXPLORATION;
    this.fertileThreshold = config.fertileThreshold ?? DEFAULT_FERTILE;
  }

  /**
   * Decide the next garden action based on current archive state.
   */
  decide(cells: ArchiveCell[], axes: import('../emergence/types.js').DescriptorAxis[]): GardenPolicyDecision[] {
    this.cycleCount++;
    const decisions: GardenPolicyDecision[] = [];

    const health = this.healthMonitor.measure(cells);
    const entries = cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry => e !== undefined);

    // Bootstrap empty archive
    if (cells.length === 0 || entries.length === 0) {
      decisions.push({
        action: 'frontier-seeking',
        priority: 1.0,
        reason: 'Bootstrap empty archive',
      });
      return decisions;
    }

    // 1. Frontier seeking: fill empty niches
    const emptyNiches = this.nichePolicy.getTargetNiches(cells, axes, 3);
    for (const niche of emptyNiches.slice(0, Math.ceil(this.explorationFraction * 5))) {
      decisions.push({
        action: 'frontier-seeking',
        targetCellId: niche.cellId,
        priority: 0.9,
        reason: niche.reason === 'empty' ? 'Fill empty niche' : 'Explore under-represented niche',
      });
    }

    // 2. Branch from fertile lineages
    const fertile = entries
      .filter(e => e.signals.fertility >= this.fertileThreshold)
      .sort((a, b) => b.signals.fertility - a.signals.fertility)
      .slice(0, 3);

    for (const entry of fertile) {
      decisions.push({
        action: 'branch-fertile',
        targetEntry: entry,
        priority: 0.7,
        reason: `Branch from fertile lineage (${entry.signals.fertility.toFixed(2)})`,
      });
    }

    // 3. Local refinement: improve low-quality occupied cells
    const improvable = entries
      .filter(e => e.qualityScore >= 0.4 && e.qualityScore < 0.8)
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 2);

    for (const entry of improvable) {
      const cellId = this.findCellForEntry(entry, cells);
      decisions.push({
        action: 'local-refinement',
        targetCellId: cellId,
        targetEntry: entry,
        priority: 0.6,
        reason: `Improve quality (${entry.qualityScore.toFixed(2)}) in cell`,
      });
    }

    // 4. Resurrect old-but-promising (low quality but high fertility/novelty)
    const resurrectable = entries
      .filter(e => e.qualityScore < 0.4 && (e.signals.fertility > 0.5 || e.signals.novelty > 0.7))
      .slice(0, 2);

    for (const entry of resurrectable) {
      decisions.push({
        action: 'resurrect-promising',
        targetEntry: entry,
        priority: 0.5,
        reason: `Resurrect promising artifact (novelty: ${entry.signals.novelty.toFixed(2)})`,
      });
    }

    // 5. Retire stale niches (if garden is very full)
    if (health.nicheOccupancy > 0.8) {
      const stale = entries
        .filter(e => e.qualityScore < 0.2 && e.signals.fertility < 0.2)
        .slice(0, 2);

      for (const entry of stale) {
        decisions.push({
          action: 'retire-stale',
          targetEntry: entry,
          priority: 0.3,
          reason: 'Retire low-value stale niche',
        });
      }
    }

    // Sort by priority descending
    decisions.sort((a, b) => b.priority - a.priority);
    return decisions;
  }

  getHealthMonitor(): GardenHealthMonitor {
    return this.healthMonitor;
  }

  getNichePolicy(): NicheQuotaPolicy {
    return this.nichePolicy;
  }

  getCycleCount(): number {
    return this.cycleCount;
  }

  private findCellForEntry(entry: ArchiveEntry, cells: ArchiveCell[]): string | undefined {
    for (const cell of cells) {
      if (cell.elite?.id === entry.id) return cell.cellId;
      if (cell.nearElites.some(ne => ne.id === entry.id)) return cell.cellId;
    }
    return undefined;
  }
}
