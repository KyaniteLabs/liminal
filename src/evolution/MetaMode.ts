/**
 * MetaMode - Parameter search via hypothesis generation and experiment comparison.
 * Generates parameter variations, runs simulated experiments, and tracks the best configuration.
 */

export interface Experiment {
  name: string;
  params: Record<string, number>;
  baselineScore: number;
  experimentScore?: number;
  improvement?: number;
}

export class MetaMode {
  private experiments: Experiment[];
  private bestExperiment: Experiment | null;
  private completedExperiments: number;

  constructor() {
    this.experiments = [];
    this.bestExperiment = null;
    this.completedExperiments = 0;
  }

  /** Generate 6 hypothesis experiments varying key parameters against a baseline score. */
  generateHypotheses(baselineScore: number): Experiment[] {
    const noveltyWeights = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
    const qualityWeights = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
    const temperatures = [0.3, 0.5, 0.7, 0.9, 1.0, 1.2];
    const populationSizes = [3, 5, 7, 10, 15, 20];

    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    const experiments: Experiment[] = [];
    for (let i = 0; i < 6; i++) {
      experiments.push({
        name: `exp-${i + 1}`,
        params: {
          noveltyWeight: pick(noveltyWeights),
          qualityWeight: pick(qualityWeights),
          temperature: pick(temperatures),
          populationSize: pick(populationSizes),
        },
        baselineScore,
      });
    }

    this.experiments = experiments;
    return experiments;
  }

  /**
   * Run a single experiment (simulated).
   * In production, this would invoke RalphLoop with the experiment's params.
   */
  async runExperiment(experiment: Experiment, iterations?: number): Promise<number> {
    // iterations is accepted for API compatibility but the simulation doesn't use it
    void iterations;

    await new Promise((resolve) => setTimeout(resolve, 1));

    const tempNoise = (experiment.params.temperature - 0.5) * 0.2;
    const popBonus = Math.log(experiment.params.populationSize + 1) * 0.02;
    const noveltyBoost = experiment.params.noveltyWeight * 0.05;
    const score = Math.max(
      0,
      Math.min(
        1,
        experiment.baselineScore +
          tempNoise +
          popBonus +
          noveltyBoost +
          (Math.random() - 0.5) * 0.1,
      ),
    );

    experiment.experimentScore = score;
    experiment.improvement = score - experiment.baselineScore;
    this.completedExperiments++;

    if (
      !this.bestExperiment ||
      (this.bestExperiment.experimentScore ?? -Infinity) < score
    ) {
      this.bestExperiment = experiment;
    }

    return score;
  }

  /** Get the experiment with the highest experimentScore so far. */
  getBestExperiment(): Experiment | null {
    return this.bestExperiment;
  }

  /** Get all experiments tracked by this MetaMode instance. */
  getAllExperiments(): Experiment[] {
    return this.experiments;
  }

  /** Number of experiments that have been run via runExperiment. */
  getCompletedCount(): number {
    return this.completedExperiments;
  }

  /** Reset all state to initial values. */
  reset(): void {
    this.experiments = [];
    this.bestExperiment = null;
    this.completedExperiments = 0;
  }
}
