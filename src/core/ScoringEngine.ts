/**
 * ScoringEngine — pluggable, normalized scoring for creative output.
 *
 * All strategies output 0-1 scores on the same dimensions. Register
 * custom strategies or use the built-in ones: comprehensive, fast, keyword.
 *
 * Built-in strategies: comprehensive, fast, keyword, fitness.
 * Legacy aliases: detailed→comprehensive, heuristic→fast, fast→keyword.
 */

import { CreativeEvaluator } from './CreativeEvaluator.js';
import { HeuristicScorer } from '../swarm/HeuristicScorer.js';
import { quickScore } from '../collab/Scoring.js';
import type { DomainType } from '../collab/types.js';
import type { SwarmPersona } from '../swarm/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Legacy evaluation strategy names (backward-compatible with EvaluationFramework). */
export type EvaluationStrategy = 'detailed' | 'fast' | 'heuristic' | 'fitness' | 'comprehensive' | 'keyword';

/** Legacy evaluation result shape (backward-compatible with EvaluationFramework). */
export type EvaluationResult = ScoringResult;

/** Legacy evaluation context shape (backward-compatible with EvaluationFramework). */
export interface EvaluationContext {
  prompt?: string;
  domain?: DomainType;
  criteria?: string[];
  previousOutputs?: string[];
  persona?: SwarmPersona;
  dimensionScores?: Record<string, number | undefined>;
  weights?: Record<string, number | undefined>;
}

/** Normalized dimension names shared across all strategies. */
export type ScoreDimension =
  | 'technical'
  | 'creative'
  | 'novelty'
  | 'aesthetic'
  | 'emergence'
  | 'interestingness'
  | 'constraint'
  | 'vocabulary'
  | 'codeStructure'
  | 'length';

/** Score input context — everything a strategy might need. */
export interface ScoringInput {
  /** The creative output to score. */
  output: string;
  /** Domain hint for domain-specific heuristics. */
  domain?: DomainType;
  /** Original prompt / constraint text. */
  prompt?: string;
  /** Previous outputs for novelty calculation. */
  previousOutputs?: string[];
  /** Persona context (swarm). */
  persona?: SwarmPersona;
  /** Evaluation criteria dimensions. */
  criteria?: string[];
  /** Optional LIR context for LIR-aware evaluation strategies. */
  lirContext?: import('../aesthetic/types.js').LIREvaluationContext;
}

/** Result from any scoring strategy. */
export interface ScoringResult {
  /** Overall score, always 0-1. */
  score: number;
  /** Per-dimension scores, all normalized 0-1. */
  dimensions: Partial<Record<ScoreDimension, number>>;
  /** Human-readable issues (from comprehensive strategy). */
  issues?: string[];
  /** The strategy name that produced this result. */
  strategy: string;
}

/** A scoring strategy plugin. */
export interface ScoringStrategy {
  /** Unique strategy name. */
  name: string;
  /**
   * Score the given input.
   * Must return a ScoringResult with score in [0, 1] and
   * dimension scores in [0, 1].
   */
  score(input: ScoringInput): ScoringResult | Promise<ScoringResult>;
}

// ---------------------------------------------------------------------------
// Built-in strategies
// ---------------------------------------------------------------------------

/** Comprehensive strategy — wraps CreativeEvaluator.assess(). */
class ComprehensiveStrategy implements ScoringStrategy {
  name = 'comprehensive';

  score(input: ScoringInput): ScoringResult {
    const result = CreativeEvaluator.assess(input.output, {
      evaluationCriteria: input.criteria,
      domain: input.domain,
    });

    const dimensions: Partial<Record<ScoreDimension, number>> = {
      technical: result.technicalScore,
      creative: result.creativeScore,
    };
    if (result.noveltyScore !== undefined) dimensions.novelty = result.noveltyScore;
    if (result.aestheticScore !== undefined) dimensions.aesthetic = result.aestheticScore;
    if (result.emergenceScore !== undefined) dimensions.emergence = result.emergenceScore;
    if (result.interestingnessScore !== undefined) dimensions.interestingness = result.interestingnessScore;

    return {
      score: result.score,
      dimensions,
      issues: result.issues,
      strategy: this.name,
    };
  }
}

/** Fast strategy — wraps HeuristicScorer.scoreOutput(). */
class FastStrategy implements ScoringStrategy {
  name = 'fast';

  score(input: ScoringInput): ScoringResult {
    const defaultPersona: SwarmPersona = {
      id: 'default',
      name: 'Default',
      displayName: 'Default',
      model: 'default',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'Evaluate creative code.',
      voice: 'neutral',
      thinkingStyle: 'balanced',
      votingBias: 'neutral',
      constraints: [],
      votingPower: 2,
    };

    const persona = input.persona ?? defaultPersona;
    const dims = HeuristicScorer.scoreOutput(
      input.output,
      persona,
      input.prompt ?? '',
      input.previousOutputs ?? [],
    );

    const weights = { constraint: 0.25, novelty: 0.20, length: 0.20, vocabulary: 0.20, codeStructure: 0.15 };
    const score =
      weights.constraint * dims.constraint +
      weights.novelty * dims.novelty +
      weights.length * dims.length +
      weights.vocabulary * dims.vocabulary +
      weights.codeStructure * dims.codeStructure;

    return {
      score,
      dimensions: {
        constraint: dims.constraint,
        novelty: dims.novelty,
        length: dims.length,
        vocabulary: dims.vocabulary,
        codeStructure: dims.codeStructure,
      },
      strategy: this.name,
    };
  }
}

/** Keyword strategy — wraps quickScore(). */
class KeywordStrategy implements ScoringStrategy {
  name = 'keyword';

  score(input: ScoringInput): ScoringResult {
    const raw = quickScore(input.output, input.domain ?? '');
    return {
      score: Math.max(0, Math.min(1, raw)),
      dimensions: {},
      strategy: this.name,
    };
  }
}

/** Fitness strategy — pure weighted-average of pre-computed dimension scores. */
class FitnessStrategy implements ScoringStrategy {
  name = 'fitness';

  score(input: ScoringInput): ScoringResult {
    const weights = (input as FitnessInput).weights ?? {};
    const scores = (input as FitnessInput).dimensionScores ?? {};
    const entries = Object.entries(scores).filter(([, val]) => val !== undefined) as [string, number][];

    let totalWeight = 0;
    let weightedSum = 0;
    for (const [dimension, score] of entries) {
      const weight = weights[dimension] ?? weights['default'] ?? 1;
      weightedSum += score * weight;
      totalWeight += weight;
    }
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    const details: Record<string, number> = {};
    for (const [key, value] of entries) {
      details[key] = value;
    }

    return { score, dimensions: details, strategy: this.name };
  }
}

/** Extended input shape for the fitness strategy. */
export interface FitnessInput extends ScoringInput {
  dimensionScores?: Record<string, number | undefined>;
  weights?: Record<string, number | undefined>;
}

// ---------------------------------------------------------------------------
// ScoringEngine
// ---------------------------------------------------------------------------

export class ScoringEngine {
  private strategies = new Map<string, ScoringStrategy>();
  private defaultStrategyName: string;

  constructor(defaultStrategy: string = 'comprehensive') {
    // Register built-in strategies
    this.register(new ComprehensiveStrategy());
    this.register(new FastStrategy());
    this.register(new KeywordStrategy());
    this.register(new FitnessStrategy());

    // Legacy aliases (backward-compatible names from EvaluationFramework)
    this.registerAlias('detailed', 'comprehensive');
    this.registerAlias('heuristic', 'fast');
    this.registerAlias('fast', 'keyword');

    this.defaultStrategyName = defaultStrategy;
  }

  /** Register an alias name that maps to an existing strategy. */
  private registerAlias(alias: string, targetName: string): void {
    const target = this.strategies.get(targetName);
    if (!target) return;
    this.strategies.set(alias, target);
  }

  /** Register a custom scoring strategy. */
  register(strategy: ScoringStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /** Unregister a strategy by name. */
  unregister(name: string): boolean {
    return this.strategies.delete(name);
  }

  /** Get a registered strategy by name. */
  getStrategy(name: string): ScoringStrategy | undefined {
    return this.strategies.get(name);
  }

  /** List all registered strategy names. */
  listStrategies(): string[] {
    return [...this.strategies.keys()];
  }

  /**
   * Score using a specific strategy.
   * Falls back to default if the named strategy is not found.
   */
  async score(input: ScoringInput, strategyName?: string): Promise<ScoringResult> {
    const name = strategyName ?? this.defaultStrategyName;
    const strategy = this.strategies.get(name);

    if (!strategy) {
      throw new Error(`Unknown scoring strategy: "${name}". Available: ${this.listStrategies().join(', ')}`);
    }

    const result = strategy.score(input);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Convenience: score a plain string with the default strategy.
   */
  async quick(input: string): Promise<number> {
    const result = await this.score({ output: input });
    return result.score;
  }

  /** Set the default strategy. */
  setDefault(name: string): void {
    if (!this.strategies.has(name)) {
      throw new Error(`Unknown scoring strategy: "${name}". Available: ${this.listStrategies().join(', ')}`);
    }
    this.defaultStrategyName = name;
  }
}
