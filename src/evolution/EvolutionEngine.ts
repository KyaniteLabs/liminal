export interface EvolutionDelta {
  /** Adjust generator temperature by this amount (clamped by tunables) */
  temperatureAdjustment?: number;
  /** Adjust maxTokens by this amount (clamped by tunables) */
  maxTokensAdjustment?: number;
  /** Prompt prefix to inject */
  promptPrefix?: string;
  /** Prompt suffix to inject */
  promptSuffix?: string;
  /** Adjust minQualityScore by this amount */
  minQualityScoreAdjustment?: number;
}

export interface EvolutionProposal {
  type: 'prompt' | 'role' | 'policy';
  description: string;
  delta: EvolutionDelta;
}

export interface EvolutionEngineOptions {
  /** Recent iteration scores */
  recentScores?: number[];
  /** Current loop settings */
  currentPolicy?: {
    minQualityScore?: number;
    maxIterations?: number;
  };
  /** Role config tunables */
  tunables?: {
    temperatureRange?: { min: number; max: number };
    maxTokensRange?: { min: number; max: number };
    mutationRate?: number;
  };
}

export class EvolutionEngine {
  private recentScores: number[];
  private currentPolicy: EvolutionEngineOptions['currentPolicy'];
  private tunables: EvolutionEngineOptions['tunables'];

  constructor(options?: EvolutionEngineOptions) {
    this.recentScores = options?.recentScores ?? [];
    this.currentPolicy = options?.currentPolicy ?? {};
    this.tunables = options?.tunables ?? {};
  }

  /**
   * Propose a single bounded delta based on recent performance.
   * Returns null when no proposal is warranted.
   */
  propose(): EvolutionProposal | null {
    // currentPolicy is stored for future evaluator integration
    void this.currentPolicy;

    const rate = this.tunables?.mutationRate ?? 0.1;
    if (Math.random() > rate) return null;

    // Simple heuristic: if recent scores are declining or flat, propose a change
    const avgScore = this.recentScores.length > 0
      ? this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length
      : 0.5;

    const types: EvolutionProposal['type'][] = ['prompt', 'role', 'policy'];
    const type = types[Math.floor(Math.random() * types.length)];

    switch (type) {
      case 'prompt':
        return {
          type: 'prompt',
          description: 'Inject exploratory creative direction',
          delta: {
            promptPrefix: avgScore < 0.6 ? 'Try a radically different approach. ' : undefined,
            promptSuffix: avgScore >= 0.6 ? ' Refine and polish this direction.' : undefined,
          },
        };
      case 'role':
        return {
          type: 'role',
          description: 'Adjust generation temperature for exploration/exploitation',
          delta: {
            temperatureAdjustment: avgScore < 0.5 ? 0.1 : -0.05,
          },
        };
      case 'policy':
        return {
          type: 'policy',
          description: 'Tweak quality threshold based on recent performance',
          delta: {
            minQualityScoreAdjustment: avgScore < 0.4 ? -0.05 : avgScore > 0.8 ? 0.02 : 0,
          },
        };
      default:
        return null;
    }
  }

  /**
   * Clamp a proposed delta to safe bounds.
   */
  clamp(delta: EvolutionDelta): EvolutionDelta {
    const clamped: EvolutionDelta = { ...delta };
    if (this.tunables?.temperatureRange && clamped.temperatureAdjustment !== undefined) {
      // The loop will apply this to the current temperature; we just bound the magnitude here
      clamped.temperatureAdjustment = Math.max(-0.2, Math.min(0.2, clamped.temperatureAdjustment));
    }
    if (this.tunables?.maxTokensRange && clamped.maxTokensAdjustment !== undefined) {
      clamped.maxTokensAdjustment = Math.max(-512, Math.min(512, clamped.maxTokensAdjustment));
    }
    if (clamped.minQualityScoreAdjustment !== undefined) {
      clamped.minQualityScoreAdjustment = Math.max(-0.1, Math.min(0.1, clamped.minQualityScoreAdjustment));
    }
    return clamped;
  }
}
