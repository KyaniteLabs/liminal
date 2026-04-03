/**
 * ModelRouter - Dual-model routing for cascade, speculative, and ensemble patterns
 *
 * Routes LLM requests to appropriate models based on:
 * - Cascade routing: Try fast model first, escalate on low confidence
 * - Speculative decoding: Fast model drafts, powerful model verifies
 * - Ensemble verification: Both models generate, compare results
 * - Specialization: Route based on task type
 */

import type { LLMClientLike } from './SemanticExtractor.js';
import type { MultiModelConfig } from '../config/ConfigLoader.js';

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
}

/** Internal model wrapper for tracking */
interface ModelWrapper {
  client: LLMClientLike;
  name: 'primary' | 'secondary';
}

/**
 * ModelRouter implements intelligent routing between fast and powerful models
 */
export class ModelRouter implements LLMClientLike {
  private primary: ModelWrapper;
  private secondary?: ModelWrapper;
  private config: MultiModelConfig['routing'];

  constructor(
    primaryClient: LLMClientLike,
    secondaryClient: LLMClientLike | undefined,
    config: MultiModelConfig
  ) {
    this.primary = { client: primaryClient, name: 'primary' };
    this.secondary = secondaryClient ? { client: secondaryClient, name: 'secondary' } : undefined;
    this.config = config.routing;
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
      default:
        return await this.cascadeRoute(task);
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
      console.log(`[ModelRouter] Escalating to secondary model (reason: ${!primaryResult.success ? 'failure' : 'low confidence/complexity'})`);
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
    console.log('[ModelRouter] Speculative decoding not yet implemented, using cascade');
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
        console.log(`[ModelRouter] Ensemble: high agreement (${similarity.toFixed(2)}), using primary`);
        return {
          ...primaryResult,
          model: 'ensemble',
          confidence: similarity,
          latencyMs: Date.now() - startTime,
        };
      } else {
        // Low agreement - use secondary (more powerful/reliable)
        console.log(`[ModelRouter] Ensemble: low agreement (${similarity.toFixed(2)}), using secondary`);
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

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get routing statistics (for monitoring/debugging)
   */
  getStats() {
    return {
      mode: this.config.mode,
      confidenceThreshold: this.config.confidenceThreshold,
      hasSecondary: !!this.secondary,
    };
  }
}
