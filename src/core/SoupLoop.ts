/**
 * SoupLoop - Population-based loop: maintain K candidates; pick two, merge (or generate), evaluate, replace one.
 * Used for evolutionary/exploratory creative runs.
 */

import { CreativeEvaluator } from './CreativeEvaluator.js';
import { ParticleSystem } from '../generators/p5/ParticleSystem.js';
import { Gallery } from '../gallery/Gallery.js';
import { promptToGeneratorParams } from '../utils/promptToGeneratorParams.js';

export interface SoupCandidate {
  code: string;
  score: number;
}

export interface SoupLoopOptions {
  populationSize?: number;
  maxSteps?: number;
  galleryDir?: string;
  project?: string;
  /** Called after each step with current population and whether this step was a merge */
  onStep?: (data: { population: SoupCandidate[]; merged: boolean }) => void;
  signal?: AbortSignal;
}

export interface SoupLoopResult {
  population: SoupCandidate[];
  bestCode: string;
  bestScore: number;
  steps: number;
}

export class SoupLoop {
  static async run(prompt: string, options: SoupLoopOptions = {}): Promise<SoupLoopResult> {
    const populationSize = Math.max(2, options.populationSize ?? 3);
    const maxSteps = Math.max(1, options.maxSteps ?? 10);
    const gallery = options.galleryDir ? new Gallery(options.galleryDir) : null;
    const project = options.project;

    const derived = promptToGeneratorParams(prompt);
    const params: Record<string, unknown> = { ...derived };
    if (/blue/.test(prompt.toLowerCase())) (params as Record<string, unknown>).palette = 'cool';

    // Initial population: K deterministic variants (vary a param or duplicate and mutate)
    const population: SoupCandidate[] = [];
    for (let i = 0; i < populationSize; i++) {
      const code = ParticleSystem.generate(params);
      const evaluation = CreativeEvaluator.assess(code);
      population.push({ code, score: evaluation.score });
    }

    let steps = 0;
    for (let s = 0; s < maxSteps; s++) {
      if (options.signal?.aborted) break;
      steps = s + 1;

      const i = Math.floor(Math.random() * population.length);
      let j = Math.floor(Math.random() * population.length);
      while (j === i) j = Math.floor(Math.random() * population.length);
      const codeA = population[i].code;
      const codeB = population[j].code;
      const mergedCode = codeA + '\n// soup merge\n' + codeB;
      const mergedEval = CreativeEvaluator.assess(mergedCode);

      const worstIdx = population.reduce((min, c, idx) => (c.score < population[min].score ? idx : min), 0);
      const merged: boolean = mergedEval.score >= population[worstIdx].score;
      if (merged) {
        population[worstIdx] = { code: mergedCode, score: mergedEval.score };
      }
      options.onStep?.({ population: [...population], merged });

      if (project && gallery && merged) {
        const version = steps;
        await gallery.saveIteration(project, version, population[worstIdx].code).catch(() => {});
      }
    }

    const best = population.reduce((a, b) => (a.score >= b.score ? a : b));
    return {
      population,
      bestCode: best.code,
      bestScore: best.score,
      steps,
    };
  }
}
