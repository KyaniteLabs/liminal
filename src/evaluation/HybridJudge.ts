/**
 * HybridJudge — Phase 11 Increment 4
 *
 * Scores candidates on both code quality (via ScoringEngine) and
 * creative/aesthetic quality (via AestheticCritic), then synthesizes
 * into a single HybridJudgment.
 *
 * Both scoring paths run in parallel for performance. The judge
 * delegates synthesis to ConfidenceSynthesizer and applies a
 * configurable pass/fail threshold.
 */

import { ScoringEngine, type ScoringInput } from '../core/ScoringEngine.js';
import { AestheticCritic } from '../aesthetic/AestheticCritic.js';
import { synthesize } from './ConfidenceSynthesizer.js';
import type { HybridJudgment, HybridWeights, EvaluationCandidate } from './types.js';

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_HYBRID_WEIGHTS: HybridWeights = { code: 0.5, creative: 0.5 };

export class HybridJudge {
  private scoringEngine: ScoringEngine;
  private aestheticCritic: AestheticCritic;
  private threshold: number;
  private weights: HybridWeights;
  private strategy: string;

  constructor(options?: {
    scoringEngine?: ScoringEngine;
    aestheticCritic?: AestheticCritic;
    threshold?: number;
    weights?: HybridWeights;
    strategy?: string;
  }) {
    this.scoringEngine = options?.scoringEngine ?? new ScoringEngine();
    this.aestheticCritic = options?.aestheticCritic ?? new AestheticCritic();
    this.threshold = options?.threshold ?? DEFAULT_THRESHOLD;
    this.weights = options?.weights ?? DEFAULT_HYBRID_WEIGHTS;
    this.strategy = options?.strategy ?? 'comprehensive';
  }

  /**
   * Judge a candidate by running both scoring paths in parallel.
   *
   * Returns a HybridJudgment with blended score, confidence report,
   * and pass/fail determination.
   */
  async judge(candidate: EvaluationCandidate): Promise<HybridJudgment> {
    const scoringInput: ScoringInput = {
      output: candidate.code,
      domain: candidate.domain as any,
      prompt: candidate.prompt,
      previousOutputs: candidate.previousOutputs,
    };

    // Run both paths in parallel
    const [scoringResult, aestheticReport] = await Promise.all([
      this.scoringEngine.score(scoringInput, this.strategy),
      this.scoreAesthetic(candidate.code),
    ]);

    // Synthesize into confidence report
    // Map hybrid weights to synthesizer weights
    const synthWeights = {
      scoring: this.weights.code / (this.weights.code + this.weights.creative),
      aesthetic: this.weights.creative / (this.weights.code + this.weights.creative),
    };
    const confidence = synthesize(scoringResult, aestheticReport, synthWeights);

    // Blended score from the confidence report's quality
    const score = confidence.quality;

    return {
      score,
      confidence,
      passed: score >= this.threshold,
      strategies: [scoringResult.strategy, 'aesthetic'],
    };
  }

  /**
   * Score a candidate using only the code quality path.
   * Useful for quick checks without aesthetic evaluation.
   */
  async judgeCodeOnly(candidate: EvaluationCandidate): Promise<HybridJudgment> {
    const scoringInput: ScoringInput = {
      output: candidate.code,
      domain: candidate.domain as any,
      prompt: candidate.prompt,
      previousOutputs: candidate.previousOutputs,
    };

    const scoringResult = await this.scoringEngine.score(scoringInput, this.strategy);

    // Create a minimal aesthetic report (neutral) for synthesis
    const neutralAesthetic: import('../aesthetic/types.js').AestheticReport = {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
    };

    const confidence = synthesize(scoringResult, neutralAesthetic, { scoring: 1.0, aesthetic: 0.0 });

    return {
      score: scoringResult.score,
      confidence,
      passed: scoringResult.score >= this.threshold,
      strategies: [scoringResult.strategy],
    };
  }

  /** Run aesthetic critique, falling back to sync path if LLM is not configured */
  private async scoreAesthetic(code: string): Promise<import('../aesthetic/types.js').AestheticReport> {
    // Use sync critique — no LLM dependency for the default path
    return this.aestheticCritic.critique(code);
  }

  /** Update the quality threshold */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /** Get the current threshold */
  getThreshold(): number {
    return this.threshold;
  }
}
