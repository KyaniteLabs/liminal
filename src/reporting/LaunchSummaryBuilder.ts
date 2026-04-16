/**
 * LaunchSummaryBuilder — Phase 16
 *
 * Builds a summary of the garden state suitable for launch/readiness assessment.
 */

import type { GardenHealthMetrics } from '../autonomy/GardenHealthMonitor.js';
import type { PolicyChangeRecord } from '../release/PolicyChangeManifest.js';
import type { CreativeWeakness } from '../autonomy/CreativeWeaknessEmitter.js';

export interface LaunchReadiness {
  ready: boolean;
  score: number;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  blockers: string[];
}

export class LaunchSummaryBuilder {
  /**
   * Assess launch readiness from garden metrics, changes, and weaknesses.
   */
  assess(
    health: GardenHealthMetrics,
    changes: PolicyChangeRecord[],
    weaknesses: CreativeWeakness[],
  ): LaunchReadiness {
    const checks: LaunchReadiness['checks'] = [];
    const blockers: string[] = [];

    // 1. Archive size
    const archiveOk = health.archiveSize >= 10;
    checks.push({
      name: 'Archive size',
      passed: archiveOk,
      detail: `${health.archiveSize} entries (min 10)`,
    });
    if (!archiveOk) blockers.push('Archive too small for launch');

    // 2. Niche occupancy
    const occupancyOk = health.nicheOccupancy >= 0.3;
    checks.push({
      name: 'Niche diversity',
      passed: occupancyOk,
      detail: `${(health.nicheOccupancy * 100).toFixed(0)}% occupancy (min 30%)`,
    });
    if (!occupancyOk) blockers.push('Niche occupancy too low');

    // 3. Health level
    const healthOk = health.healthLevel === 'thriving' || health.healthLevel === 'healthy';
    checks.push({
      name: 'Garden health',
      passed: healthOk,
      detail: `${health.healthLevel} (score: ${health.healthScore.toFixed(2)})`,
    });
    if (!healthOk) blockers.push(`Garden health is ${health.healthLevel}`);

    // 4. No unresolved high-severity weaknesses
    const highSeverity = weaknesses.filter(w => w.severity >= 0.7);
    const weaknessOk = highSeverity.length === 0;
    checks.push({
      name: 'Weakness resolution',
      passed: weaknessOk,
      detail: `${highSeverity.length} high-severity weaknesses (max 0)`,
    });
    if (!weaknessOk) blockers.push(`${highSeverity.length} unresolved high-severity weaknesses`);

    // 5. Promoted changes stability
    const recentPromotions = changes.filter(c => c.status === 'promoted').length;
    const changesOk = changes.length === 0 || recentPromotions > 0;
    checks.push({
      name: 'Policy stability',
      passed: changesOk,
      detail: `${changes.length} changes, ${recentPromotions} promoted`,
    });

    // 6. Taste alignment
    const tasteOk = health.tasteAlignment >= 0.3;
    checks.push({
      name: 'Taste alignment',
      passed: tasteOk,
      detail: `${(health.tasteAlignment * 100).toFixed(0)}% (min 30%)`,
    });
    if (!tasteOk) blockers.push('Taste alignment below threshold');

    const passedCount = checks.filter(c => c.passed).length;
    const score = passedCount / checks.length;

    return {
      ready: blockers.length === 0,
      score,
      checks,
      blockers,
    };
  }
}
