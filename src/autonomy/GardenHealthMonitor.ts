/**
 * GardenHealthMonitor — Phase 15
 *
 * Tracks health metrics for the creative garden:
 * archive growth, niche occupancy, lineage depth, fertility yield,
 * and taste-aligned hit rate.
 */

import type { ArchiveCell } from '../emergence/types.js';

export interface GardenHealthMetrics {
  /** Total occupied cells */
  archiveSize: number;
  /** Fraction of niche space filled (0–1) */
  nicheOccupancy: number;
  /** Average lineage depth across occupied cells */
  avgLineageDepth: number;
  /** Average fertility of archived entries */
  fertilityYield: number;
  /** Fraction of recent entries aligned with user taste (if taste model loaded) */
  tasteAlignment: number;
  /** Overall health score (0–1) */
  healthScore: number;
  /** Health classification */
  healthLevel: 'thriving' | 'healthy' | 'stagnant' | 'declining';
  /** Timestamp */
  measuredAt: string;
}

export interface GardenHealthConfig {
  /** Target niche occupancy for "thriving" (default: 0.7) */
  thrivingThreshold?: number;
  /** Target fertility for "healthy" (default: 0.4) */
  healthyFertility?: number;
}

const DEFAULT_THRIVING = 0.7;
const DEFAULT_HEALTHY_FERTILITY = 0.4;

export class GardenHealthMonitor {
  private readonly thrivingThreshold: number;
  private readonly healthyFertility: number;
  private readonly history: GardenHealthMetrics[] = [];

  constructor(config: GardenHealthConfig = {}) {
    this.thrivingThreshold = config.thrivingThreshold ?? DEFAULT_THRIVING;
    this.healthyFertility = config.healthyFertility ?? DEFAULT_HEALTHY_FERTILITY;
  }

  /**
   * Measure current garden health from archive state.
   */
  measure(cells: ArchiveCell[], tasteAlignedIds?: Set<string>): GardenHealthMetrics {
    const occupied = cells.filter(c => c.elite !== undefined);
    const archiveSize = occupied.length;
    const nicheOccupancy = cells.length > 0 ? occupied.length / cells.length : 0;

    // Average lineage depth
    const avgLineageDepth = occupied.length > 0
      ? occupied.reduce((sum, c) => sum + ((c.elite?.lineage.parentIds.length ?? -1) + 1), 0) / occupied.length
      : 0;

    // Average fertility
    const fertilityYield = occupied.length > 0
      ? occupied.reduce((sum, c) => sum + (c.elite?.signals.fertility ?? 0), 0) / occupied.length
      : 0;

    // Taste alignment
    let tasteAlignment = 0;
    if (tasteAlignedIds && tasteAlignedIds.size > 0 && occupied.length > 0) {
      const aligned = occupied.filter(c => c.elite && tasteAlignedIds.has(c.elite.id)).length;
      tasteAlignment = aligned / occupied.length;
    }

    // Composite health score
    const healthScore = this.computeHealthScore(nicheOccupancy, fertilityYield, tasteAlignment);
    const healthLevel = this.classifyHealth(healthScore, nicheOccupancy, fertilityYield);

    const metrics: GardenHealthMetrics = {
      archiveSize,
      nicheOccupancy,
      avgLineageDepth,
      fertilityYield,
      tasteAlignment,
      healthScore,
      healthLevel,
      measuredAt: new Date().toISOString(),
    };

    this.history.push(metrics);
    return metrics;
  }

  /**
   * Get health trend over recent measurements.
   */
  getTrend(lastN?: number): 'improving' | 'stable' | 'declining' {
    const n = lastN ?? 5;
    const recent = this.history.slice(-n);
    if (recent.length < 2) return 'stable';

    const first = recent[0].healthScore;
    const last = recent[recent.length - 1].healthScore;
    const delta = last - first;

    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get measurement history.
   */
  getHistory(): GardenHealthMetrics[] {
    return [...this.history];
  }

  private computeHealthScore(
    nicheOccupancy: number,
    fertilityYield: number,
    tasteAlignment: number,
  ): number {
    return (
      (nicheOccupancy * 0.3) +
      (fertilityYield * 0.3) +
      (tasteAlignment > 0 ? tasteAlignment * 0.2 : 0.1) + // Default 0.1 if no taste data
      (Math.min(1, nicheOccupancy * 2) * 0.2) // Bonus for filling niches
    );
  }

  private classifyHealth(
    score: number,
    nicheOccupancy: number,
    fertility: number,
  ): GardenHealthMetrics['healthLevel'] {
    if (score >= 0.7 && nicheOccupancy >= this.thrivingThreshold) return 'thriving';
    if (score >= 0.5 && fertility >= this.healthyFertility) return 'healthy';
    if (score >= 0.3) return 'stagnant';
    return 'declining';
  }
}
