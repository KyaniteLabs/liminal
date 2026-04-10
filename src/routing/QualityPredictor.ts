/**
 * QualityPredictor - Predicts generation quality and recommends models
 */

export interface RoutingFeatures {
  promptLength: number;
  codeComplexity: 'simple' | 'medium' | 'complex';
  domain: string;
  previousScore: number | null;
  modelTier: 'local' | 'cloud';
}

export interface QualityPrediction {
  predictedScore: number;
  recommendedModel: string;
  reasoning: string;
  confidence: number;
}

interface OutcomeRecord {
  model: string;
  domain: string;
  score: number;
}

// Baseline scores for local model by complexity
const BASELINE_LOCAL_SCORES: Record<string, number> = {
  simple: 0.75,
  medium: 0.65,
  complex: 0.55,
};

// Cloud model bonus for complex tasks
const CLOUD_COMPLEXITY_BONUS: Record<string, number> = {
  simple: 0,
  medium: 0.05,
  complex: 0.15,
};

export class QualityPredictor {
  private outcomes: OutcomeRecord[] = [];

  predictQuality(features: RoutingFeatures): QualityPrediction {
    // Start with baseline score for the complexity level
    let predictedScore = BASELINE_LOCAL_SCORES[features.codeComplexity] ?? 0.65;

    // Add tier bonus (cloud models perform better on complex tasks)
    if (features.modelTier === 'cloud') {
      predictedScore += CLOUD_COMPLEXITY_BONUS[features.codeComplexity] ?? 0;
    }

    // Previous score adjustments
    if (features.previousScore !== null) {
      if (features.previousScore > 0.8) {
        predictedScore += 0.08; // Bump for good previous performance
      } else if (features.previousScore < 0.5) {
        predictedScore -= 0.08; // Penalty for poor previous performance
      }
    }

    // Clamp to [0, 1]
    predictedScore = Math.max(0, Math.min(1, predictedScore));

    const recommendedModel = this.getRecommendedModel(features, predictedScore);

    // Confidence based on data availability
    const domainOutcomes = this.outcomes.filter(o => o.domain === features.domain).length;
    let confidence = 0.5 + Math.min(domainOutcomes * 0.05, 0.4);
    if (features.previousScore !== null) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    // Build reasoning string
    let reasoning = `${features.codeComplexity} complexity; local recommendation`;
    if (features.previousScore !== null) {
      reasoning += `; previous score: ${features.previousScore}`;
    } else {
      reasoning = `Based on ${features.codeComplexity} complexity; No previous score available`;
    }

    return {
      predictedScore,
      recommendedModel,
      reasoning,
      confidence,
    };
  }

  recordOutcome(model: string, domain: string, score: number): void {
    this.outcomes.push({ model, domain, score });
  }

  getModelRanking(domain: string): Array<{ model: string; avgScore: number }> {
    const domainOutcomes = this.outcomes.filter(o => o.domain === domain);

    const modelScores = new Map<string, number[]>();
    for (const outcome of domainOutcomes) {
      const scores = modelScores.get(outcome.model) || [];
      scores.push(outcome.score);
      modelScores.set(outcome.model, scores);
    }

    // Use exponential moving average for smoother updates
    const rankings = Array.from(modelScores.entries())
      .map(([model, scores]) => ({
        model,
        avgScore: this.calculateEMA(scores),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    return rankings;
  }

  private calculateEMA(scores: number[]): number {
    if (scores.length === 0) return 0;
    if (scores.length === 1) return scores[0];

    const alpha = 0.3; // Smoothing factor
    let ema = scores[0];
    for (let i = 1; i < scores.length; i++) {
      // EMA: new = alpha * current + (1 - alpha) * previous
      ema = alpha * scores[i] + (1 - alpha) * ema;
    }
    return ema;
  }

  getRecommendedModel(features: RoutingFeatures, _score?: number): string {
    // Check if we have history for this domain
    const ranking = this.getModelRanking(features.domain);

    // If we have strong history favoring a model, use it
    if (ranking.length > 0) {
      const bestModel = ranking[0];
      // Only override if the best model has significantly better score
      if (bestModel.avgScore > 0.75) {
        return bestModel.model;
      }
    }

    // Heuristic: for complex code, use the requested tier
    // For simple/medium code, default to local (conservative) unless tier is cloud
    if (features.codeComplexity === 'complex') {
      return features.modelTier === 'cloud' ? 'cloud' : 'local';
    }

    // For simple/medium code, prefer local for cost efficiency
    return 'local';
  }
}
