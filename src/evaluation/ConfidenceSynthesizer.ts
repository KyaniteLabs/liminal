/**
 * ConfidenceSynthesizer — Phase 11 Increment 4
 *
 * Merges ScoringEngine results with AestheticCritic reports into
 * a single ConfidenceReport. Detects agreement/divergence between
 * critics and produces a unified quality + confidence signal.
 *
 * Design: pure function-based synthesis. No LLM calls — this module
 * only combines pre-computed scores, making it deterministic and fast.
 */

import type { ScoringResult } from '../core/ScoringEngine.js';
import type { AestheticReport } from '../aesthetic/types.js';
import type { ConfidenceReport, ConfidenceDimension, AgreementLevel } from './types.js';

/** Threshold for major divergence between critics */
const MAJOR_DIVERGENCE_THRESHOLD = 0.3;
/** Threshold for minor divergence */
const MINOR_DIVERGENCE_THRESHOLD = 0.15;

/**
 * Synthesize a ScoringResult and AestheticReport into a ConfidenceReport.
 *
 * Agreement detection: compares the ScoringEngine's overall score with
 * the AestheticCritic's score. When they diverge, confidence drops because
 * the critics disagree about quality — the result is less trustworthy.
 *
 * Quality: weighted average of both critics (0.6 scoring, 0.4 aesthetic
 * by default). This biases slightly toward code quality since ScoringEngine
 * has richer dimension coverage.
 */
export function synthesize(
  scoringResult: ScoringResult,
  aestheticReport: AestheticReport,
  weights: { scoring?: number; aesthetic?: number } = {},
): ConfidenceReport {
  const scoringWeight = weights.scoring ?? 0.6;
  const aestheticWeight = weights.aesthetic ?? 0.4;

  const scoringScore = scoringResult.score;
  const aestheticScore = aestheticReport.score;

  // Overall quality = weighted blend
  const quality = (scoringScore * scoringWeight) + (aestheticScore * aestheticWeight);

  // Agreement: how close are the two critics?
  const delta = Math.abs(scoringScore - aestheticScore);
  const agreement: AgreementLevel =
    delta > MAJOR_DIVERGENCE_THRESHOLD
      ? 'major-divergence'
      : delta > MINOR_DIVERGENCE_THRESHOLD
        ? 'minor-divergence'
        : 'consensus';

  // Confidence: starts at 1.0, reduced by divergence
  // consensus → 0.9-1.0, minor → 0.6-0.9, major → 0.3-0.6
  let confidence: number;
  if (agreement === 'consensus') {
    confidence = 0.95;
  } else if (agreement === 'minor-divergence') {
    confidence = 0.75 - (delta - MINOR_DIVERGENCE_THRESHOLD);
  } else {
    confidence = 0.45 - (delta - MAJOR_DIVERGENCE_THRESHOLD) * 0.5;
  }
  confidence = Math.max(0.1, Math.min(1.0, confidence));

  // Dimensions: merge scoring dimensions + aesthetic as a dimension
  const dimensions: ConfidenceDimension[] = [];

  for (const [name, score] of Object.entries(scoringResult.dimensions)) {
    if (score !== undefined) {
      dimensions.push({ name, score, source: 'scoring-engine' });
    }
  }

  dimensions.push({
    name: 'aesthetic',
    score: aestheticScore,
    source: 'aesthetic-critic',
  });

  // Issues: merge from both sources
  const issues: string[] = [
    ...(scoringResult.issues ?? []),
    ...aestheticReport.violations.map(v => `${v.severity}: ${v.message}`),
  ];

  return {
    confidence,
    quality: Math.round(quality * 1000) / 1000,
    dimensions,
    agreement,
    issues,
    scoringResult,
    aestheticReport,
  };
}

/**
 * Quick check: does a ConfidenceReport indicate a trustworthy result?
 * Returns false when confidence is very low (critics strongly disagree).
 */
export function isTrustworthy(report: ConfidenceReport): boolean {
  return report.confidence >= 0.3;
}
