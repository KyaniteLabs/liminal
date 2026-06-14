import type { GenerationEvaluation } from './types/GenerationEvaluation.js';

/**
 * A fitness score is HONEST — safe to persist as a quality exemplar or to drive selection —
 * only when the evaluator actually produced it: positive confidence AND a non-degraded
 * failure class.
 *
 * - `none`      — clean evaluator score (real signal).
 * - `render`    — deterministic luminance/render measure applied (real signal).
 * - `scorer` / `infra` — the LLM evaluator failed; the score is a keyword/neutral fallback.
 * - `validator` — the artifact failed validation (broken code).
 *
 * Admitting a `scorer`/`infra`/`validator` score (which readily clears the 0.65 admission
 * bar when the evaluator is offline) as a few-shot exemplar biases every future generation
 * toward fabricated or broken work — the core dishonest-fitness defect. Only `none`/`render`
 * with positive confidence are trustworthy.
 */
export function isHonestFitnessScore(
  confidence: number | undefined,
  failureClass: GenerationEvaluation['failureClass'] | undefined,
): boolean {
  const c = confidence ?? 1;
  const fc = failureClass ?? 'none';
  return c > 0 && (fc === 'none' || fc === 'render');
}
