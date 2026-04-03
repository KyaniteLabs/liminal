/**
 * ModelRouter - Thompson Sampling Multi-Armed Bandit for intelligent model routing
 *
 * Routes LLM requests using Thompson Sampling to balance exploration vs exploitation:
 * - Each model is an "arm" with a Beta distribution (α, β)
 * - Sample from each arm's distribution
 * - Select model with highest sample
 * - Update distribution based on outcome
 *
 * Also supports legacy modes: cascade, speculative, ensemble, specialized
 */

import type { LLMClientLike } from './SemanticExtractor.js';
import type { MultiModelConfig } from '../config/ConfigLoader.js';
import { formatError } from '../utils/errors.js';
import { Logger } from '../utils/Logger.js';

/** Task classification for routing decisions */
export type TaskType =
  | 'extraction'      // Semantic extraction (fast)
  | 'shredding'       // Content shredding (fast)
  | 'collision'       // Collision detection (powerful)
  | 'scoring'         // Fragment scoring (fast)
  | 'soup'            // Soup generation (powerful)
  | 'general';        // Default tasks

/** Task descriptor for routing */
export interface Task {
  type: TaskType;
  systemPrompt: string;
  userPrompt: string;
  complexity?: 'simple' | 'medium' | 'complex';
  priority?: 'low' | 'normal' | 'high';
  signal?: AbortSignal;
  /** Domain for context-aware routing */
  domain?: string;
}

/** Model response with metadata */
export interface ModelResponse {
  code: string;
  success: boolean;
  error?: string;
  /** Which model generated this response */
  model: 'primary' | 'secondary' | 'ensemble';
  /** Confidence score (0-1) if available */
  confidence?: number;
  /** Time taken to generate */
  latencyMs?: number;
  /** Quality score (0-1) for bandit updates */
  qualityScore?: number;
}

/** Internal model wrapper for tracking */
interface ModelWrapper {
  client: LLMClientLike;
  name: 'primary' | 'secondary';
}

/** Performance record for a model */
export interface ModelPerformanceRecord {
  model: 'primary' | 'secondary';
  domain: string;
  prompt: string;
  score: number;
  timestamp: number;
}

/** Beta distribution parameters for Thompson Sampling */
export interface BetaDistribution {
  alpha: number;  // Successes + 1
  beta: number;   // Failures + 1
}

/** Bandit state for a model */
export interface BanditArm {
  model: 'primary' | 'secondary';
  distribution: BetaDistribution;
  totalPulls: number;
  totalReward: number;
}

/** Thompson Sampling configuration */
export interface ThompsonConfig {
  /** Minimum pulls before trusting the bandit (exploration phase) */
  minExplorationPulls: number;
  /** When true, forces exploration regardless of current distribution */
  explorationMode: boolean;
  /** Score threshold for considering a generation successful */
  successThreshold: number;
  /** Maximum history to keep per model */
  maxHistoryPerModel: number;
}

/**
 * Sample from Beta distribution using the ratio-of-uniforms method
 * Beta(α, β) where α > 0, β > 0
 */
export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    return 0.5; // Uniform fallback for invalid parameters
  }

  // For integer parameters, use gamma sampling approach
  // Beta(α, β) = X / (X + Y) where X ~ Gamma(α, 1), Y ~ Gamma(β, 1)
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  
  return x / (x + y);
}

/**
 * Sample from Gamma distribution using Marsaglia-Tsang method
 * Gamma(shape, scale) where shape >= 1
 */
function sampleGamma(shape: number, scale: number): number {
  if (shape < 1) {
    // Use transformation for shape < 1
    const u = Math.random();
    return sampleGamma(1 + shape, scale) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  
  for (;;) {
    const x = sampleNormal();
    let v = 1 + c * x;
    
    if (v <= 0) continue;
    
    v = v * v * v;
    const u = Math.random();
    
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }
    
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Sample from standard normal distribution using Box-Muller
 */
function sampleNormal(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * ModelRouter implements Thompson Sampling for intelligent model selection
 */
export class ModelRouter implements LLMClientLike {
  private primary: ModelWrapper;
  private secondary?: ModelWrapper;
  private config: MultiModelConfig['routing'];
  private thompsonConfig: ThompsonConfig;
  
  // Bandit state
  private arms: Map<'primary' | 'secondary', BanditArm>;
  private performanceHistory: ModelPerformanceRecord[];
  
  // Stagnation detection
  private recentScores: number[];
  private stagnationWindowSize: number;
  private stagnationThreshold: number;

  constructor(
    primaryClient: LLMClientLike,
    secondaryClient: LLMClientLike | undefined,
    config: MultiModelConfig
  ) {
    this.primary = { client: primaryClient, name: 'primary' };
    this.secondary = secondaryClient ? { client: secondaryClient, name: 'secondary' } : undefined;
    this.config = config.routing;
    
    // Initialize Thompson Sampling configuration
    this.thompsonConfig = {
      minExplorationPulls: 10,
      explorationMode: false,
      successThreshold: 0.7,
      maxHistoryPerModel: 100,
    };
    
    // Initialize bandit arms with uniform priors (Beta(1, 1))
    this.arms = new Map();
    this.arms.set('primary', {
      model: 'primary',
      distribution: { alpha: 1, beta: 1 },
      totalPulls: 0,
      totalReward: 0,
    });
    
    if (this.secondary) {
      this.arms.set('secondary', {
        model: 'secondary',
        distribution: { alpha: 1, beta: 1 },
        totalPulls: 0,
        totalReward: 0,
      });
    }
    
    this.performanceHistory = [];
    this.recentScores = [];
    this.stagnationWindowSize = 20;
    this.stagnationThreshold = 0.05;
  }

  /**
   * Main routing entry point - dispatches based on routing mode
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<ModelResponse> {
    const task: Task = {
      type: 'general',
      systemPrompt,
      userPrompt,
      signal,
    };

    return await this.route(task);
  }

  /**
   * Route task to appropriate model(s) based on routing mode
   */
  async route(task: Task): Promise<ModelResponse> {
    switch (this.config.mode) {
      case 'cascade':
        return await this.cascadeRoute(task);
      case 'speculative':
        return await this.speculativeDecode(task);
      case 'ensemble':
        return await this.ensembleGenerate(task);
      case 'specialized':
        return await this.specializedRoute(task);
      case 'thompson':
        return await this.thompsonRoute(task);
      default:
        return await this.thompsonRoute(task);
    }
  }

  /**
   * Thompson Sampling routing: Select model using Beta distributions
   */
  private async thompsonRoute(task: Task): Promise<ModelResponse> {
    const startTime = Date.now();
    const domain = task.domain || 'general';
    
    // Select model using Thompson Sampling
    const selectedModel = this.selectModelThompson();
    const model = selectedModel === 'primary' ? this.primary : this.secondary;
    
    if (!model) {
      // Fallback to primary if secondary not available
      const result = await this.callModel(this.primary, task.systemPrompt, task.userPrompt, task.signal);
      const response: ModelResponse = {
        ...result,
        model: 'primary',
        latencyMs: Date.now() - startTime,
      };
      this.updateAfterGeneration('primary', domain, task.userPrompt, response);
      return response;
    }
    
    Logger.info('ModelRouter', `Thompson Sampling selected: ${selectedModel}`);
    
    // Call selected model
    const result = await this.callModel(model, task.systemPrompt, task.userPrompt, task.signal);
    const response: ModelResponse = {
      ...result,
      model: selectedModel,
      latencyMs: Date.now() - startTime,
    };
    
    // Update bandit with outcome
    this.updateAfterGeneration(selectedModel, domain, task.userPrompt, response);
    
    return response;
  }

  /**
   * Select model using Thompson Sampling
   * Sample from each arm's Beta distribution and pick the highest
   */
  private selectModelThompson(): 'primary' | 'secondary' {
    // If exploration mode is forced, use round-robin
    if (this.thompsonConfig.explorationMode) {
      const primaryPulls = this.arms.get('primary')?.totalPulls || 0;
      const secondaryPulls = this.arms.get('secondary')?.totalPulls || 0;
      
      if (this.secondary && secondaryPulls < primaryPulls) {
        return 'secondary';
      }
      return 'primary';
    }
    
    // If no secondary model, always use primary
    if (!this.secondary) {
      return 'primary';
    }
    
    // During initial exploration, ensure both models get minimum pulls
    const primaryArm = this.arms.get('primary')!;
    const secondaryArm = this.arms.get('secondary')!;
    
    if (primaryArm.totalPulls < this.thompsonConfig.minExplorationPulls) {
      return 'primary';
    }
    if (secondaryArm.totalPulls < this.thompsonConfig.minExplorationPulls) {
      return 'secondary';
    }
    
    // Thompson Sampling: Sample from Beta distributions
    const primarySample = sampleBeta(primaryArm.distribution.alpha, primaryArm.distribution.beta);
    const secondarySample = sampleBeta(secondaryArm.distribution.alpha, secondaryArm.distribution.beta);
    
    Logger.debug('ModelRouter', `Thompson samples - primary: ${primarySample.toFixed(4)}, secondary: ${secondarySample.toFixed(4)}`);
    
    return primarySample >= secondarySample ? 'primary' : 'secondary';
  }

  /**
   * Update bandit state after a generation
   */
  private updateAfterGeneration(
    model: 'primary' | 'secondary',
    domain: string,
    prompt: string,
    response: ModelResponse
  ): void {
    // Calculate quality score (0-1)
    const qualityScore = this.calculateQualityScore(response);
    response.qualityScore = qualityScore;
    
    // Record performance
    const record: ModelPerformanceRecord = {
      model,
      domain,
      prompt: prompt.slice(0, 200), // Truncate for storage
      score: qualityScore,
      timestamp: Date.now(),
    };
    
    this.performanceHistory.push(record);
    this.trimHistory();
    
    // Update Beta distribution
    const arm = this.arms.get(model);
    if (arm) {
      arm.totalPulls++;
      arm.totalReward += qualityScore;
      
      // Update Beta(α, β): α = successes + 1, β = failures + 1
      // We treat qualityScore >= threshold as success
      if (qualityScore >= this.thompsonConfig.successThreshold) {
        arm.distribution.alpha += 1;
      } else {
        arm.distribution.beta += 1;
      }
      
      Logger.debug('ModelRouter', `Updated ${model} arm: α=${arm.distribution.alpha}, β=${arm.distribution.beta}`);
    }
    
    // Track for stagnation detection
    this.recentScores.push(qualityScore);
    if (this.recentScores.length > this.stagnationWindowSize) {
      this.recentScores.shift();
    }
    
    // Check for stagnation
    this.detectStagnation();
  }

  /**
   * Calculate quality score from response (0-1)
   */
  private calculateQualityScore(response: ModelResponse): number {
    let score = 0;
    
    // Success factor (70% weight)
    if (response.success) {
      score += 0.7;
    }
    
    // Code quality factor (30% weight) - based on code length and structure
    if (response.code && response.code.length > 0) {
      const codeLength = response.code.length;
      const hasStructure = response.code.includes('function') || 
                          response.code.includes('class') ||
                          response.code.includes('const') ||
                          response.code.includes('let') ||
                          response.code.includes('var');
      
      // Length score (0-0.15): optimal between 100-2000 chars
      const lengthScore = codeLength > 50 && codeLength < 5000 ? 0.15 : 0.05;
      
      // Structure score (0-0.15)
      const structureScore = hasStructure ? 0.15 : 0;
      
      score += lengthScore + structureScore;
    }
    
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Detect stagnation in performance and trigger exploration mode
   */
  private detectStagnation(): void {
    if (this.recentScores.length < this.stagnationWindowSize) {
      return;
    }
    
    // Calculate variance of recent scores
    const mean = this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length;
    const variance = this.recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / this.recentScores.length;
    const stdDev = Math.sqrt(variance);
    
    // If variance is very low, we're stagnating
    const isStagnating = stdDev < this.stagnationThreshold;
    
    if (isStagnating && !this.thompsonConfig.explorationMode) {
      Logger.info('ModelRouter', `Stagnation detected (stdDev: ${stdDev.toFixed(4)}), enabling exploration mode`);
      this.thompsonConfig.explorationMode = true;
      
      // Reset exploration mode after a cooldown
      setTimeout(() => {
        this.thompsonConfig.explorationMode = false;
        Logger.info('ModelRouter', 'Exploration mode disabled');
      }, 60000); // 1 minute cooldown
    }
  }

  /**
   * Trim history to max size per model
   */
  private trimHistory(): void {
    const maxTotal = this.thompsonConfig.maxHistoryPerModel * 2; // Both models
    
    if (this.performanceHistory.length > maxTotal) {
      // Sort by timestamp and keep most recent
      this.performanceHistory.sort((a, b) => b.timestamp - a.timestamp);
      this.performanceHistory = this.performanceHistory.slice(0, maxTotal);
    }
  }

  /**
   * Cascade routing: Try primary (fast) model first, escalate to secondary on failure/low confidence
   */
  private async cascadeRoute(task: Task): Promise<ModelResponse> {
    const startTime = Date.now();

    // Try primary model first
    const primaryResult = await this.callModel(this.primary, task.systemPrompt, task.userPrompt, task.signal);

    // Escalate to secondary if:
    // 1. Primary failed
    // 2. Primary returned low confidence (if available)
    // 3. Task is complex/high priority
    const shouldEscalate =
      !primaryResult.success ||
      (primaryResult.confidence !== undefined && primaryResult.confidence < (this.config.confidenceThreshold ?? 0.8)) ||
      task.complexity === 'complex' ||
      task.priority === 'high';

    if (shouldEscalate && this.secondary) {
      Logger.info('ModelRouter', `Escalating to secondary model (reason: ${!primaryResult.success ? 'failure' : 'low confidence/complexity'})`);
      const secondaryResult = await this.callModel(this.secondary, task.systemPrompt, task.userPrompt, task.signal);
      return {
        ...secondaryResult,
        model: 'secondary',
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      ...primaryResult,
      model: 'primary',
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Speculative decoding: Primary drafts, secondary verifies (future enhancement)
   * Currently falls back to cascade as speculative requires tokenizer compatibility
   */
  private async speculativeDecode(task: Task): Promise<ModelResponse> {
    // TODO: Implement true speculative decoding once we verify tokenizer compatibility
    // For now, fall back to cascade routing
    Logger.info('ModelRouter', 'Speculative decoding not yet implemented, using cascade');
    return await this.cascadeRoute(task);
  }

  /**
   * Ensemble: Both models generate independently, compare results
   */
  private async ensembleGenerate(task: Task): Promise<ModelResponse> {
    if (!this.secondary) {
      return await this.cascadeRoute(task);
    }

    const startTime = Date.now();

    // Run both models in parallel
    const [primaryResult, secondaryResult] = await Promise.all([
      this.callModel(this.primary, task.systemPrompt, task.userPrompt, task.signal),
      this.callModel(this.secondary, task.systemPrompt, task.userPrompt, task.signal),
    ]);

    // If both succeeded, compare and use secondary (more powerful) for consensus
    if (primaryResult.success && secondaryResult.success) {
      const similarity = this.calculateSimilarity(primaryResult.code, secondaryResult.code);

      if (similarity > 0.8) {
        // High agreement - use primary result (faster)
        Logger.info('ModelRouter', `Ensemble: high agreement (${similarity.toFixed(2)}), using primary`);
        return {
          ...primaryResult,
          model: 'ensemble',
          confidence: similarity,
          latencyMs: Date.now() - startTime,
        };
      } else {
        // Low agreement - use secondary (more powerful/reliable)
        Logger.info('ModelRouter', `Ensemble: low agreement (${similarity.toFixed(2)}), using secondary`);
        return {
          ...secondaryResult,
          model: 'ensemble',
          confidence: similarity,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // If one failed, use the successful one
    if (secondaryResult.success) {
      return { ...secondaryResult, model: 'ensemble', latencyMs: Date.now() - startTime };
    }
    return { ...primaryResult, model: 'ensemble', latencyMs: Date.now() - startTime };
  }

  /**
   * Specialized routing: Route based on task type
   */
  private async specializedRoute(task: Task): Promise<ModelResponse> {
    const startTime = Date.now();

    // Determine which model should handle this task type
    const useSecondary = this.shouldUseSecondaryForTask(task);

    const model = useSecondary ? this.secondary : this.primary;
    if (!model) {
      // Fallback to primary if secondary not available
      const result = await this.callModel(this.primary, task.systemPrompt, task.userPrompt, task.signal);
      return { ...result, model: 'primary', latencyMs: Date.now() - startTime };
    }

    const result = await this.callModel(model, task.systemPrompt, task.userPrompt, task.signal);
    return { ...result, model: model.name, latencyMs: Date.now() - startTime };
  }

  /**
   * Determine if a task should use the secondary model based on task type
   */
  private shouldUseSecondaryForTask(task: Task): boolean {
    if (!this.secondary) return false;

    // Task types that benefit from powerful model
    const powerfulTasks: TaskType[] = ['collision', 'soup'];
    // Task types that work well with fast model
    const fastTasks: TaskType[] = ['extraction', 'shredding', 'scoring'];

    if (powerfulTasks.includes(task.type)) return true;
    if (fastTasks.includes(task.type)) return false;

    // For general tasks, use complexity/priority heuristics
    return task.complexity === 'complex' || task.priority === 'high';
  }

  /**
   * Call a specific model and normalize the response
   */
  private async callModel(
    model: ModelWrapper,
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal
  ): Promise<Omit<ModelResponse, 'model' | 'latencyMs'>> {
    try {
      const result = await model.client.generate(systemPrompt, userPrompt, signal);
      return {
        code: result.code,
        success: result.success,
        error: undefined,
      };
    } catch (error) {
      return {
        code: '',
        success: false,
        error: formatError('ModelRouter', error),
      };
    }
  }

  /**
   * Calculate similarity between two texts (simple word overlap)
   * TODO: Replace with more sophisticated semantic similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    const intersection = new Set(words1Array.filter(x => words2.has(x)));
    const union = new Set(words1Array.concat(words2Array));

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get routing statistics (for monitoring/debugging)
   */
  getStats() {
    const armStats: Record<string, { alpha: number; beta: number; pulls: number; reward: number }> = {};
    
    for (const [name, arm] of this.arms) {
      armStats[name] = {
        alpha: arm.distribution.alpha,
        beta: arm.distribution.beta,
        pulls: arm.totalPulls,
        reward: arm.totalReward,
      };
    }
    
    return {
      mode: this.config.mode,
      confidenceThreshold: this.config.confidenceThreshold,
      hasSecondary: !!this.secondary,
      thompson: {
        arms: armStats,
        explorationMode: this.thompsonConfig.explorationMode,
        historySize: this.performanceHistory.length,
      },
    };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): ModelPerformanceRecord[] {
    return [...this.performanceHistory];
  }

  /**
   * Get bandit arm state
   */
  getArms(): Map<'primary' | 'secondary', BanditArm> {
    const result = new Map<'primary' | 'secondary', BanditArm>();
    this.arms.forEach((value, key) => {
      result.set(key, value);
    });
    return result;
  }

  /**
   * Enable exploration mode manually
   */
  enableExplorationMode(): void {
    this.thompsonConfig.explorationMode = true;
    Logger.info('ModelRouter', 'Exploration mode enabled manually');
  }

  /**
   * Disable exploration mode
   */
  disableExplorationMode(): void {
    this.thompsonConfig.explorationMode = false;
    Logger.info('ModelRouter', 'Exploration mode disabled manually');
  }

  /**
   * Reset bandit state (for testing)
   */
  resetBandit(): void {
    this.arms.set('primary', {
      model: 'primary',
      distribution: { alpha: 1, beta: 1 },
      totalPulls: 0,
      totalReward: 0,
    });
    
    if (this.secondary) {
      this.arms.set('secondary', {
        model: 'secondary',
        distribution: { alpha: 1, beta: 1 },
        totalPulls: 0,
        totalReward: 0,
      });
    }
    
    this.performanceHistory = [];
    this.recentScores = [];
    this.thompsonConfig.explorationMode = false;
  }
}
