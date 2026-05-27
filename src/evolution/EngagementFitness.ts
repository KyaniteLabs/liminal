/**
 * EngagementFitness — computes an engagement score (0-1) from PostHog experiment data.
 *
 * The engagement score is a weighted combination of:
 * - dwellRate (0-1): fraction of visitors who stayed >10s
 * - scrollDepth (0-1): average scroll depth
 * - interactionRate (0-1): fraction who clicked/interacted with the slot
 * - retentionScore (0-1): inverse bounce rate (1 - bounceRate)
 *
 * New variants without PostHog data receive a neutral 0.5 score.
 */

export interface EngagementMetrics {
  /** Fraction of visitors who stayed >10s (0-1) */
  dwellRate: number;
  /** Average scroll depth normalized to 0-1 */
  scrollDepth: number;
  /** Fraction who clicked/touched the slot element (0-1) */
  interactionRate: number;
  /** Inverse bounce rate: 1 - bounceRate (0-1) */
  retentionScore: number;
}

export const ENGAGEMENT_WEIGHTS = {
  dwellRate: 0.3,
  scrollDepth: 0.2,
  interactionRate: 0.3,
  retentionScore: 0.2,
} as const;

/** Neutral engagement score for variants without PostHog data */
export const NEUTRAL_ENGAGEMENT = 0.5;

export class EngagementFitness {
  /**
   * Compute engagement score from metrics.
   * Returns a value in [0, 1].
   */
  score(metrics: EngagementMetrics): number {
    const clamped = this.clampMetrics(metrics);
    return (
      clamped.dwellRate * ENGAGEMENT_WEIGHTS.dwellRate
      + clamped.scrollDepth * ENGAGEMENT_WEIGHTS.scrollDepth
      + clamped.interactionRate * ENGAGEMENT_WEIGHTS.interactionRate
      + clamped.retentionScore * ENGAGEMENT_WEIGHTS.retentionScore
    );
  }

  /**
   * Return the neutral engagement score for variants without data.
   */
  neutralScore(): number {
    return NEUTRAL_ENGAGEMENT;
  }

  private clampMetrics(m: EngagementMetrics): EngagementMetrics {
    return {
      dwellRate: Math.max(0, Math.min(1, m.dwellRate)),
      scrollDepth: Math.max(0, Math.min(1, m.scrollDepth)),
      interactionRate: Math.max(0, Math.min(1, m.interactionRate)),
      retentionScore: Math.max(0, Math.min(1, m.retentionScore)),
    };
  }
}
