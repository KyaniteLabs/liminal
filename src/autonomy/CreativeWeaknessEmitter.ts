/**
 * CreativeWeaknessEmitter — Phase 16
 *
 * Detects recurring creative weaknesses from garden health data,
 * evaluation scores, and compost failure patterns, then emits
 * improvement tasks for the engineering pipeline.
 */

import type { GardenHealthMetrics } from './GardenHealthMonitor.js';
import type { StagnationResult } from './StagnationDetector.js';

export type WeaknessCategory =
  | 'generator-adapter'
  | 'critic-blind-spot'
  | 'archive-indexing'
  | 'rendering-bottleneck'
  | 'audio-mapping'
  | 'descriptor-coverage'
  | 'novelty-collapse';

export interface CreativeWeakness {
  id: string;
  category: WeaknessCategory;
  severity: number;
  description: string;
  evidence: string[];
  suggestedFix: string;
  detectedAt: string;
}

export interface CreativeWeaknessEmitterConfig {
  /** Minimum severity to emit (default: 0.3) */
  minSeverity?: number;
  /** Maximum weaknesses per analysis (default: 10) */
  maxPerAnalysis?: number;
}

export class CreativeWeaknessEmitter {
  private readonly minSeverity: number;
  private readonly maxPerAnalysis: number;
  private readonly emitted = new Map<string, CreativeWeakness>();

  constructor(config: CreativeWeaknessEmitterConfig = {}) {
    this.minSeverity = config.minSeverity ?? 0.3;
    this.maxPerAnalysis = config.maxPerAnalysis ?? 10;
  }

  /**
   * Analyze health, stagnation, and compost metrics to detect weaknesses.
   */
  analyze(
    health: GardenHealthMetrics,
    stagnation: StagnationResult,
    compostFailureRate?: number,
    evaluationVariance?: number,
  ): CreativeWeakness[] {
    const weaknesses: CreativeWeakness[] = [];

    // 1. Novelty collapse — archive diversity declining
    if (health.nicheOccupancy > 0.8 && health.fertilityYield < 0.3) {
      weaknesses.push({
        id: `novelty-collapse-${Date.now()}`,
        category: 'novelty-collapse',
        severity: 0.7,
        description: 'Archive is full but infertile — novelty search may be stuck',
        evidence: [
          `Niche occupancy: ${health.nicheOccupancy.toFixed(2)}`,
          `Fertility yield: ${health.fertilityYield.toFixed(2)}`,
        ],
        suggestedFix: 'Diversify descriptor axes or increase perturbation magnitude',
        detectedAt: new Date().toISOString(),
      });
    }

    // 2. Descriptor coverage — low niche occupancy after many cycles
    if (health.nicheOccupancy < 0.2 && health.archiveSize > 5) {
      weaknesses.push({
        id: `descriptor-coverage-${Date.now()}`,
        category: 'descriptor-coverage',
        severity: 0.6,
        description: 'Low niche occupancy despite substantial archive — descriptors may not discriminate',
        evidence: [
          `Niche occupancy: ${health.nicheOccupancy.toFixed(2)}`,
          `Archive size: ${health.archiveSize}`,
        ],
        suggestedFix: 'Add new descriptor axes or adjust binning resolution',
        detectedAt: new Date().toISOString(),
      });
    }

    // 3. Critic blind spots — evaluation variance too high
    if (evaluationVariance !== undefined && evaluationVariance > 0.3) {
      weaknesses.push({
        id: `critic-blind-spot-${Date.now()}`,
        category: 'critic-blind-spot',
        severity: 0.5,
        description: 'High evaluation variance suggests critics disagree systematically',
        evidence: [`Evaluation variance: ${evaluationVariance.toFixed(2)}`],
        suggestedFix: 'Review critic prompts for contradictory criteria; add calibration cases',
        detectedAt: new Date().toISOString(),
      });
    }

    // 4. Compost quality — high failure rate
    if (compostFailureRate !== undefined && compostFailureRate > 0.5) {
      weaknesses.push({
        id: `generator-adapter-${Date.now()}`,
        category: 'generator-adapter',
        severity: 0.6,
        description: 'High compost failure rate suggests generator adapter weaknesses',
        evidence: [`Compost failure rate: ${compostFailureRate.toFixed(2)}`],
        suggestedFix: 'Review compost shredding and collision strategies for the failing domain',
        detectedAt: new Date().toISOString(),
      });
    }

    // 5. Stagnation-driven weaknesses
    for (const signal of stagnation.signals) {
      if (signal.metric === 'fertility' && signal.value < -0.1) {
        weaknesses.push({
          id: `rendering-bottleneck-${Date.now()}`,
          category: 'rendering-bottleneck',
          severity: 0.5,
          description: 'Fertility declining — rendering may be bottlenecking quality evaluation',
          evidence: [signal.description],
          suggestedFix: 'Profile rendering pipeline; consider async rendering for evaluation',
          detectedAt: new Date().toISOString(),
        });
      }

      if (signal.metric === 'tasteAlignment' && signal.value < 0.2) {
        weaknesses.push({
          id: `audio-mapping-${Date.now()}`,
          category: 'audio-mapping',
          severity: 0.4,
          description: 'Taste alignment very low — aesthetic criteria may not match user preference',
          evidence: [signal.description],
          suggestedFix: 'Retrain taste model; review aesthetic strategy weights',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Filter by severity, deduplicate, and limit
    const filtered = weaknesses
      .filter(w => w.severity >= this.minSeverity)
      .filter(w => !this.emitted.has(w.category))
      .slice(0, this.maxPerAnalysis);

    for (const w of filtered) {
      this.emitted.set(w.category, w);
    }

    return filtered;
  }

  /**
   * Get all previously emitted weaknesses.
   */
  getEmitted(): CreativeWeakness[] {
    return [...this.emitted.values()];
  }

  /**
   * Clear a resolved weakness.
   */
  resolve(category: WeaknessCategory): boolean {
    return this.emitted.delete(category);
  }
}
