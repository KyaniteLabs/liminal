/**
 * QualityPredictor - Predicts generation quality and recommends models
 */

export interface RoutingFeatures {
  promptLength: number;
  codeComplexity: 'simple' | 'complex';
  domain: string;
  previousScore: number | null;
  modelTier: 'local' | 'cloud';
}

export interface QualityPrediction {
  predictedScore: number;
  recommendedModel: string;
  reasoning: string;
}

interface OutcomeRecord {
  model: string;
  domain: string;
  score: number;
}

export class QualityPredictor {
  private outcomes: OutcomeRecord[] = [];

  predictQuality(features: RoutingFeatures): QualityPrediction {
    // Simple heuristic-based prediction
    let predictedScore = 0.5;

    if (features.codeComplexity === 'simple') {
      predictedScore += 0.2;
    } else {
      predictedScore -= 0.1;
    }

    if (features.promptLength > 100 && features.promptLength < 1000) {
      predictedScore += 0.1;
    }

    // Clamp to [0, 1]
    predictedScore = Math.max(0, Math.min(1, predictedScore));

    const recommendedModel = this.getRecommendedModel(features);

    return {
      predictedScore,
      recommendedModel,
      reasoning: `Based on ${features.codeComplexity} complexity and ${features.domain} domain`,
    };
  }

  recordOutcome(model: string, domain: string, score: number): void {
    this.outcomes.push({ model, domain, score });
  }

  getModelRanking(domain: string): Array<{ model: string; score: number }> {
    const domainOutcomes = this.outcomes.filter(o => o.domain === domain);

    const modelScores = new Map<string, number[]>();
    for (const outcome of domainOutcomes) {
      const scores = modelScores.get(outcome.model) || [];
      scores.push(outcome.score);
      modelScores.set(outcome.model, scores);
    }

    const rankings = Array.from(modelScores.entries())
      .map(([model, scores]) => ({
        model,
        score: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.score - a.score);

    return rankings;
  }

  getRecommendedModel(features: RoutingFeatures): string {
    const ranking = this.getModelRanking(features.domain);

    if (ranking.length > 0) {
      return ranking[0].model;
    }

    // Default recommendation based on tier
    return features.modelTier === 'local' ? 'local' : 'cloud';
  }
}
