/**
 * EmergenceCritic — Phase 14
 *
 * Ensemble critic that composes multiple signal sources into a unified
 * emergence evaluation. Replaces the heuristic stub in EmergenceHooks.
 *
 * Signal sources:
 * - NoveltyIndex: how novel vs. archive history
 * - TemporalStructureAnalyzer: multi-scale structure + temporal richness
 * - PerturbationProbe: resilience under perturbation
 * - FertilityProbe: descendant potential from lineage/archive data
 * - Aesthetic: quality score + descriptor balance
 *
 * All signals are kept separate (not collapsed to scalar) so consumers
 * can weight them differently for different decisions.
 */

import { NoveltyIndex } from './NoveltyIndex.js';
import { TemporalStructureAnalyzer } from './TemporalStructureAnalyzer.js';
import { PerturbationProbe } from './PerturbationProbe.js';
import type { ArchiveEntry, BehaviorDescriptor, EmergenceSignals, LineageRecord } from './types.js';

export interface EmergenceCriticConfig {
  /** Weight for novelty signal (default: 0.25) */
  noveltyWeight?: number;
  /** Weight for structure signal (default: 0.2) */
  structureWeight?: number;
  /** Weight for temporal richness (default: 0.15) */
  temporalWeight?: number;
  /** Weight for perturbation resilience (default: 0.15) */
  resilienceWeight?: number;
  /** Weight for fertility (default: 0.15) */
  fertilityWeight?: number;
  /** Weight for aesthetic (default: 0.1) */
  aestheticWeight?: number;
}

const DEFAULT_WEIGHTS = {
  novelty: 0.25,
  structure: 0.2,
  temporal: 0.15,
  resilience: 0.15,
  fertility: 0.15,
  aesthetic: 0.1,
};

export interface CriticResult {
  signals: EmergenceSignals;
  /** Weighted composite score (0–1) */
  composite: number;
  /** Individual signal breakdown for explainability */
  breakdown: Array<{ signal: string; value: number; weight: number; contribution: number }>;
  /** Whether this was a full or quick evaluation */
  mode: 'full' | 'quick';
}

export class EmergenceCritic {
  private readonly noveltyIndex: NoveltyIndex;
  private readonly temporalAnalyzer: TemporalStructureAnalyzer;
  private readonly perturbationProbe: PerturbationProbe;
  private readonly weights: typeof DEFAULT_WEIGHTS;

  constructor(config: EmergenceCriticConfig = {}) {
    this.noveltyIndex = new NoveltyIndex();
    this.temporalAnalyzer = new TemporalStructureAnalyzer();
    this.perturbationProbe = new PerturbationProbe();
    this.weights = { ...DEFAULT_WEIGHTS, ...config };
  }

  /**
   * Full evaluation — computes all signals including perturbation probe.
   * Use for final candidate evaluation.
   */
  async evaluateFull(params: {
    output: string;
    descriptor: BehaviorDescriptor;
    qualityScore: number;
    archive: ArchiveEntry[];
    lineage?: LineageRecord;
    extractFn?: (output: string) => BehaviorDescriptor;
  }): Promise<CriticResult> {
    const { output, descriptor, qualityScore, archive, lineage, extractFn } = params;

    // 1. Novelty
    const novelty = this.noveltyIndex.score(descriptor, archive);

    // 2. Structure + Temporal
    const temporalResult = this.temporalAnalyzer.analyze(output);
    const structure = temporalResult.structure;
    const temporalRichness = temporalResult.temporalRichness;

    // 3. Perturbation resilience
    let perturbationResilience: number;
    if (extractFn) {
      const probeResult = this.perturbationProbe.probe(output, descriptor, extractFn);
      perturbationResilience = probeResult.resilience;
    } else {
      perturbationResilience = this.perturbationProbe.quickEstimate(descriptor);
    }

    // 4. Fertility: based on novelty + quality + diversity of descriptor values
    const fertility = this.computeFertility(novelty, qualityScore, descriptor, archive, lineage);

    // 5. Aesthetic
    const aesthetic = this.computeAesthetic(qualityScore, descriptor);

    const signals: EmergenceSignals = {
      novelty: this.clamp(novelty),
      structure: this.clamp(structure),
      temporalRichness: this.clamp(temporalRichness),
      perturbationResilience: this.clamp(perturbationResilience),
      fertility: this.clamp(fertility),
      aesthetic: this.clamp(aesthetic),
    };

    return this.buildResult(signals, 'full');
  }

  /**
   * Quick evaluation — skips perturbation probe for high-throughput paths.
   * Use for initial screening and Cortex budget-limited decisions.
   */
  evaluateQuick(params: {
    descriptor: BehaviorDescriptor;
    qualityScore: number;
    archive: ArchiveEntry[];
    output: string;
    lineage?: LineageRecord;
  }): CriticResult {
    const { descriptor, qualityScore, archive, output, lineage } = params;

    const novelty = this.noveltyIndex.score(descriptor, archive);
    const temporalResult = this.temporalAnalyzer.analyze(output);
    const perturbationResilience = this.perturbationProbe.quickEstimate(descriptor);
    const fertility = this.computeFertility(novelty, qualityScore, descriptor, archive, lineage);
    const aesthetic = this.computeAesthetic(qualityScore, descriptor);

    const signals: EmergenceSignals = {
      novelty: this.clamp(novelty),
      structure: this.clamp(temporalResult.structure),
      temporalRichness: this.clamp(temporalResult.temporalRichness),
      perturbationResilience: this.clamp(perturbationResilience),
      fertility: this.clamp(fertility),
      aesthetic: this.clamp(aesthetic),
    };

    return this.buildResult(signals, 'quick');
  }

  /**
   * Compute fertility score: how likely this artifact is to produce
   * strong descendants. Based on novelty, quality, descriptor diversity,
   * and whether the lineage already has successful branches.
   */
  private computeFertility(
    novelty: number,
    quality: number,
    descriptor: BehaviorDescriptor,
    archive: ArchiveEntry[],
    lineage?: LineageRecord,
  ): number {
    // Descriptor diversity: variance in descriptor values
    const values = descriptor.values.map(v => v.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const diversityBonus = Math.min(1, variance * 4);

    // Lineage bonus: if this artifact has parents that were fertile
    let lineageBonus = 0;
    if (lineage?.parentIds && lineage.parentIds.length > 0) {
      // Has parents — remix potential
      const parentEntries = archive.filter(e => lineage.parentIds.includes(e.lineage.artifactId));
      if (parentEntries.length > 0) {
        const parentFertility = parentEntries.reduce((s, e) => s + e.signals.fertility, 0) / parentEntries.length;
        lineageBonus = parentFertility * 0.2;
      }
    }

    // Niche uniqueness: fewer neighbors = more fertile niche
    const nearest = this.noveltyIndex.findNearest(descriptor, archive, 3);
    const avgNearestDist = nearest.length > 0
      ? nearest.reduce((s, n) => s + n.distance, 0) / nearest.length
      : 1;
    const nicheBonus = Math.min(0.3, avgNearestDist * 0.3);

    return (novelty * 0.25) +
      (quality * 0.25) +
      (diversityBonus * 0.2) +
      (lineageBonus) +
      (nicheBonus);
  }

  /**
   * Aesthetic score from quality + descriptor balance.
   */
  private computeAesthetic(qualityScore: number, descriptor: BehaviorDescriptor): number {
    const values = descriptor.values.map(v => v.value);

    // Balanced descriptors (not extreme on any axis) score higher aesthetically
    const extremes = values.filter(v => v < 0.1 || v > 0.9).length;
    const balance = 1 - (extremes / values.length) * 0.5;

    return (qualityScore * 0.7) + (balance * 0.3);
  }

  private buildResult(signals: EmergenceSignals, mode: 'full' | 'quick'): CriticResult {
    const breakdown = [
      { signal: 'novelty', value: signals.novelty, weight: this.weights.novelty, contribution: signals.novelty * this.weights.novelty },
      { signal: 'structure', value: signals.structure, weight: this.weights.structure, contribution: signals.structure * this.weights.structure },
      { signal: 'temporalRichness', value: signals.temporalRichness, weight: this.weights.temporal, contribution: signals.temporalRichness * this.weights.temporal },
      { signal: 'perturbationResilience', value: signals.perturbationResilience, weight: this.weights.resilience, contribution: signals.perturbationResilience * this.weights.resilience },
      { signal: 'fertility', value: signals.fertility, weight: this.weights.fertility, contribution: signals.fertility * this.weights.fertility },
      { signal: 'aesthetic', value: signals.aesthetic, weight: this.weights.aesthetic, contribution: signals.aesthetic * this.weights.aesthetic },
    ];

    const composite = breakdown.reduce((sum, b) => sum + b.contribution, 0);

    return { signals, composite, breakdown, mode };
  }

  private clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  /** Expose sub-components for direct access. */
  getNoveltyIndex(): NoveltyIndex { return this.noveltyIndex; }
  getTemporalAnalyzer(): TemporalStructureAnalyzer { return this.temporalAnalyzer; }
  getPerturbationProbe(): PerturbationProbe { return this.perturbationProbe; }
}
