/**
 * ProvenanceNarrativeBuilder — Phase 16
 *
 * Builds human-readable narratives explaining what changed in the
 * garden, why it changed, which metrics improved, and what triggered it.
 */

import type { PolicyChangeRecord } from '../release/PolicyChangeManifest.js';
import type { CreativeWeakness } from '../autonomy/CreativeWeaknessEmitter.js';
import type { GardenerCycleResult } from '../autonomy/AutonomousGardener.js';

export interface ProvenanceNarrative {
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  generatedAt: string;
}

export class ProvenanceNarrativeBuilder {
  /**
   * Build a narrative from recent garden changes and weaknesses.
   */
  build(
    changes: PolicyChangeRecord[],
    weaknesses: CreativeWeakness[],
    recentCycles?: GardenerCycleResult[],
  ): ProvenanceNarrative {
    const sections: ProvenanceNarrative['sections'] = [];

    // 1. Active weaknesses
    if (weaknesses.length > 0) {
      sections.push({
        heading: 'Detected Weaknesses',
        body: weaknesses
          .map(w => `- **${w.category}** (severity ${w.severity.toFixed(1)}): ${w.description}`)
          .join('\n'),
      });
    }

    // 2. Recent policy changes
    const promoted = changes.filter(c => c.status === 'promoted');
    if (promoted.length > 0) {
      sections.push({
        heading: 'Policy Changes Promoted',
        body: promoted
          .map(c => {
            const improvements = Object.entries(c.metricsAfter)
              .filter(([k]) => (c.metricsBefore[k] ?? 0) < c.metricsAfter[k])
              .map(([k, v]) => `${k}: ${c.metricsBefore[k]?.toFixed(2) ?? '?'} → ${v.toFixed(2)}`);
            const trigger = c.triggerWeakness ? ` (triggered by: ${c.triggerWeakness})` : '';
            return `- **${c.policyKind}**: ${c.changeDescription}${trigger}\n  ${improvements.length > 0 ? `Improved: ${improvements.join(', ')}` : 'No metric improvements recorded'}`;
          })
          .join('\n'),
      });
    }

    // 3. Garden health summary from recent cycles
    if (recentCycles && recentCycles.length > 0) {
      const latest = recentCycles[recentCycles.length - 1];
      const health = latest.health;
      sections.push({
        heading: 'Garden Health',
        body: [
          `Health: **${health.healthLevel}** (score: ${health.healthScore.toFixed(2)})`,
          `Archive size: ${health.archiveSize}, Niche occupancy: ${(health.nicheOccupancy * 100).toFixed(0)}%`,
          `Fertility yield: ${(health.fertilityYield * 100).toFixed(0)}%, Taste alignment: ${(health.tasteAlignment * 100).toFixed(0)}%`,
          `Budget remaining: ${latest.budgetRemaining} units`,
        ].join('\n'),
      });
    }

    // 4. Rolled-back changes
    const rolledBack = changes.filter(c => c.status === 'rolled-back');
    if (rolledBack.length > 0) {
      sections.push({
        heading: 'Rolled Back',
        body: rolledBack
          .map(c => `- **${c.policyKind}**: ${c.changeDescription}`)
          .join('\n'),
      });
    }

    const totalChanges = changes.length;
    const totalWeaknesses = weaknesses.length;
    const summary = totalChanges > 0
      ? `${totalChanges} policy changes tracked, ${promoted.length} promoted, ${totalWeaknesses} active weaknesses`
      : totalWeaknesses > 0
        ? `${totalWeaknesses} weaknesses detected, no policy changes yet`
        : 'Garden stable — no changes or weaknesses to report';

    return {
      title: 'Garden Provenance Report',
      summary,
      sections,
      generatedAt: new Date().toISOString(),
    };
  }
}
