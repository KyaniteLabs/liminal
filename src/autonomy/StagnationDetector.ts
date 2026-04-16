/**
 * StagnationDetector — Phase 15
 *
 * Detects when creative search has stagnated:
 * - No quality improvements for N cycles
 * - Niche occupancy flatlined
 * - Fertility declining
 * - Novelty drops below threshold
 *
 * Triggers corrective actions (wider exploration, compost resurrection, etc.)
 */

import type { GardenHealthMetrics } from './GardenHealthMonitor.js';

export interface StagnationResult {
  /** Whether stagnation is detected */
  isStagnant: boolean;
  /** Stagnation severity (0 = none, 1 = severe) */
  severity: number;
  /** Which signals indicate stagnation */
  signals: Array<{
    metric: string;
    value: number;
    threshold: number;
    description: string;
  }>;
  /** Recommended corrective actions */
  recommendations: string[];
}

export interface StagnationDetectorConfig {
  /** Number of cycles before declaring stagnation (default: 5) */
  stagnationWindow?: number;
  /** Minimum quality improvement per cycle to avoid stagnation (default: 0.01) */
  minQualityDelta?: number;
  /** Minimum novelty to avoid stagnation (default: 0.15) */
  minNovelty?: number;
}

const DEFAULT_WINDOW = 5;
const DEFAULT_MIN_DELTA = 0.01;
const DEFAULT_MIN_NOVELTY = 0.15;

export class StagnationDetector {
  private readonly stagnationWindow: number;
  private readonly minQualityDelta: number;
  private readonly minNovelty: number;

  constructor(config: StagnationDetectorConfig = {}) {
    this.stagnationWindow = config.stagnationWindow ?? DEFAULT_WINDOW;
    this.minQualityDelta = config.minQualityDelta ?? DEFAULT_MIN_DELTA;
    this.minNovelty = config.minNovelty ?? DEFAULT_MIN_NOVELTY;
  }

  /**
   * Detect stagnation from health metric history.
   */
  detect(history: GardenHealthMetrics[]): StagnationResult {
    const signals: StagnationResult['signals'] = [];
    const recommendations: string[] = [];

    if (history.length < 2) {
      return { isStagnant: false, severity: 0, signals: [], recommendations: [] };
    }

    const recent = history.slice(-this.stagnationWindow);
    if (recent.length < 2) {
      return { isStagnant: false, severity: 0, signals: [], recommendations: [] };
    }

    const first = recent[0];
    const last = recent[recent.length - 1];

    // 1. Quality plateau: no improvement
    const qualityDelta = last.fertilityYield - first.fertilityYield;
    if (qualityDelta < this.minQualityDelta) {
      signals.push({
        metric: 'fertility',
        value: qualityDelta,
        threshold: this.minQualityDelta,
        description: `Fertility ${qualityDelta >= 0 ? 'flat' : 'declining'} over ${recent.length} cycles (below ${this.minNovelty} novelty threshold)`,
      });
      recommendations.push('Increase exploration ratio to find new fertile niches');
    }

    // 2. Niche occupancy plateau
    const occupancyDelta = last.nicheOccupancy - first.nicheOccupancy;
    if (occupancyDelta <= 0 && last.nicheOccupancy < 0.5) {
      signals.push({
        metric: 'nicheOccupancy',
        value: occupancyDelta,
        threshold: 0,
        description: `Niche occupancy stuck at ${last.nicheOccupancy.toFixed(2)}`,
      });
      recommendations.push('Schedule frontier-seeking dreams to expand archive');
    }

    // 3. Declining health score
    const healthDelta = last.healthScore - first.healthScore;
    if (healthDelta < -0.05) {
      signals.push({
        metric: 'healthScore',
        value: healthDelta,
        threshold: -0.05,
        description: `Health declining by ${Math.abs(healthDelta).toFixed(3)} per window`,
      });
      recommendations.push('Activate compost resurrection to recover valuable fragments');
    }

    // 4. Taste misalignment (if taste data available)
    if (last.tasteAlignment < 0.3 && first.tasteAlignment > 0) {
      signals.push({
        metric: 'tasteAlignment',
        value: last.tasteAlignment,
        threshold: 0.3,
        description: `Taste alignment dropped to ${last.tasteAlignment.toFixed(2)}`,
      });
      recommendations.push('Retrain taste model with recent preference data');
    }

    // 5. Archive size stagnation
    if (last.archiveSize === first.archiveSize && last.archiveSize > 0) {
      signals.push({
        metric: 'archiveSize',
        value: last.archiveSize,
        threshold: first.archiveSize + 1,
        description: `Archive size unchanged at ${last.archiveSize} entries`,
      });
      recommendations.push('Run fresh exploration tasks to grow the archive');
    }

    const severity = Math.min(1, signals.length * 0.25);
    const isStagnant = signals.length >= 2;

    return { isStagnant, severity, signals, recommendations };
  }
}
