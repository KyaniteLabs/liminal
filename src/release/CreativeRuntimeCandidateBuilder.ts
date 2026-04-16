/**
 * CreativeRuntimeCandidateBuilder — Phase 16
 *
 * Builds release candidates from policy experiments and weakness fixes.
 * Validates candidates against golden suites before promotion.
 */

import type { PolicyChangeRecord } from './PolicyChangeManifest.js';

export interface RuntimeCandidate {
  id: string;
  description: string;
  changes: PolicyChangeRecord[];
  builtAt: string;
  validationScore: number;
  passed: boolean;
}

export interface RuntimeCandidateConfig {
  /** Minimum validation score for passing (default: 0.7) */
  passingThreshold?: number;
}

export class CreativeRuntimeCandidateBuilder {
  private readonly passingThreshold: number;
  private candidateCount = 0;

  constructor(config: RuntimeCandidateConfig = {}) {
    this.passingThreshold = config.passingThreshold ?? 0.7;
  }

  /**
   * Build a candidate from a set of policy changes.
   */
  build(changes: PolicyChangeRecord[], description: string): RuntimeCandidate {
    const id = `candidate-${++this.candidateCount}`;

    // Validate: check that all changes are promoted
    const promotedChanges = changes.filter(c => c.status === 'promoted');
    const allPromoted = promotedChanges.length === changes.length;

    // Compute validation score from metric improvements
    let totalImprovement = 0;
    let metricCount = 0;
    for (const change of promotedChanges) {
      for (const key of Object.keys(change.metricsAfter)) {
        const before = change.metricsBefore[key] ?? 0;
        const after = change.metricsAfter[key];
        totalImprovement += Math.max(0, after - before);
        metricCount++;
      }
    }

    const avgImprovement = metricCount > 0 ? totalImprovement / metricCount : 0;
    const validationScore = allPromoted ? Math.min(1, 0.5 + avgImprovement * 5) : 0;

    return {
      id,
      description,
      changes: promotedChanges,
      builtAt: new Date().toISOString(),
      validationScore,
      passed: validationScore >= this.passingThreshold,
    };
  }

  /**
   * Validate a candidate against a simple scoring function.
   */
  validate(candidate: RuntimeCandidate, scoreFn: (candidate: RuntimeCandidate) => number): RuntimeCandidate {
    const score = scoreFn(candidate);
    return {
      ...candidate,
      validationScore: score,
      passed: score >= this.passingThreshold,
    };
  }

  getCandidateCount(): number {
    return this.candidateCount;
  }
}
