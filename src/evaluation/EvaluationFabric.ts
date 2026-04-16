/**
 * EvaluationFabric — Phase 11 Increment 4
 *
 * Top-level orchestrator for the evaluation pipeline.
 * Takes a candidate + optional golden suite, runs the HybridJudge,
 * and returns a unified EvaluationFabricResult.
 *
 * Usage:
 *   const fabric = new EvaluationFabric();
 *   const result = await fabric.evaluate(candidate);
 *   // result.judgment.score, result.judgment.passed, etc.
 *
 * With golden suite:
 *   const result = await fabric.evaluateWithSuite(candidate, suite);
 *   // result.suiteResult has per-case pass/fail
 */

import { HybridJudge } from './HybridJudge.js';
import type {
  EvaluationCandidate,
  EvaluationFabricConfig,
  EvaluationFabricResult,
  GoldenSuite,
  GoldenSuiteResult,
  GoldenCaseResult,
} from './types.js';

const DEFAULT_CONFIG: Required<EvaluationFabricConfig> = {
  qualityThreshold: 0.6,
  minConfidence: 0.3,
  scoringStrategy: 'comprehensive',
  hybridWeights: { code: 0.5, creative: 0.5 },
  useLLM: false,
};

export class EvaluationFabric {
  private judge: HybridJudge;
  private config: Required<EvaluationFabricConfig>;

  constructor(config?: EvaluationFabricConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.judge = new HybridJudge({
      threshold: this.config.qualityThreshold,
      weights: this.config.hybridWeights,
      strategy: this.config.scoringStrategy,
    });
  }

  /**
   * Evaluate a single candidate.
   * Returns the hybrid judgment with timing metadata.
   */
  async evaluate(candidate: EvaluationCandidate): Promise<EvaluationFabricResult> {
    const start = Date.now();
    const judgment = await this.judge.judge(candidate);
    const durationMs = Date.now() - start;

    return {
      judgment,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Evaluate a candidate against a golden suite.
   * Each golden case defines its own prompt and threshold — the candidate
   * is checked against every case's requirements.
   *
   * Note: the candidate is evaluated once; the same judgment is compared
   * against each golden case's thresholds. For suite runs where each case
   * needs its own generation, use a dedicated suite runner.
   */
  async evaluateWithSuite(
    candidate: EvaluationCandidate,
    suite: GoldenSuite,
  ): Promise<EvaluationFabricResult> {
    const start = Date.now();
    const judgment = await this.judge.judge(candidate);

    // Compare the single judgment against each golden case
    const caseResults: GoldenCaseResult[] = suite.cases.map(goldenCase => {
      const passed = judgment.score >= goldenCase.minScore;
      const margin = judgment.score - goldenCase.minScore;

      return {
        caseId: goldenCase.id,
        candidate,
        judgment,
        passed,
        margin: Math.round(margin * 1000) / 1000,
      };
    });

    const passedCount = caseResults.filter(r => r.passed).length;
    const failedCount = caseResults.length - passedCount;
    const averageScore = caseResults.reduce((sum, r) => sum + r.judgment.score, 0) / caseResults.length;

    const suiteResult: GoldenSuiteResult = {
      suiteName: suite.name,
      caseResults,
      passed: passedCount,
      failed: failedCount,
      total: caseResults.length,
      averageScore: Math.round(averageScore * 1000) / 1000,
      suitePassed: failedCount === 0,
    };

    return {
      judgment,
      suiteResult,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  /** Quick quality check — returns just the score */
  async quickScore(code: string): Promise<number> {
    const result = await this.evaluate({ code });
    return result.judgment.score;
  }

  /** Get the current configuration */
  getConfig(): Required<EvaluationFabricConfig> {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(update: Partial<EvaluationFabricConfig>): void {
    this.config = { ...this.config, ...update };
    if (update.qualityThreshold !== undefined) {
      this.judge.setThreshold(update.qualityThreshold);
    }
  }
}
