/**
 * GeneratorBanditRouter - Thompson Sampling bandit for generator-level model routing.
 *
 * Tracks quality per (domain, model) pair using Beta distributions.
 * After enough observations, selects the model with the highest Thompson sample
 * instead of falling back to static A/B test data.
 *
 * Reuses the sampleBeta() function from the compost ModelRouter.
 *
 * @module routing/GeneratorBanditRouter
 */

import { sampleBeta } from '../compost/ModelRouter.js';
import { Logger } from '../utils/Logger.js';
import type { DomainType, ModelChoice } from './RoutingData.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-arm Beta distribution state */
export interface BanditArm {
  domain: DomainType;
  model: ModelChoice;
  alpha: number;
  beta: number;
  pulls: number;
  totalReward: number;
}

/** Serializable bandit state for persistence */
export interface BanditState {
  version: number;
  arms: Array<BanditArm & { updatedAt: string }>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MIN_PULLS_BEFORE_TRUST = 5;       // Need this many pulls before trusting bandit
const SUCCESS_THRESHOLD = 0.7;          // Score above this = success for Beta update
const MAX_ARMS = 100;                   // Safety cap

// ---------------------------------------------------------------------------
// GeneratorBanditRouter
// ---------------------------------------------------------------------------

export class GeneratorBanditRouter {
  private arms: Map<string, BanditArm> = new Map(); // key = "domain:model"

  /**
   * Select the best model for a domain using Thompson Sampling.
   * Returns null if no data exists yet (caller should use static fallback).
   */
  selectModel(domain: DomainType): ModelChoice | null {
    const models: ModelChoice[] = ['local', 'cloud', 'hybrid'];
    const candidates: Array<{ model: ModelChoice; arm: BanditArm }> = [];

    for (const model of models) {
      const arm = this.getOrCreateArm(domain, model);
      if (arm.pulls >= MIN_PULLS_BEFORE_TRUST) {
        candidates.push({ model, arm });
      }
    }

    // Not enough data — signal caller to use static routing
    if (candidates.length === 0) {
      return null;
    }

    // Thompson Sampling: sample from each arm's Beta distribution
    let bestModel: ModelChoice = candidates[0].model;
    let bestSample = -Infinity;

    for (const { model, arm } of candidates) {
      const sample = sampleBeta(arm.alpha, arm.beta);
      Logger.debug('GeneratorBanditRouter', `Thompson sample: ${domain}/${model} = ${sample.toFixed(4)} (α=${arm.alpha}, β=${arm.beta})`);

      if (sample > bestSample) {
        bestSample = sample;
        bestModel = model;
      }
    }

    Logger.info('GeneratorBanditRouter', `Selected ${bestModel} for ${domain} (sample=${bestSample.toFixed(4)})`);
    return bestModel;
  }

  /**
   * Record the outcome of a generation for online learning.
   */
  recordOutcome(domain: DomainType, model: ModelChoice, score: number): void {
    const arm = this.getOrCreateArm(domain, model);
    arm.pulls++;
    arm.totalReward += score;

    // Beta update: success bumps alpha, failure bumps beta
    if (score >= SUCCESS_THRESHOLD) {
      arm.alpha += 1;
    } else {
      arm.beta += 1;
    }

    Logger.debug('GeneratorBanditRouter', `Updated ${domain}/${model}: score=${score.toFixed(3)}, α=${arm.alpha}, β=${arm.beta}, pulls=${arm.pulls}`);
  }

  /**
   * Get the best model for a domain based on mean reward (for reporting).
   */
  getBestModel(domain: DomainType): ModelChoice | null {
    const models: ModelChoice[] = ['local', 'cloud', 'hybrid'];
    let best: ModelChoice | null = null;
    let bestMean = -Infinity;

    for (const model of models) {
      const key = this.armKey(domain, model);
      const arm = this.arms.get(key);
      if (!arm || arm.pulls === 0) continue;

      const mean = arm.totalReward / arm.pulls;
      if (mean > bestMean) {
        bestMean = mean;
        best = model;
      }
    }

    return best;
  }

  /**
   * Get all arm states (for monitoring/debugging).
   */
  getArms(): BanditArm[] {
    return Array.from(this.arms.values());
  }

  /**
   * Check if the bandit has enough data to make routing decisions for a domain.
   */
  isReady(domain: DomainType): boolean {
    const models: ModelChoice[] = ['local', 'cloud', 'hybrid'];
    return models.some(m => {
      const arm = this.getOrCreateArm(domain, m);
      return arm.pulls >= MIN_PULLS_BEFORE_TRUST;
    });
  }

  /**
   * Get statistics for a domain.
   */
  getDomainStats(domain: DomainType): Record<ModelChoice, { pulls: number; meanReward: number; alpha: number; beta: number }> {
    const models: ModelChoice[] = ['local', 'cloud', 'hybrid'];
    const stats = {} as Record<ModelChoice, { pulls: number; meanReward: number; alpha: number; beta: number }>;

    for (const model of models) {
      const arm = this.getOrCreateArm(domain, model);
      stats[model] = {
        pulls: arm.pulls,
        meanReward: arm.pulls > 0 ? arm.totalReward / arm.pulls : 0,
        alpha: arm.alpha,
        beta: arm.beta,
      };
    }

    return stats;
  }

  /**
   * Serialize state for persistence.
   */
  serialize(): BanditState {
    return {
      version: 1,
      arms: Array.from(this.arms.values()).map(arm => ({
        ...arm,
        updatedAt: new Date().toISOString(),
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Load state from persistence.
   */
  deserialize(state: BanditState): void {
    this.arms.clear();
    for (const arm of state.arms) {
      const key = this.armKey(arm.domain, arm.model);
      this.arms.set(key, {
        domain: arm.domain,
        model: arm.model,
        alpha: arm.alpha,
        beta: arm.beta,
        pulls: arm.pulls,
        totalReward: arm.totalReward,
      });
    }
    Logger.info('GeneratorBanditRouter', `Loaded ${this.arms.size} arms from persisted state`);
  }

  /**
   * Reset all bandit state (for testing).
   */
  reset(): void {
    this.arms.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private armKey(domain: DomainType, model: ModelChoice): string {
    return `${domain}:${model}`;
  }

  private getOrCreateArm(domain: DomainType, model: ModelChoice): BanditArm {
    const key = this.armKey(domain, model);
    let arm = this.arms.get(key);

    if (!arm) {
      if (this.arms.size >= MAX_ARMS) {
        // Safety: evict the least-pulled arm
        let minPulls = Infinity;
        let minKey = '';
        for (const [k, a] of this.arms) {
          if (a.pulls < minPulls) {
            minPulls = a.pulls;
            minKey = k;
          }
        }
        if (minKey) this.arms.delete(minKey);
      }

      arm = { domain, model, alpha: 1, beta: 1, pulls: 0, totalReward: 0 };
      this.arms.set(key, arm);
    }

    return arm;
  }
}

/** Singleton instance */
export const generatorBanditRouter = new GeneratorBanditRouter();
