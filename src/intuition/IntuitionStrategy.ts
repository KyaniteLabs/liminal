/**
 * * IntuitionStrategy — ScoringStrategy plugin for intuition-based quality signals.
 *
 * Plugs into ScoringEngine's strategy pattern (src/core/ScoringEngine.ts:101).
 * Adds a new scoring dimension 'intuition' that combines:
 *   - Prototype distance (how close to domain quality centroid)
 *   - Novelty prediction (how different from past outputs)
 *   - Aesthetic prediction (K-NN quality from behavior vectors)
 *
 * This is additive — existing strategies still run, this adds an extra signal.
 *
 * @module intuition/IntuitionStrategy
 */

import type { ScoringStrategy, ScoringInput, ScoringResult } from '../core/ScoringEngine.js';
import { ThompsonSampler } from './ThompsonSampler.js';
import { DomainPrototype } from './DomainPrototype.js';
import { IntuitionCache } from './IntuitionCache.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface IntuitionConfig {
  /** Minimum examples needed in prototype before intuition activates. Default: 3 */
  minPrototypeExamples?: number;
  /** Weight for prototype distance in combined score. Default: 0.4 */
  prototypeWeight?: number;
  /** Weight for novelty signal. Default: 0.3 */
  noveltyWeight?: number;
  /** Weight for Thompson confidence signal. Default: 0.3 */
  thompsonWeight?: number;
  /** Whether to include debug info in the result. Default: true */
  debug?: boolean;
}

const DEFAULT_INTUITION_CONFIG: Required<IntuitionConfig> = {
  minPrototypeExamples: 3,
  prototypeWeight: 0.4,
  noveltyWeight: 0.3,
  thompsonWeight: 0.3,
  debug: true,
};

// ---------------------------------------------------------------------------
// Intuition signals (for visible reasoning)
// ---------------------------------------------------------------------------

/** Individual intuition signal. */
export interface IntuitionSignal {
  /** Signal name */
  name: string;
  /** Signal value 0-1 */
  value: number;
  /** Human-readable explanation */
  reason: string;
}

/** Full intuition assessment. */
export interface IntuitionAssessment {
  /** Composite intuition score 0-1 */
  score: number;
  /** Confidence level 0-1 (how much data backs this) */
  confidence: number;
  /** Individual signals */
  signals: IntuitionSignal[];
  /** Thompson recommendation (if available) */
  recommendation?: string;
}

// ---------------------------------------------------------------------------
// IntuitionStrategy
// ---------------------------------------------------------------------------

/**
 * ScoringStrategy plugin that provides intuition-based quality signals.
 *
 * Usage:
 *   const strategy = new IntuitionStrategy(domainPrototype, modelSampler);
 *   scoringEngine.register(strategy);
 *
 * After registration, every score() call will include an 'intuition' dimension.
 */
export class IntuitionStrategy implements ScoringStrategy {
  readonly name = 'intuition';

  private readonly prototype: DomainPrototype;
  private readonly modelSampler: ThompsonSampler<string>;
  private readonly strategySampler: ThompsonSampler<string>;
  private readonly cache: IntuitionCache | null;
  private readonly config: Required<IntuitionConfig>;
  private lastAssessment: IntuitionAssessment | null = null;

  constructor(
    prototype: DomainPrototype,
    modelSampler: ThompsonSampler<string>,
    strategySampler: ThompsonSampler<string>,
    config?: IntuitionConfig,
    cache?: IntuitionCache,
  ) {
    this.prototype = prototype;
    this.modelSampler = modelSampler;
    this.strategySampler = strategySampler;
    this.config = { ...DEFAULT_INTUITION_CONFIG, ...config };
    this.cache = cache ?? null;
  }

  /**
   * Score input using intuition signals.
   * Implements ScoringStrategy.score().
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async score(input: ScoringInput): Promise<ScoringResult> {
    const domain = input.domain ?? 'p5';

    // Check cache first — avoid recomputing signals for seen outputs
    if (this.cache) {
      const cached = this.cache.get(domain, input.output);
      if (cached) {
        this.lastAssessment = cached;
        if (this.config.debug) {
          Logger.info('IntuitionStrategy', `Cache hit for ${domain} (score: ${cached.score.toFixed(3)})`);
        }
        return {
          score: cached.score,
          dimensions: {
            intuition: cached.score,
            novelty: cached.signals.find(s => s.name === 'novelty')?.value ?? 0.5,
          },
          strategy: this.name,
          issues: cached.signals.filter(s => s.value < 0.3).map(s => `Low ${s.name}: ${s.reason}`),
          report: {
            signals: cached.signals,
            recommendation: cached.recommendation ?? '',
            confidence: cached.confidence,
          },
        };
      }
    }

    const signals: IntuitionSignal[] = [];
    let totalScore = 0;
    let totalConfidence = 0;
    let confidenceDivisor = 0;

    // Signal 1: Prototype distance
    // How close is this output to the domain's quality centroid?
    // Requires embedding — we approximate using output length and patterns
    const prototypeScore = this.computePrototypeSignal(domain, input.output);
    const prototypeReady = this.prototype.isReady(domain, this.config.minPrototypeExamples);

    if (prototypeReady) {
      signals.push({
        name: 'prototype',
        value: prototypeScore,
        reason: `Domain prototype distance: ${prototypeScore.toFixed(3)} (${domain}, ${this.prototype.getCentroid(domain)?.exampleCount ?? 0} examples)`,
      });
      totalScore += prototypeScore * this.config.prototypeWeight;
      totalConfidence += 1;
      confidenceDivisor++;
    } else {
      signals.push({
        name: 'prototype',
        value: 0.5,
        reason: `Insufficient prototype data for ${domain} (need ${this.config.minPrototypeExamples})`,
      });
      totalScore += 0.5 * this.config.prototypeWeight;
      // Low confidence contribution
      totalConfidence += 0.3;
      confidenceDivisor++;
    }

    // Signal 2: Novelty (from previous outputs)
    // How different is this from what came before?
    const noveltyScore = this.computeNoveltySignal(input.output, input.previousOutputs ?? []);
    signals.push({
      name: 'novelty',
      value: noveltyScore,
      reason: noveltyScore > 0.6
        ? `High novelty (${noveltyScore.toFixed(3)}) — explores new territory`
        : `Low novelty (${noveltyScore.toFixed(3)}) — similar to past outputs`,
    });
    totalScore += noveltyScore * this.config.noveltyWeight;
    totalConfidence += noveltyScore > 0.3 ? 1 : 0.5;
    confidenceDivisor++;

    // Signal 3: Thompson confidence
    // How confident is the model sampler in its current selection?
    const thompsonScore = this.computeThompsonSignal(domain);
    signals.push({
      name: 'thompson_confidence',
      value: thompsonScore,
      reason: thompsonScore > 0.7
        ? `High Thompson confidence (${thompsonScore.toFixed(3)}) — model selection well-calibrated`
        : `Low Thompson confidence (${thompsonScore.toFixed(3)}) — still exploring`,
    });
    totalScore += thompsonScore * this.config.thompsonWeight;
    totalConfidence += this.modelSampler.isReady() ? 1 : 0.3;
    confidenceDivisor++;

    // Normalize composite score
    const score = Math.min(1, Math.max(0, totalScore));
    const confidence = confidenceDivisor > 0 ? totalConfidence / confidenceDivisor : 0;

    // Build recommendation string (visible reasoning)
    const recommendation = this.buildRecommendation(domain, signals);

    this.lastAssessment = { score, confidence, signals, recommendation };

    // Populate cache for future lookups
    if (this.cache) {
      this.cache.set(domain, input.output, this.lastAssessment);
    }

    if (this.config.debug) {
      Logger.info('IntuitionStrategy', `Intuition: ${score.toFixed(3)} (confidence: ${confidence.toFixed(3)}) for ${domain}`);
      Logger.debug('IntuitionStrategy', `Signals: ${signals.map(s => `${s.name}=${s.value.toFixed(3)}`).join(', ')}`);
    }

    return {
      score,
      dimensions: {
        intuition: score,
        novelty: noveltyScore,
      },
      strategy: this.name,
      issues: signals.filter(s => s.value < 0.3).map(s => `Low ${s.name}: ${s.reason}`),
      report: {
        signals,
        recommendation,
        confidence,
      },
    };
  }

  /**
   * Get the last assessment (for visible reasoning after generation).
   */
  getLastAssessment(): IntuitionAssessment | null {
    return this.lastAssessment;
  }

  /**
   * Get the model sampler for external use (model selection).
   */
  getModelSampler(): ThompsonSampler<string> {
    return this.modelSampler;
  }

  /**
   * Get the strategy sampler for external use (generation strategy selection).
   */
  getStrategySampler(): ThompsonSampler<string> {
    return this.strategySampler;
  }

  /**
   * Get the intuition cache (for external inspection or persistence).
   */
  getCache(): IntuitionCache | null {
    return this.cache;
  }

  // ---------------------------------------------------------------------------
  // Private: Signal computation
  // ---------------------------------------------------------------------------

  /**
   * Approximate prototype quality signal without embeddings.
   * Uses output characteristics as proxy: code complexity, technique diversity, structure.
   */
  private computePrototypeSignal(domain: string, output: string): number {
    const centroid = this.prototype.getCentroid(domain);
    if (!centroid) return 0.5;

    // Proxy for "quality" based on code characteristics
    const lineCount = output.split('\n').length;
    const hasComments = /\/\/.*creative|\/\/.*effect|\/\/.*animation/.test(output);
    const hasInteraction = /mouseX|mouseY|frameCount|keyIsPressed|millis/.test(output);
    const hasFunctions = /\bfunction\s+\w+/.test(output);
    const hasClasses = /\bclass\s+\w+/.test(output);
    const hasColor = /color\(|fill\(|stroke\(|background\(/.test(output);
    const hasLoop = /\bfor\s*\(|\bwhile\s*\(/.test(output);
    const techniqueCount = [hasComments, hasInteraction, hasFunctions, hasClasses, hasColor, hasLoop]
      .filter(Boolean).length;

    // Score: moderate length + diverse techniques = closer to prototype
    const lengthScore = Math.min(1, lineCount / 100); // Normalize to ~100 lines
    const techniqueScore = techniqueCount / 6;

    return 0.5 * lengthScore + 0.5 * techniqueScore;
  }

  /**
   * Compute novelty signal from previous outputs.
   * Uses Jaccard distance on token sets as a fast proxy.
   */
  private computeNoveltySignal(output: string, previousOutputs: string[]): number {
    if (previousOutputs.length === 0) return 1.0; // No history = max novelty

    const outputTokens = new Set(output.toLowerCase().split(/\s+/));
    let maxSimilarity = 0;

    for (const prev of previousOutputs.slice(-5)) { // Compare with last 5
      const prevTokens = new Set(prev.toLowerCase().split(/\s+/));
      const intersection = new Set([...outputTokens].filter(t => prevTokens.has(t)));
      const union = new Set([...outputTokens, ...prevTokens]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      maxSimilarity = Math.max(maxSimilarity, jaccard);
    }

    // Convert similarity to novelty (1 - similarity)
    return 1 - maxSimilarity;
  }

  /**
   * Compute Thompson confidence signal.
   * High when the sampler has converged; low during exploration.
   */
  private computeThompsonSignal(_domain: string): number {
    if (!this.modelSampler.isReady()) return 0.5;

    // Use the best arm's confidence
    const best = this.modelSampler.bestByMean();
    if (!best) return 0.5;

    return this.modelSampler.getConfidence(best);
  }

  /**
   * Build a human-readable recommendation string.
   */
  private buildRecommendation(domain: string, signals: IntuitionSignal[]): string {
    const parts: string[] = [`domain: ${domain}`];

    // Model recommendation
    const bestModel = this.modelSampler.bestByMean();
    if (bestModel) {
      const confidence = this.modelSampler.getConfidence(bestModel);
      const stats = this.modelSampler.getArmStats(bestModel);
      if (stats) {
        parts.push(`model: ${bestModel} (α=${stats.alpha}, β=${stats.beta}, confidence=${confidence.toFixed(2)})`);
      }
    }

    // Strategy recommendation
    const bestStrategy = this.strategySampler.bestByMean();
    if (bestStrategy) {
      parts.push(`strategy: ${bestStrategy}`);
    }

    // Signal summary
    const signalSummary = signals
      .map(s => `${s.name}=${s.value.toFixed(2)}`)
      .join(', ');
    parts.push(`intuition signals: ${signalSummary}`);

    return parts.join(' | ');
  }
}
