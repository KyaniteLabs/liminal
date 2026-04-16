/**
 * LoopMixPolicy — Phase 16
 *
 * Determines the blend of garden activities per cycle:
 * exploration, exploitation, dreaming, compost resurrection, critic refresh.
 * Adjusts mix based on garden health and stagnation signals.
 */

import type { GardenHealthMetrics } from './GardenHealthMonitor.js';
import type { StagnationResult } from './StagnationDetector.js';

export type LoopActivity =
  | 'exploration'
  | 'exploitation'
  | 'dreaming'
  | 'compost-resurrection'
  | 'critic-refresh';

export interface LoopMix {
  activity: LoopActivity;
  fraction: number;
  reason: string;
}

export interface LoopMixPolicyConfig {
  /** Default exploration fraction (default: 0.35) */
  defaultExploration?: number;
  /** Default exploitation fraction (default: 0.25) */
  defaultExploitation?: number;
  /** Default dreaming fraction (default: 0.20) */
  defaultDreaming?: number;
  /** Default compost fraction (default: 0.10) */
  defaultCompost?: number;
  /** Default critic refresh fraction (default: 0.10) */
  defaultCritic?: number;
}

const DEFAULTS: Record<LoopActivity, number> = {
  exploration: 0.35,
  exploitation: 0.25,
  dreaming: 0.20,
  'compost-resurrection': 0.10,
  'critic-refresh': 0.10,
};

export class LoopMixPolicy {
  private readonly base: Record<LoopActivity, number>;

  constructor(config: LoopMixPolicyConfig = {}) {
    this.base = {
      exploration: config.defaultExploration ?? DEFAULTS.exploration,
      exploitation: config.defaultExploitation ?? DEFAULTS.exploitation,
      dreaming: config.defaultDreaming ?? DEFAULTS.dreaming,
      'compost-resurrection': config.defaultCompost ?? DEFAULTS['compost-resurrection'],
      'critic-refresh': config.defaultCritic ?? DEFAULTS['critic-refresh'],
    };
  }

  /**
   * Compute the activity mix for the next cycle, adjusting for health and stagnation.
   */
  computeMix(health?: GardenHealthMetrics, stagnation?: StagnationResult): LoopMix[] {
    const mix = { ...this.base };

    if (stagnation?.isStagnant) {
      // Stagnation: shift heavily toward exploration and compost
      mix.exploration = Math.min(0.6, mix.exploration + stagnation.severity * 0.3);
      mix['compost-resurrection'] = Math.min(0.2, mix['compost-resurrection'] + stagnation.severity * 0.1);
      mix.exploitation = Math.max(0.05, mix.exploitation - stagnation.severity * 0.2);
    }

    if (health) {
      if (health.nicheOccupancy < 0.3) {
        // Sparse archive: more exploration
        mix.exploration = Math.min(0.6, mix.exploration + 0.15);
      } else if (health.nicheOccupancy > 0.8) {
        // Full archive: more dreaming and exploitation
        mix.dreaming = Math.min(0.35, mix.dreaming + 0.1);
        mix.exploitation = Math.min(0.35, mix.exploitation + 0.05);
      }

      if (health.fertilityYield < 0.3) {
        mix['critic-refresh'] = Math.min(0.2, mix['critic-refresh'] + 0.1);
      }

      if (health.tasteAlignment < 0.4) {
        mix['critic-refresh'] = Math.min(0.25, mix['critic-refresh'] + 0.15);
      }
    }

    // Normalize to sum to 1.0
    const total = Object.values(mix).reduce((s, v) => s + v, 0);
    const activities: LoopActivity[] = ['exploration', 'exploitation', 'dreaming', 'compost-resurrection', 'critic-refresh'];

    return activities.map(activity => ({
      activity,
      fraction: mix[activity] / total,
      reason: this.reasonFor(activity, health, stagnation),
    }));
  }

  /**
   * Select N activities weighted by the current mix.
   */
  sampleActivities(count: number, health?: GardenHealthMetrics, stagnation?: StagnationResult): LoopActivity[] {
    const mix = this.computeMix(health, stagnation);
    const result: LoopActivity[] = [];
    const cumulative = mix.reduce((acc, m) => {
      acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + m.fraction);
      return acc;
    }, [] as number[]);

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      for (let j = 0; j < cumulative.length; j++) {
        if (r <= cumulative[j]) {
          result.push(mix[j].activity);
          break;
        }
      }
      if (result.length <= i) result.push(mix[mix.length - 1].activity);
    }

    return result;
  }

  private reasonFor(activity: LoopActivity, health?: GardenHealthMetrics, stagnation?: StagnationResult): string {
    if (stagnation?.isStagnant && (activity === 'exploration' || activity === 'compost-resurrection')) {
      return 'Stagnation recovery: increased allocation';
    }
    if (health?.nicheOccupancy !== undefined) {
      if (activity === 'exploration' && health.nicheOccupancy < 0.3) return 'Sparse archive: filling niches';
      if (activity === 'dreaming' && health.nicheOccupancy > 0.8) return 'Dense archive: exploring combinations';
    }
    if (activity === 'critic-refresh' && health?.tasteAlignment !== undefined && health.tasteAlignment < 0.4) {
      return 'Low taste alignment: refreshing critics';
    }
    return 'Baseline allocation';
  }
}
