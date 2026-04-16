/**
 * PromotionGate — Phase 11 Increment 6
 *
 * Blocks promotion when regression is detected by comparing current
 * evaluation results against baseline thresholds.
 *
 * Usage:
 *   const gate = new PromotionGate({ maxRegressions: 0 });
 *   const result = gate.check(suiteResult);
 *   if (!result.passed) {
 *     console.error(result.summary);
 *     process.exit(1);
 *   }
 */

import type { GoldenSuiteResult, GoldenCaseResult } from '../evaluation/types.js';

export interface PromotionGateConfig {
  /** Maximum allowed regressions before blocking (default: 0) */
  maxRegressions?: number;
  /** Minimum acceptable average score (default: 0.6) */
  minAverageScore?: number;
  /** Score drop that qualifies as a regression (default: 0.1) */
  regressionThreshold?: number;
  /** Baseline scores per case ID (from previous run) */
  baselines?: Map<string, number>;
}

export interface RegressionDetail {
  /** The case that regressed */
  caseId: string;
  /** Previous (baseline) score */
  baselineScore: number;
  /** Current score */
  currentScore: number;
  /** How much the score dropped */
  drop: number;
}

export interface PromotionGateResult {
  /** Whether promotion is allowed */
  passed: boolean;
  /** Cases that regressed from baseline */
  regressions: RegressionDetail[];
  /** Cases that failed their threshold */
  failures: GoldenCaseResult[];
  /** Human-readable summary */
  summary: string;
  /** Overall metrics */
  metrics: {
    totalCases: number;
    passed: number;
    failed: number;
    regressed: number;
    averageScore: number;
  };
}

export class PromotionGate {
  private maxRegressions: number;
  private minAverageScore: number;
  private regressionThreshold: number;
  private baselines: Map<string, number>;

  constructor(config?: PromotionGateConfig) {
    this.maxRegressions = config?.maxRegressions ?? 0;
    this.minAverageScore = config?.minAverageScore ?? 0.6;
    this.regressionThreshold = config?.regressionThreshold ?? 0.1;
    this.baselines = config?.baselines ?? new Map();
  }

  /**
   * Check whether a suite result passes the promotion gate.
   * Returns a PromotionGateResult with pass/fail and details.
   */
  check(suiteResult: GoldenSuiteResult): PromotionGateResult {
    const regressions = this.detectRegressions(suiteResult.caseResults);
    const failures = suiteResult.caseResults.filter(r => !r.passed);

    const metrics = {
      totalCases: suiteResult.total,
      passed: suiteResult.passed,
      failed: suiteResult.failed,
      regressed: regressions.length,
      averageScore: suiteResult.averageScore,
    };

    const blocked =
      failures.length > 0 ||
      regressions.length > this.maxRegressions ||
      suiteResult.averageScore < this.minAverageScore;

    const summary = this.buildSummary(blocked, failures, regressions, metrics);

    return {
      passed: !blocked,
      regressions,
      failures,
      summary,
      metrics,
    };
  }

  /** Update baselines from a passing suite result */
  updateBaselines(suiteResult: GoldenSuiteResult): void {
    for (const caseResult of suiteResult.caseResults) {
      this.baselines.set(caseResult.caseId, caseResult.judgment.score);
    }
  }

  /** Get current baselines */
  getBaselines(): Map<string, number> {
    return new Map(this.baselines);
  }

  /** Detect cases that regressed from baseline */
  private detectRegressions(caseResults: GoldenCaseResult[]): RegressionDetail[] {
    const regressions: RegressionDetail[] = [];

    for (const result of caseResults) {
      const baseline = this.baselines.get(result.caseId);
      if (baseline === undefined) continue;

      const drop = baseline - result.judgment.score;
      if (drop >= this.regressionThreshold) {
        regressions.push({
          caseId: result.caseId,
          baselineScore: baseline,
          currentScore: result.judgment.score,
          drop: Math.round(drop * 1000) / 1000,
        });
      }
    }

    return regressions;
  }

  private buildSummary(
    blocked: boolean,
    failures: GoldenCaseResult[],
    regressions: RegressionDetail[],
    metrics: PromotionGateResult['metrics'],
  ): string {
    const lines: string[] = [];

    if (!blocked) {
      lines.push(`PASSED: All ${metrics.totalCases} cases pass promotion gate.`);
      lines.push(`  Average score: ${metrics.averageScore.toFixed(3)}`);
      return lines.join('\n');
    }

    lines.push('BLOCKED: Promotion gate failed.');
    lines.push('');

    if (failures.length > 0) {
      lines.push(`  ${failures.length} case(s) failed threshold:`);
      for (const f of failures) {
        lines.push(`    - ${f.caseId}: score ${f.judgment.score.toFixed(3)}, margin ${f.margin.toFixed(3)}`);
      }
    }

    if (regressions.length > 0) {
      lines.push(`  ${regressions.length} regression(s) detected:`);
      for (const r of regressions) {
        lines.push(`    - ${r.caseId}: ${r.baselineScore.toFixed(3)} → ${r.currentScore.toFixed(3)} (drop: ${r.drop.toFixed(3)})`);
      }
    }

    if (metrics.averageScore < this.minAverageScore) {
      lines.push(`  Average score ${metrics.averageScore.toFixed(3)} below minimum ${this.minAverageScore}`);
    }

    lines.push('');
    lines.push(`  Summary: ${metrics.passed}/${metrics.totalCases} passed, ${metrics.failed} failed, ${metrics.regressed} regressed`);

    return lines.join('\n');
  }
}
