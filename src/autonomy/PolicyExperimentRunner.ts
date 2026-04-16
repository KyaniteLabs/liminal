/**
 * PolicyExperimentRunner — Phase 16
 *
 * Runs A/B experiments on garden policies (critic prompts,
 * descriptor definitions, replay weights, loop-mix allocations).
 * Compares experiment branch against control using held-out metrics.
 */

export type PolicyKind = 'critic-prompt' | 'descriptor-weights' | 'replay-bias' | 'loop-mix' | 'taste-model';

export interface PolicyVariant {
  id: string;
  kind: PolicyKind;
  label: string;
  config: Record<string, number>;
}

export interface ExperimentResult {
  variantId: string;
  metric: string;
  value: number;
  sampleSize: number;
  confidence: number;
}

export interface ExperimentOutcome {
  experimentId: string;
  control: PolicyVariant;
  treatment: PolicyVariant;
  controlResults: ExperimentResult[];
  treatmentResults: ExperimentResult[];
  winner: 'control' | 'treatment' | 'inconclusive';
  confidence: number;
  recommendation: string;
}

export interface PolicyExperimentRunnerConfig {
  /** Minimum samples per variant before declaring a winner (default: 10) */
  minSamples?: number;
  /** Confidence threshold for promotion (default: 0.7) */
  confidenceThreshold?: number;
}

export class PolicyExperimentRunner {
  private readonly minSamples: number;
  private readonly confidenceThreshold: number;
  private readonly experiments = new Map<string, { control: PolicyVariant; treatment: PolicyVariant }>();
  private readonly results = new Map<string, { control: ExperimentResult[]; treatment: ExperimentResult[] }>();
  private experimentCount = 0;

  constructor(config: PolicyExperimentRunnerConfig = {}) {
    this.minSamples = config.minSamples ?? 10;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.7;
  }

  /**
   * Create a new A/B experiment.
   */
  createExperiment(control: PolicyVariant, treatment: PolicyVariant): string {
    const id = `experiment-${++this.experimentCount}`;
    this.experiments.set(id, { control, treatment });
    this.results.set(id, { control: [], treatment: [] });
    return id;
  }

  /**
   * Record a result for a variant.
   */
  recordResult(experimentId: string, variantId: string, metric: string, value: number): void {
    const data = this.results.get(experimentId);
    if (!data) return;

    const entry: ExperimentResult = {
      variantId,
      metric,
      value,
      sampleSize: 1,
      confidence: 0,
    };

    if (variantId === this.experiments.get(experimentId)?.control.id) {
      data.control.push(entry);
    } else {
      data.treatment.push(entry);
    }
  }

  /**
   * Evaluate experiment: compare treatment vs control.
   */
  evaluate(experimentId: string): ExperimentOutcome | null {
    const experiment = this.experiments.get(experimentId);
    const data = this.results.get(experimentId);
    if (!experiment || !data) return null;

    const controlAvg = this.averageMetric(data.control);
    const treatmentAvg = this.averageMetric(data.treatment);

    const controlN = data.control.length;
    const treatmentN = data.treatment.length;

    if (controlN < this.minSamples || treatmentN < this.minSamples) {
      return {
        experimentId,
        control: experiment.control,
        treatment: experiment.treatment,
        controlResults: data.control,
        treatmentResults: data.treatment,
        winner: 'inconclusive',
        confidence: 0,
        recommendation: `Need at least ${this.minSamples} samples per variant (control: ${controlN}, treatment: ${treatmentN})`,
      };
    }

    // Simple confidence: based on effect size relative to spread
    const diff = treatmentAvg - controlAvg;
    const spread = Math.max(Math.abs(controlAvg), Math.abs(treatmentAvg), 0.01);
    const effectSize = Math.abs(diff) / spread;
    const confidence = Math.min(1, effectSize * 2 + 0.3);

    let winner: 'control' | 'treatment' | 'inconclusive';
    if (confidence >= this.confidenceThreshold) {
      winner = diff > 0 ? 'treatment' : 'control';
    } else {
      winner = 'inconclusive';
    }

    const recommendation = winner === 'treatment'
      ? `Promote treatment "${experiment.treatment.label}" — ${experiment.treatment.kind} improved by ${(diff * 100).toFixed(1)}%`
      : winner === 'control'
        ? `Keep control "${experiment.control.label}" — treatment did not improve`
        : 'Insufficient evidence to decide; continue sampling';

    return {
      experimentId,
      control: experiment.control,
      treatment: experiment.treatment,
      controlResults: data.control,
      treatmentResults: data.treatment,
      winner,
      confidence,
      recommendation,
    };
  }

  /**
   * Get all active experiment IDs.
   */
  getActiveExperiments(): string[] {
    return [...this.experiments.keys()];
  }

  getExperimentCount(): number {
    return this.experimentCount;
  }

  private averageMetric(results: ExperimentResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((s, r) => s + r.value, 0) / results.length;
  }
}
