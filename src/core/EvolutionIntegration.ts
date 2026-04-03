/**
 * EvolutionIntegration - MAP-Elites + novelty + aesthetic model coordination
 *
 * Handles evolution subsystem coordination within the RalphLoop:
 * - MapElites insert and coverage tracking
 * - Novelty scoring via NoveltyArchive
 * - Aesthetic model prediction and update
 * - Coverage-based diversity hints
 *
 * Extracted from RalphLoop.ts (lines 437-491).
 */

import { MapElites } from '../evolution/MapElites.js';
import { NoveltyArchive } from '../evolution/NoveltyArchive.js';
import { extractBehavior } from '../evolution/BehaviorVectors.js';
import { AestheticModel } from '../evolution/AestheticModel.js';
import { ContextAccumulation } from './ContextAccumulation.js';
import type { NormalizedLoopOptions } from './LoopConfig.js';

export interface EvolutionUpdateResult {
  noveltyScore: number;
  hints: string;
}

/**
 * Coordinates MAP-Elites, novelty archive, and aesthetic model updates.
 */
export class EvolutionIntegration {
  constructor(
    private options: NormalizedLoopOptions,
    private aestheticModel: AestheticModel | null
  ) {}

  /**
   * Update evolution subsystems after a generation step.
   * Returns novelty score and any hints to inject into the next prompt.
   */
  update(
    iteration: number,
    code: string,
    evaluationScore: number,
    prompt: string
  ): EvolutionUpdateResult {
    let noveltyScore = 0;
    let hints = '';

    if (!this.options.useMapElites) {
      return { noveltyScore: 0, hints: '' };
    }

    const mapElites = this.options._mapElites as MapElites | undefined;
    const archive = this.options._noveltyArchive as NoveltyArchive | undefined;

    const behavior = extractBehavior(code);
    if (archive) {
      noveltyScore = archive.noveltyScore(behavior);
    }

    if (mapElites) {
      mapElites.insert(
        `iteration-${iteration}`,
        behavior,
        evaluationScore
      );

      // Inject diverse elites into next iteration's context when coverage is low
      const coverage = mapElites.coverage();
      if (coverage < 0.3 && iteration > 1) {
        const elites = mapElites.getElites(3);
        if (elites.length > 0) {
          ContextAccumulation.save({
            iteration: iteration + 0.1,
            prompt,
            usedPrompt: '',
            code: '',
            evaluation: {
              score: 0,
              issues: [],
              mapElitesCoverage: coverage,
              mapElitesDiversityHint: `Low MAP-Elites coverage (${(coverage * 100).toFixed(0)}%). Consider exploring diverse behaviors.`,
            },
            timestamp: new Date().toISOString(),
            maxIterations: this.options.maxIterations,
          });
        }
      }
    }

    // Feed behavior + score into aesthetic model for prediction
    if (this.aestheticModel) {
      const domain = this.options.collabDomain || 'p5';
      const predictedQuality = this.aestheticModel.predict(behavior, { domain });
      this.aestheticModel.update([{ behavior, rating: evaluationScore * 5, domain }]);

      if (predictedQuality < 0.3 && iteration > 1) {
        hints = '\n\n---\nAesthetic model hint: This behavior region has produced low-quality outputs in the past. Try a significantly different approach.';
      } else if (predictedQuality > 0.7) {
        hints = '\n\n---\nAesthetic model hint: This behavior region tends to produce high-quality outputs. Lean into this direction.';
      }
    }

    return { noveltyScore, hints };
  }
}
