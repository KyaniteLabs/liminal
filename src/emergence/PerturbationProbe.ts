/**
 * PerturbationProbe — Phase 14
 *
 * Evaluates artifact resilience by simulating controlled perturbations.
 * Without executing code, this uses structural analysis to estimate how
 * an artifact would respond to small mutations.
 *
 * Distinguishes:
 * - brittle: output depends on exact values, small changes break structure
 * - stable: output maintains structure under perturbation
 * - resilient: output has rich behavior that improves or maintains under change
 */

import type { BehaviorDescriptor } from './types.js';

export interface PerturbationResult {
  /** Overall resilience score (0 = brittle, 1 = resilient) */
  resilience: number;
  /** Classification of resilience */
  classification: 'brittle' | 'stable' | 'resilient';
  /** Individual perturbation scores */
  perturbations: Array<{
    type: string;
    score: number;
  }>;
}

export interface PerturbationProbeConfig {
  /** Number of simulated perturbation rounds (default: 5) */
  rounds?: number;
  /** Perturbation magnitude (0–1, default: 0.1) */
  magnitude?: number;
}

const DEFAULT_MAGNITUDE = 0.1;

export class PerturbationProbe {
  private readonly magnitude: number;

  constructor(config: PerturbationProbeConfig = {}) {
    this.magnitude = config.magnitude ?? DEFAULT_MAGNITUDE;
  }

  /**
   * Probe an artifact's resilience by analyzing how its descriptor
   * shifts under simulated perturbations of the output.
   */
  probe(
    output: string,
    descriptor: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
  ): PerturbationResult {
    const perturbations: Array<{ type: string; score: number }> = [];

    // Seeded RNG for deterministic perturbations
    const rng = this.seededRng(output);

    // 1. Value perturbation: shift numeric literals
    const valueScore = this.valuePerturbation(output, descriptor, extractFn, rng);
    perturbations.push({ type: 'value-shift', score: valueScore });

    // 2. Structure perturbation: reorder lines
    const structureScore = this.structurePerturbation(output, descriptor, extractFn, rng);
    perturbations.push({ type: 'line-reorder', score: structureScore });

    // 3. Noise injection: add random whitespace/comments
    const noiseScore = this.noisePerturbation(output, descriptor, extractFn, rng);
    perturbations.push({ type: 'noise-injection', score: noiseScore });

    // 4. Truncation: remove tail content
    const truncationScore = this.truncationPerturbation(output, descriptor, extractFn);
    perturbations.push({ type: 'truncation', score: truncationScore });

    // 5. Redundancy: duplicate middle sections
    const redundancyScore = this.redundancyPerturbation(output, descriptor, extractFn);
    perturbations.push({ type: 'redundancy', score: redundancyScore });

    const resilience = perturbations.reduce((s, p) => s + p.score, 0) / perturbations.length;
    const classification = resilience < 0.33 ? 'brittle' : resilience < 0.66 ? 'stable' : 'resilient';

    return { resilience, classification, perturbations };
  }

  /**
   * Quick resilience estimate without re-extraction (uses descriptor alone).
   * Higher when descriptors are in mid-range (not at extremes).
   */
  quickEstimate(descriptor: BehaviorDescriptor): number {
    const values = descriptor.values.map(v => v.value);

    // Artifacts with mid-range descriptor values tend to be more resilient
    // (extreme values indicate brittle dependence on specific patterns)
    const midRangeAffinity = values.reduce((sum, v) => {
      const distFromCenter = Math.abs(v - 0.5);
      // Closer to center = more resilient
      return sum + (1 - distFromCenter * 2);
    }, 0) / values.length;

    // Variance in descriptor values — moderate variance = more resilient
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const varianceBonus = Math.min(1, variance * 4); // Moderate variance is good

    return (midRangeAffinity * 0.6) + (varianceBonus * 0.4);
  }

  private valuePerturbation(
    output: string,
    original: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
    rng: () => number,
  ): number {
    // Shift numeric literals by the perturbation magnitude
    const perturbed = output.replace(/\b(\d+\.?\d*)\b/g, (match) => {
      const num = parseFloat(match);
      const shift = num * (1 + (rng() - 0.5) * this.magnitude * 2);
      return shift.toFixed(2);
    });

    if (perturbed === output) return 0.7; // No numbers to perturb — neutral resilience

    const perturbedDesc = extractFn(perturbed);
    return this.descriptorSimilarity(original, perturbedDesc);
  }

  private structurePerturbation(
    output: string,
    original: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
    rng: () => number,
  ): number {
    const lines = output.split('\n');
    if (lines.length < 4) return 0.5;

    // Swap a few pairs of non-adjacent lines
    const perturbed = [...lines];
    const swapCount = Math.min(2, Math.floor(lines.length / 4));
    for (let i = 0; i < swapCount; i++) {
      const a = Math.floor(rng() * lines.length);
      let b = Math.floor(rng() * lines.length);
      while (Math.abs(a - b) < 2) b = Math.floor(rng() * lines.length);
      [perturbed[a], perturbed[b]] = [perturbed[b], perturbed[a]];
    }

    const perturbedDesc = extractFn(perturbed.join('\n'));
    return this.descriptorSimilarity(original, perturbedDesc);
  }

  private noisePerturbation(
    output: string,
    original: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
    rng: () => number,
  ): number {
    const lines = output.split('\n');
    // Insert blank lines and comments at deterministic positions
    const perturbed = [...lines];
    const insertCount = Math.max(1, Math.floor(lines.length * 0.1));
    for (let i = 0; i < insertCount; i++) {
      const pos = Math.floor(rng() * perturbed.length);
      perturbed.splice(pos, 0, '// perturbation', '');
    }

    const perturbedDesc = extractFn(perturbed.join('\n'));
    return this.descriptorSimilarity(original, perturbedDesc);
  }

  private truncationPerturbation(
    output: string,
    original: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
  ): number {
    // Remove last 10% of content
    const cutPoint = Math.floor(output.length * 0.9);
    const perturbed = output.slice(0, cutPoint);

    if (perturbed.length < 20) return 0.3;

    const perturbedDesc = extractFn(perturbed);
    return this.descriptorSimilarity(original, perturbedDesc);
  }

  private redundancyPerturbation(
    output: string,
    original: BehaviorDescriptor,
    extractFn: (output: string) => BehaviorDescriptor,
  ): number {
    const lines = output.split('\n');
    if (lines.length < 6) return 0.5;

    // Duplicate a middle section
    const mid = Math.floor(lines.length / 2);
    const sectionSize = Math.max(1, Math.floor(lines.length * 0.1));
    const section = lines.slice(mid, mid + sectionSize);
    const perturbed = [...lines.slice(0, mid), ...section, ...lines.slice(mid)];

    const perturbedDesc = extractFn(perturbed.join('\n'));
    return this.descriptorSimilarity(original, perturbedDesc);
  }

  /**
   * Measure similarity between two descriptors.
   * Returns 1 = identical, 0 = completely different.
   */
  private descriptorSimilarity(a: BehaviorDescriptor, b: BehaviorDescriptor): number {
    const aMap = new Map(a.values.map(v => [v.axis, v.value]));
    let sumSq = 0;

    for (const bv of b.values) {
      const av = aMap.get(bv.axis) ?? 0.5;
      sumSq += (av - bv.value) ** 2;
    }

    const maxDist = Math.sqrt(b.values.length);
    const dist = Math.sqrt(sumSq);
    return maxDist > 0 ? 1 - (dist / maxDist) : 1;
  }

  /**
   * Create a seeded PRNG from the output string for deterministic perturbations.
   * Uses a simple mulberry32 implementation.
   */
  private seededRng(seed: string): () => number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return () => {
      h |= 0;
      h = h + 0x6D2B79F5 | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}
