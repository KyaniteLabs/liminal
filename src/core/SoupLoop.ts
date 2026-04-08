/**
 * SoupLoop - Population-based loop: maintain K candidates; pick two, merge (or generate), evaluate, replace one.
 * Used for evolutionary/exploratory creative runs.
 */

import { CreativeEvaluator } from './CreativeEvaluator.js';
import { ParticleSystem } from '../generators/p5/ParticleSystem.js';
import { Gallery } from '../gallery/Gallery.js';
import { promptToGeneratorParams } from '../utils/promptToGeneratorParams.js';
import { mergeSketchCode } from '../utils/mergeSketchCode.js';
import { NoveltyArchive } from '../evolution/NoveltyArchive.js';
import { extractBehavior } from '../evolution/BehaviorVectors.js';
import { MapElites } from '../evolution/MapElites.js';
import { Logger } from '../utils/Logger.js';

export interface SoupCandidate {
  code: string;
  score: number;
}

export interface SoupLoopOptions {
  populationSize?: number;
  maxSteps?: number;
  galleryDir?: string;
  project?: string;
  /** Enable novelty-biased selection (prefer novel candidates for merging) */
  useNoveltySelection?: boolean;
  /** MAP-Elites grid dimensions (default [10, 10]) */
  mapElitesDims?: [number, number];
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

    const archive = options.useNoveltySelection ? new NoveltyArchive() : null;
    const mapElites = options.useNoveltySelection ? new MapElites(options.mapElitesDims ?? [10, 10]) : null;

    // Add initial population to archive
    if (archive) {
      for (const candidate of population) {
        archive.add(extractBehavior(candidate.code));
      }
    }

    let steps = 0;
    for (let s = 0; s < maxSteps; s++) {
      if (options.signal?.aborted) break;
      steps = s + 1;

      let i: number, j: number;
      if (archive) {
        // Novelty-biased selection: pick candidate with highest novelty score
        let bestNovelty = -1;
        let bestIdx = 0;
        for (let idx = 0; idx < population.length; idx++) {
          const novelty = archive.noveltyScore(extractBehavior(population[idx].code));
          if (novelty > bestNovelty) {
            bestNovelty = novelty;
            bestIdx = idx;
          }
        }
        i = bestIdx;
        j = Math.floor(Math.random() * population.length);
        while (j === i) j = Math.floor(Math.random() * population.length);
      } else {
        i = Math.floor(Math.random() * population.length);
        j = Math.floor(Math.random() * population.length);
        while (j === i) j = Math.floor(Math.random() * population.length);
      }
      const codeA = population[i].code;
      const codeB = population[j].code;
      const mergedCode = mergeSketchCode(codeA, codeB);
      const mergedEval = CreativeEvaluator.assess(mergedCode);

      const worstIdx = population.reduce((min, c, idx) => (c.score < population[min].score ? idx : min), 0);
      const merged: boolean = mergedEval.score >= population[worstIdx].score;
      if (merged) {
        population[worstIdx] = { code: mergedCode, score: mergedEval.score };
      }
      if (merged && archive) {
        archive.add(extractBehavior(mergedCode));
      }
      if (merged && mapElites) {
        const behavior = extractBehavior(mergedCode);
        mapElites.insert(`soup-step-${steps}`, behavior, mergedEval.score);
      }
      options.onStep?.({ population: [...population], merged });

      if (project && gallery && merged) {
        const version = steps;
        try {
          await gallery.saveIteration(project, version, population[worstIdx].code);
        } catch (err) {
          Logger.error('SoupLoop', `Gallery save failed (iteration ${steps} lost): ${err instanceof Error ? err.message : err}`);
          throw err;
        }
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

