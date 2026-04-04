/**
 * Thompson Sampling Model Router
 *
 * Uses Bayesian bandit optimization to route generation tasks to models
 * based on historical performance. Balances exploration (trying new models)
 * with exploitation (using proven performers).
 *
 * Reward signal: ScoringEngine scores above SUCCESS_THRESHOLD = success.
 * Prior: Beta(1,1) = uniform (no assumptions about any model).
 */

/** Key = `${model}:${taskType}` */
type RoutingKey = string;

interface ModelStats {
  alpha: number; // successes + 1
  beta: number;  // failures + 1
  totalCalls: number;
  avgScore: number;
}

export interface RoutingOption {
  model: string;
  taskType: string;
}

export interface RoutingDecision {
  model: string;
  taskType: string;
  sampledValue: number;
  stats: ModelStats;
  alternatives: Array<{ model: string; sampledValue: number }>;
}

/** Score above this = success for Thompson Sampling update */
const SUCCESS_THRESHOLD = 0.7;

/** Prior parameters — Beta(1,1) is uniform */
const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;

export class ModelRouter {
  private stats = new Map<RoutingKey, ModelStats>();

  private static key(model: string, taskType: string): RoutingKey {
    return `${model}:${taskType}`;
  }

  private ensureStats(model: string, taskType: string): ModelStats {
    const key = ModelRouter.key(model, taskType);
    let s = this.stats.get(key);
    if (!s) {
      s = { alpha: PRIOR_ALPHA, beta: PRIOR_BETA, totalCalls: 0, avgScore: 0 };
      this.stats.set(key, s);
    }
    return s;
  }

  /**
   * Sample from Beta(alpha, beta) using the gamma distribution method.
   * Beta(a,b) = Gamma(a,1) / (Gamma(a,1) + Gamma(b,1))
   */
  private sampleBeta(alpha: number, beta: number): number {
    const x = gammaRandom(alpha, 1);
    const y = gammaRandom(beta, 1);
    return x / (x + y);
  }

  /**
   * Select the best model for a task using Thompson Sampling.
   * Samples from each model's Beta distribution, returns the highest.
   */
  select(options: RoutingOption[]): RoutingDecision {
    if (options.length === 0) throw new Error('No routing options provided');
    if (options.length === 1) {
      const s = this.ensureStats(options[0].model, options[0].taskType);
      return {
        ...options[0],
        sampledValue: this.sampleBeta(s.alpha, s.beta),
        stats: s,
        alternatives: [],
      };
    }

    const candidates = options.map(opt => {
      const s = this.ensureStats(opt.model, opt.taskType);
      const sampledValue = this.sampleBeta(s.alpha, s.beta);
      return { model: opt.model, taskType: opt.taskType, sampledValue, stats: s };
    });

    candidates.sort((a, b) => b.sampledValue - a.sampledValue);
    const winner = candidates[0];

    return {
      model: winner.model,
      taskType: winner.taskType,
      sampledValue: winner.sampledValue,
      stats: winner.stats,
      alternatives: candidates.slice(1).map(c => ({ model: c.model, sampledValue: c.sampledValue })),
    };
  }

  /**
   * Update the router with an outcome.
   * score >= SUCCESS_THRESHOLD = success (alpha++), else failure (beta++).
   */
  update(model: string, taskType: string, score: number): void {
    const s = this.ensureStats(model, taskType);
    s.totalCalls++;
    s.avgScore = s.avgScore + (score - s.avgScore) / s.totalCalls;
    if (score >= SUCCESS_THRESHOLD) {
      s.alpha++;
    } else {
      s.beta++;
    }
  }

  /** Get stats for a specific model+task pair. */
  getStats(model: string, taskType: string): ModelStats {
    return { ...this.ensureStats(model, taskType) };
  }

  /** Get all known routing stats. */
  getAllStats(): Map<RoutingKey, ModelStats> {
    return new Map(this.stats);
  }

  /** Serialize for persistence. */
  toJSON(): Record<string, ModelStats> {
    const obj: Record<string, ModelStats> = {};
    for (const [k, v] of this.stats) {
      obj[k] = { ...v };
    }
    return obj;
  }

  /** Restore from serialized state. */
  static fromJSON(data: Record<string, ModelStats>): ModelRouter {
    const router = new ModelRouter();
    for (const [k, v] of Object.entries(data)) {
      router.stats.set(k, { ...v });
    }
    return router;
  }
}

/**
 * Gamma random variate using Marsaglia and Tsang's method.
 * For shape >= 1; for shape < 1, uses the transformation G(a) = G(a+1) * U^(1/a).
 */
function gammaRandom(shape: number, scale: number): number {
  if (shape < 1) {
    return gammaRandom(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/** Standard normal random variate (Box-Muller). */
function randn(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
