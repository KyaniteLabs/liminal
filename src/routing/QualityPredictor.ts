/**
 * QualityPredictor — Predicts output quality for model routing decisions.
 *
 * Inspired by Print-OS's failure_model.py, this module uses heuristic-based
 * prediction to recommend the best model tier (local, cloud, or premium) for
 * a given generation request. It maintains a performance history per model
 * and domain, allowing routing decisions to improve over time.
 *
 * @module routing/QualityPredictor
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Features used to predict output quality and recommend a model.
 */
export interface RoutingFeatures {
  /** Length of the generation prompt in characters. */
  promptLength: number;
  /** Assessed code complexity of the requested output. */
  codeComplexity: 'simple' | 'medium' | 'complex';
  /** Target domain (e.g. "code", "music", "ascii", "visual"). */
  domain: string;
  /** Quality score from the previous generation, or null if first run. */
  previousScore: number | null;
  /** Model tier constraint set by the caller. */
  modelTier: 'local' | 'cloud' | 'premium';
}

/**
 * Predicted quality outcome and model recommendation.
 */
export interface QualityPrediction {
  /** Predicted quality score in the range [0, 1]. */
  predictedScore: number;
  /** Confidence in the prediction in the range [0, 1]. */
  confidence: number;
  /** Recommended model identifier (e.g. "local-qwen", "cloud-minimax"). */
  recommendedModel: string;
  /** Human-readable explanation of the prediction rationale. */
  reasoning: string;
}

/**
 * Tracked historical performance for a single model + domain pair.
 */
export interface ModelPerformanceRecord {
  /** Model identifier. */
  model: string;
  /** Domain the record applies to. */
  domain: string;
  /** Rolling average quality score. */
  avgScore: number;
  /** Number of recorded outcomes. */
  sampleCount: number;
  /** Unix timestamp (ms) of the last recorded outcome. */
  lastUsed: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of history records retained per model-domain pair. */
const MAX_HISTORY_PER_PAIR = 100;

/** Exponential moving average weight for new outcomes (0–1). */
const EMA_ALPHA = 0.3;

/** Tier identifiers used for quality tracking and recommendations. */
const TIER_IDS: Record<RoutingFeatures['modelTier'], string> = {
  local: 'local',
  cloud: 'cloud',
  premium: 'premium',
};

/**
 * Baseline predicted scores for each code-complexity level when using the
 * local tier. These serve as the starting point before history adjustments.
 */
const BASELINE_LOCAL_SCORES: Record<RoutingFeatures['codeComplexity'], number> = {
  simple: 0.75,
  medium: 0.70,
  complex: 0.60,
};

/**
 * Score boost applied when upgrading from local to cloud or premium tiers.
 */
const TIER_BOOST: Record<RoutingFeatures['modelTier'], number> = {
  local: 0.0,
  cloud: 0.12,
  premium: 0.18,
};

/**
 * Score adjustment when the previous generation had a known quality score.
 * Positive values improve the prediction; negative values lower it.
 */
const PREVIOUS_SCORE_BUMP = 0.08;

// ---------------------------------------------------------------------------
// QualityPredictor
// ---------------------------------------------------------------------------

/**
 * Predicts output quality for model routing decisions.
 *
 * Uses a combination of code-complexity heuristics, previous-score tracking,
 * and rolling model performance history to recommend the optimal model for a
 * given generation request.
 *
 * Usage:
 * ```ts
 * const predictor = new QualityPredictor();
 * const prediction = predictor.predictQuality({
 *   promptLength: 320,
 *   codeComplexity: 'medium',
 *   domain: 'code',
 *   previousScore: 0.85,
 *   modelTier: 'local',
 * });
 * // prediction.recommendedModel === 'local-qwen'
 * predictor.recordOutcome('local-qwen', 'code', 0.88);
 * ```
 */
export class QualityPredictor {
  /** Rolling performance history keyed by "model::domain". */
  private history: ModelPerformanceRecord[] = [];

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Predict output quality and recommend a model based on routing features.
   *
   * Heuristic rules:
   * - Simple code  → local model sufficient (predicted 0.70–0.80)
   * - Medium code + previous score > 0.8 → local model (predicted 0.75–0.85)
   * - Complex code or previous score < 0.5 → cloud model (predicted 0.80–0.90)
   * - Domain with no history → default to local, fallback to cloud
   *
   * @param features - Routing features describing the generation request.
   * @returns A quality prediction with recommended model and reasoning.
   */
  predictQuality(features: RoutingFeatures): QualityPrediction {
    const { codeComplexity, previousScore, modelTier, domain } = features;

    const hasDomainHistory = this.hasHistoryForDomain(domain);
    const bestHistorical = this.getBestModelForDomain(domain);

    // Determine the recommended tier based on heuristics
    let recommendedTier: RoutingFeatures['modelTier'] = 'local';

    if (codeComplexity === 'simple') {
      // Simple code: local is sufficient
      recommendedTier = 'local';
    } else if (codeComplexity === 'medium') {
      // Medium code: stay local if previous score was good
      if (previousScore !== null && previousScore > 0.8) {
        recommendedTier = 'local';
      } else if (previousScore !== null && previousScore < 0.5) {
        recommendedTier = 'cloud';
      } else {
        recommendedTier = 'local';
      }
    } else {
      // Complex code: always prefer cloud or premium
      recommendedTier = 'cloud';
    }

    // If we have domain history and it strongly favours a different tier, respect it
    if (hasDomainHistory && bestHistorical) {
      const histTier = this.tierFromModel(bestHistorical.model);
      if (histTier && bestHistorical.avgScore > 0.75 && bestHistorical.sampleCount >= 3) {
        recommendedTier = histTier;
      }
    }

    // Honour the caller's tier constraint: never exceed it
    const tierOrder: Record<RoutingFeatures['modelTier'], number> = {
      local: 0,
      cloud: 1,
      premium: 2,
    };
    if (tierOrder[recommendedTier] > tierOrder[modelTier]) {
      recommendedTier = modelTier;
    }

    // Calculate predicted score
    let predictedScore = BASELINE_LOCAL_SCORES[codeComplexity] + TIER_BOOST[recommendedTier];

    // Adjust for previous score
    if (previousScore !== null) {
      if (previousScore > 0.8) {
        predictedScore += PREVIOUS_SCORE_BUMP;
      } else if (previousScore < 0.5) {
        predictedScore -= PREVIOUS_SCORE_BUMP;
      }
    }

    // Clamp to [0, 1]
    predictedScore = Math.max(0, Math.min(1, predictedScore));

    // Confidence: higher with more history
    const domainSampleCount = this.totalSamplesForDomain(domain);
    const confidence = Math.min(1, 0.5 + domainSampleCount * 0.02);

    // Build reasoning string
    const reasoning = this.buildReasoning(
      codeComplexity,
      previousScore,
      recommendedTier,
      hasDomainHistory,
      domainSampleCount,
    );

    return {
      predictedScore: Math.round(predictedScore * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      recommendedModel: TIER_IDS[recommendedTier],
      reasoning,
    };
  }

  /**
   * Record an actual generation outcome so future predictions improve.
   *
   * Uses an exponential moving average to blend the new score with the
   * existing average, keeping the history responsive to recent trends.
   *
   * @param model  - Model identifier that produced the output.
   * @param domain - Domain of the generation.
   * @param score  - Observed quality score in the range [0, 1].
   */
  recordOutcome(model: string, domain: string, score: number): void {
    const existing = this.history.find(
      (r) => r.model === model && r.domain === domain,
    );

    if (existing) {
      // Update with EMA
      existing.avgScore =
        EMA_ALPHA * score + (1 - EMA_ALPHA) * existing.avgScore;
      existing.sampleCount++;
      existing.lastUsed = Date.now();

      // Evict oldest entries if we exceed the cap
      if (existing.sampleCount > MAX_HISTORY_PER_PAIR) {
        existing.sampleCount = MAX_HISTORY_PER_PAIR;
      }
    } else {
      this.history.push({
        model,
        domain,
        avgScore: score,
        sampleCount: 1,
        lastUsed: Date.now(),
      });
    }
  }

  /**
   * Rank all known models by their average score for a given domain.
   *
   * Results are sorted descending by average score so the best-performing
   * model appears first.
   *
   * @param domain - Domain to rank models for.
   * @returns Array of model scores sorted from best to worst.
   */
  getModelRanking(
    domain: string,
  ): Array<{ model: string; avgScore: number; sampleCount: number }> {
    return this.history
      .filter((r) => r.domain === domain)
      .map((r) => ({
        model: r.model,
        avgScore: Math.round(r.avgScore * 1000) / 1000,
        sampleCount: r.sampleCount,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  /**
   * Return the best model identifier for the given routing features.
   *
   * This is a convenience wrapper around {@link predictQuality} that returns
   * only the recommended model string.
   *
   * @param features - Routing features describing the generation request.
   * @returns Model identifier recommended for the request.
   */
  getRecommendedModel(features: RoutingFeatures): string {
    return this.predictQuality(features).recommendedModel;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Check whether any history exists for a domain.
   * @param domain - Domain to check.
   * @returns True if at least one record exists.
   */
  private hasHistoryForDomain(domain: string): boolean {
    return this.history.some((r) => r.domain === domain);
  }

  /**
   * Get the best-performing model record for a domain.
   * @param domain - Domain to look up.
   * @returns The top model record, or null if none exists.
   */
  private getBestModelForDomain(
    domain: string,
  ): ModelPerformanceRecord | null {
    const domainRecords = this.history.filter((r) => r.domain === domain);
    if (domainRecords.length === 0) return null;
    return domainRecords.reduce((best, r) =>
      r.avgScore > best.avgScore ? r : best,
    );
  }

  /**
   * Derive the model tier from a model identifier string.
   * @param modelId - Full model identifier (e.g. "local-qwen").
   * @returns The tier label, or null if unrecognised.
   */
  private tierFromModel(
    modelId: string,
  ): RoutingFeatures['modelTier'] | null {
    for (const [tier, id] of Object.entries(TIER_IDS)) {
      if (id === modelId) {
        return tier as RoutingFeatures['modelTier'];
      }
    }
    return null;
  }

  /**
   * Sum total sample counts across all models for a domain.
   * @param domain - Domain to tally.
   * @returns Total number of recorded outcomes.
   */
  private totalSamplesForDomain(domain: string): number {
    return this.history
      .filter((r) => r.domain === domain)
      .reduce((sum, r) => sum + r.sampleCount, 0);
  }

  /**
   * Build a human-readable reasoning string for the prediction.
   */
  private buildReasoning(
    complexity: RoutingFeatures['codeComplexity'],
    previousScore: number | null,
    tier: RoutingFeatures['modelTier'],
    hasHistory: boolean,
    sampleCount: number,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Code complexity "${complexity}" suggests ${complexity === 'complex' ? 'cloud' : 'local'} model.`,
    );

    if (previousScore !== null) {
      if (previousScore > 0.8) {
        parts.push(`Previous score ${previousScore.toFixed(2)} is strong, local model viable.`);
      } else if (previousScore < 0.5) {
        parts.push(`Previous score ${previousScore.toFixed(2)} is low, upgrading to cloud.`);
      } else {
        parts.push(`Previous score ${previousScore.toFixed(2)} is moderate.`);
      }
    } else {
      parts.push('No previous score available.');
    }

    if (hasHistory) {
      parts.push(`${sampleCount} historical sample(s) for this domain.`);
    } else {
      parts.push('No domain history; defaulting to local with cloud fallback.');
    }

    parts.push(`Recommended tier: ${tier} (${TIER_IDS[tier]}).`);

    return parts.join(' ');
  }
}
