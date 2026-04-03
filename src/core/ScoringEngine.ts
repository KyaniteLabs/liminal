/**
 * ScoringEngine — pluggable, normalized scoring for creative output.
 *
 * All strategies output 0-1 scores on the same dimensions. Register
 * custom strategies or use the built-in ones: comprehensive, fast, keyword,
 * creative, aesthetic, fitness.
 *
 * Consolidated as part of Fix 8: Consolidate Triple Redundancy.
 * CreativeEvaluator and AestheticCritic are now available as scoring strategies.
 */

import { CreativeEvaluator } from './CreativeEvaluator.js';
import { AestheticCritic } from '../aesthetic/AestheticCritic.js';
import { HeuristicScorer } from '../swarm/HeuristicScorer.js';
import { quickScore } from '../collab/Scoring.js';
import { Domain } from '../types/domains.js';
import type { SwarmPersona } from '../swarm/types.js';
import type { DesignConstraints, CriticConfig, LIREvaluationContext } from '../aesthetic/types.js';
import { LLMClient } from '../llm/LLMClient.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Legacy evaluation strategy names (backward-compatible with EvaluationFramework). */
export type EvaluationStrategy = 'detailed' | 'fast' | 'heuristic' | 'fitness' | 'comprehensive' | 'keyword' | 'creative' | 'aesthetic' | 'llm';

/** Legacy evaluation result shape (backward-compatible with EvaluationFramework). */
export type EvaluationResult = ScoringResult;

/** Legacy evaluation context shape (backward-compatible with EvaluationFramework). */
export interface EvaluationContext {
  prompt?: string;
  domain?: Domain;
  criteria?: string[];
  previousOutputs?: string[];
  persona?: SwarmPersona;
  dimensionScores?: Record<string, number | undefined>;
  weights?: Record<string, number | undefined>;
  /** Design constraints for aesthetic evaluation. */
  designConstraints?: DesignConstraints;
  /** Critic configuration for aesthetic evaluation. */
  criticConfig?: Partial<CriticConfig>;
  /** LIR context for LIR-aware evaluation. */
  lirContext?: LIREvaluationContext;
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
  domain?: Domain;
  /** Original prompt / constraint text. */
  prompt?: string;
  /** Previous outputs for novelty calculation. */
  previousOutputs?: string[];
  /** Persona context (swarm). */
  persona?: SwarmPersona;
  /** Evaluation criteria dimensions. */
  criteria?: string[];
  /** Optional LIR context for LIR-aware evaluation strategies. */
  lirContext?: LIREvaluationContext;
  /** Design constraints for aesthetic evaluation. */
  designConstraints?: DesignConstraints;
  /** Critic configuration for aesthetic evaluation. */
  criticConfig?: Partial<CriticConfig>;
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
  /** Optional aesthetic violations (from aesthetic strategy). */
  violations?: Array<{ rule: string; severity: 'error' | 'warning' | 'info'; message: string }>;
  /** Optional report details (from creative/aesthetic strategies). */
  report?: unknown;
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
    const raw = quickScore(input.output, input.domain ?? Domain.EMPTY);
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

/** Creative strategy — wraps CreativeEvaluator for detailed creative assessment. */
class CreativeStrategy implements ScoringStrategy {
  name = 'creative';

  score(input: ScoringInput): ScoringResult {
    const result = CreativeEvaluator.assess(input.output, {
      evaluationCriteria: ['creative', 'technical', 'novelty', 'emergence', 'interestingness'],
      domain: input.domain,
    });

    const dimensions: Partial<Record<ScoreDimension, number>> = {
      creative: result.creativeScore,
      technical: result.technicalScore,
    };
    if (result.noveltyScore !== undefined) dimensions.novelty = result.noveltyScore;
    if (result.emergenceScore !== undefined) dimensions.emergence = result.emergenceScore;
    if (result.interestingnessScore !== undefined) dimensions.interestingness = result.interestingnessScore;

    return {
      score: result.score,
      dimensions,
      issues: result.issues,
      strategy: this.name,
      report: {
        metrics: result.metrics,
        improvementTrajectory: (result as unknown as { improvementTrajectory?: number[] }).improvementTrajectory,
      },
    };
  }
}

/** Aesthetic strategy — wraps AestheticCritic for design-focused assessment. */
class AestheticStrategy implements ScoringStrategy {
  name = 'aesthetic';
  private critic = new AestheticCritic();

  score(input: ScoringInput): ScoringResult {
    const report = this.critic.critique(
      input.output,
      input.criticConfig,
      input.lirContext
    );

    // Map aesthetic dimensions
    const dimensions: Partial<Record<ScoreDimension, number>> = {
      aesthetic: report.score,
    };

    return {
      score: report.score,
      dimensions,
      strategy: this.name,
      violations: report.violations,
      report: {
        passed: report.passed,
        timestamp: report.timestamp,
        ...(report as unknown as Record<string, unknown>),
      },
    };
  }
}

/** Extended input shape for the fitness strategy. */
export interface FitnessInput extends ScoringInput {
  dimensionScores?: Record<string, number | undefined>;
  weights?: Record<string, number | undefined>;
}

/** LLM strategy — uses an LLM to evaluate creative output quality. */
export class LLMScoringStrategy implements ScoringStrategy {
  name = 'llm';
  private llm: LLMClient;

  constructor(llm?: LLMClient) {
    this.llm = llm ?? new LLMClient({ role: 'evaluator' });
  }

  async score(input: ScoringInput): Promise<ScoringResult> {
    const criteria = input.criteria?.join(', ') ?? 'technical quality, creativity, novelty';
    const systemPrompt = `You are an expert creative artifact evaluator. Score the artifact against the given criteria.
Return ONLY a JSON object with this exact structure:
{
  "score": <number 0-1>,
  "technical": <number 0-1>,
  "creative": <number 0-1>,
  "novelty": <number 0-1>,
  "reasoning": "<brief explanation>",
  "suggestions": ["<suggestion1>", ...]
}`;

    const userPrompt = `Criteria: ${criteria}\nDomain: ${input.domain ?? 'general'}\n${input.prompt ? `Prompt: ${input.prompt}\n` : ''}Artifact:\n${input.output}`;

    try {
      const response = await this.llm.generate(systemPrompt, userPrompt);

      if (!response.success || !response.code) {
        return { score: 0.5, dimensions: {}, strategy: this.name, issues: ['LLM evaluation failed'] };
      }

      const jsonMatch = response.code.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { score: 0.5, dimensions: {}, strategy: this.name, issues: ['Could not parse LLM response'] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const dimensions: Partial<Record<ScoreDimension, number>> = {};
      if (typeof parsed.technical === 'number') dimensions.technical = Math.max(0, Math.min(1, parsed.technical));
      if (typeof parsed.creative === 'number') dimensions.creative = Math.max(0, Math.min(1, parsed.creative));
      if (typeof parsed.novelty === 'number') dimensions.novelty = Math.max(0, Math.min(1, parsed.novelty));

      return {
        score: Math.max(0, Math.min(1, typeof parsed.score === 'number' ? parsed.score : 0.5)),
        dimensions,
        strategy: this.name,
        issues: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        report: { reasoning: parsed.reasoning || '' },
      };
    } catch {
      return { score: 0.5, dimensions: {}, strategy: this.name, issues: ['LLM evaluation error'] };
    }
  }
}

// ---------------------------------------------------------------------------
// ScoringEngine
// ---------------------------------------------------------------------------

/**
 * ScoringEngine — THE scoring system for Liminal.
 *
 * Consolidated as part of Fix 8: Consolidate Triple Redundancy.
 * Now serves as a plugin host with Strategy pattern, supporting:
 * - comprehensive: Full assessment via CreativeEvaluator
 * - creative: Creative-focused assessment
 * - aesthetic: Design-focused assessment via AestheticCritic
 * - fast: Heuristic scoring
 * - keyword: Quick keyword-based scoring
 * - fitness: Weighted average of pre-computed scores
 */
export class ScoringEngine {
  private strategies = new Map<string, ScoringStrategy>();
  private defaultStrategyName: string;

  constructor(defaultStrategy: string = 'comprehensive', llm?: LLMClient) {
    // Register built-in strategies
    this.register(new ComprehensiveStrategy());
    this.register(new FastStrategy());
    this.register(new KeywordStrategy());
    this.register(new FitnessStrategy());

    // New strategies from consolidated systems
    this.register(new CreativeStrategy());
    this.register(new AestheticStrategy());

    // LLM-based evaluation strategy
    this.register(new LLMScoringStrategy(llm));

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
   * Check if the engine has a registered strategy.
   */
  hasStrategy(name: string): boolean {
    return this.strategies.has(name);
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

  /**
   * Score with creative focus.
   */
  async scoreCreative(input: string, domain?: Domain): Promise<ScoringResult> {
    return this.score({ output: input, domain }, 'creative');
  }

  /**
   * Score with aesthetic focus.
   */
  async scoreAesthetic(
    input: string,
    criticConfig?: Partial<CriticConfig>,
    lirContext?: LIREvaluationContext
  ): Promise<ScoringResult> {
    return this.score({ output: input, criticConfig, lirContext }, 'aesthetic');
  }

  /** Set the default strategy. */
  setDefault(name: string): void {
    if (!this.strategies.has(name)) {
      throw new Error(`Unknown scoring strategy: "${name}". Available: ${this.listStrategies().join(', ')}`);
    }
    this.defaultStrategyName = name;
  }

  /**
   * Get the default strategy name.
   */
  getDefault(): string {
    return this.defaultStrategyName;
  }
}
