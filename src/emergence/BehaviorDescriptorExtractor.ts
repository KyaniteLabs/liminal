/**
 * BehaviorDescriptorExtractor — Phase 13E
 *
 * Extracts behavior descriptor vectors from creative outputs.
 * Starts with heuristic-based extraction (no LLM required for high-throughput).
 * Each descriptor maps an artifact onto a continuous 0–1 axis in behavior space.
 */

import type {
  DescriptorAxis,
  DescriptorValue,
  BehaviorDescriptor,
} from './types.js';

/** All available axes with their display labels. */
const AXIS_LABELS: Record<DescriptorAxis, string> = {
  'order-chaos': 'Order ↔ Chaos',
  'sparse-dense': 'Sparse ↔ Dense',
  'symmetry-asymmetry': 'Symmetry ↔ Asymmetry',
  'smooth-bursty': 'Smooth ↔ Bursty',
  'static-evolving': 'Static ↔ Evolving',
  'harmonic-dissonant': 'Harmonic ↔ Dissonant',
};

const ALL_AXES = Object.keys(AXIS_LABELS) as DescriptorAxis[];

export interface BehaviorDescriptorExtractorConfig {
  /** Which axes to extract (default: all six) */
  axes?: DescriptorAxis[];
  /** Source label for provenance tracking */
  source?: string;
}

export class BehaviorDescriptorExtractor {
  private readonly axes: DescriptorAxis[];
  private readonly source: string;

  constructor(config: BehaviorDescriptorExtractorConfig = {}) {
    this.axes = config.axes ?? ALL_AXES;
    this.source = config.source ?? 'heuristic-v1';
  }

  /**
   * Extract a behavior descriptor from a creative output string.
   * Uses structural heuristics — no LLM calls needed.
   */
  extract(output: string, metadata?: Record<string, unknown>): BehaviorDescriptor {
    const values: DescriptorValue[] = this.axes.map(axis => ({
      axis,
      value: this.computeAxis(axis, output, metadata),
    }));

    return {
      values,
      source: this.source,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Compute a single descriptor axis value (0–1) using heuristics.
   */
  private computeAxis(axis: DescriptorAxis, output: string, metadata?: Record<string, unknown>): number {
    const len = output.length;

    switch (axis) {
      case 'order-chaos':
        return this.orderChaos(output, len);

      case 'sparse-dense':
        return this.sparseDense(output, len);

      case 'symmetry-asymmetry':
        return this.symmetryAsymmetry(output);

      case 'smooth-bursty':
        return this.smoothBursty(output);

      case 'static-evolving':
        return this.staticEvolving(output, metadata);

      case 'harmonic-dissonant':
        return this.harmonicDissonant(output);

      default:
        return 0.5;
    }
  }

  /** High order = repetitive patterns, consistent indentation, regular structure. High chaos = irregular. */
  private orderChaos(output: string, len: number): number {
    if (len < 10) return 0.5;

    const lines = output.split('\n');
    const lineLengths = lines.map(l => l.length);
    if (lineLengths.length < 2) return 0.3;

    // Coefficient of variation of line lengths — low CV = ordered, high CV = chaotic
    const mean = lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length;
    if (mean === 0) return 0.5;
    const variance = lineLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lineLengths.length;
    const cv = Math.sqrt(variance) / mean;

    // Normalize: CV of 0 = 0 (ordered), CV > 2 = 1 (chaotic)
    return Math.min(1, cv / 2);
  }

  /** High density = lots of content per line, lots of symbols. Low = whitespace-heavy, sparse. */
  private sparseDense(output: string, len: number): number {
    if (len === 0) return 0;

    // Ratio of non-whitespace to total characters
    const nonWhitespace = output.replace(/\s/g, '').length;
    const ratio = nonWhitespace / len;

    // Also factor in average line length
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    const avgLineLen = lines.length > 0
      ? lines.reduce((sum, l) => sum + l.length, 0) / lines.length
      : 0;

    // Combine: high non-whitespace ratio + long lines = dense
    const densityScore = (ratio * 0.6) + (Math.min(avgLineLen / 80, 1) * 0.4);
    return Math.min(1, Math.max(0, densityScore));
  }

  /** High asymmetry = significant differences between first half and second half of content. */
  private symmetryAsymmetry(output: string): number {
    if (output.length < 20) return 0.5;

    const half = Math.floor(output.length / 2);
    const firstHalf = output.slice(0, half);
    const secondHalf = output.slice(half);

    // Character frequency comparison
    const freqA = this.charFrequency(firstHalf);
    const freqB = this.charFrequency(secondHalf);

    const allChars = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
    let diffSum = 0;
    let totalSum = 0;

    for (const ch of allChars) {
      const a = freqA[ch] ?? 0;
      const b = freqB[ch] ?? 0;
      diffSum += Math.abs(a - b);
      totalSum += a + b;
    }

    if (totalSum === 0) return 0.5;
    return Math.min(1, (diffSum / totalSum) * 2);
  }

  /** High bursty = large variations in content density across segments. */
  private smoothBursty(output: string): number {
    if (output.length < 40) return 0.5;

    const segments = this.splitSegments(output, 8);
    const densities = segments.map(s => {
      const trimmed = s.replace(/\s/g, '').length;
      return trimmed / Math.max(s.length, 1);
    });

    if (densities.length < 2) return 0.5;

    // Calculate max delta between adjacent segments
    let maxDelta = 0;
    for (let i = 1; i < densities.length; i++) {
      maxDelta = Math.max(maxDelta, Math.abs(densities[i] - densities[i - 1]));
    }

    return Math.min(1, maxDelta * 3);
  }

  /** High evolving = content contains temporal/animation/state-change keywords or patterns. */
  private staticEvolving(output: string, metadata?: Record<string, unknown>): number {
    const evolvingSignals = [
      /animate|tween|transition|lerp|easing|frameCount|deltaTime|requestAnimationFrame/gi,
      /draw\(|update\(|loop\(|tick\(|step\(|evolve/gi,
      /time|duration|speed|velocity|acceleration|phase/gi,
      /\.map\(|\.forEach\(|setInterval|setTimeout/gi,
    ];

    let matchCount = 0;
    for (const pattern of evolvingSignals) {
      const matches = output.match(pattern);
      if (matches) matchCount += matches.length;
    }

    // Check metadata for animation flags
    const metaBonus = metadata?.hasAnimation ? 0.2 : 0;
    const metaFrames = typeof metadata?.frameCount === 'number' && (metadata.frameCount as number) > 1 ? 0.2 : 0;

    // 0 matches = 0.1 (static), 5+ matches = 1.0 (highly evolving)
    const signalScore = Math.min(1, matchCount / 5);
    return Math.min(1, signalScore + metaBonus + metaFrames);
  }

  /** High dissonance = content has sharp contrasts, mixed paradigms, irregular patterns. */
  private harmonicDissonant(output: string): number {
    if (output.length < 20) return 0.5;

    // Look for paradigm mixing: different bracket types, mixed camelCase/snake_case, etc.
    const hasBraces = (output.match(/\{/g) ?? []).length;
    const hasBrackets = (output.match(/\[/g) ?? []).length;
    const hasParens = (output.match(/\(/g) ?? []).length;

    const camelCase = (output.match(/[a-z][A-Z]/g) ?? []).length;
    const snakeCase = (output.match(/_/g) ?? []).length;

    // High dissonance = mixed naming conventions AND mixed bracket types
    const namingMix = camelCase > 0 && snakeCase > 0 ? 0.3 : 0;
    const bracketVariety = [hasBraces, hasBrackets, hasParens].filter(n => n > 0).length / 3;

    // Sharp transitions: consecutive lines with very different character counts
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    let sharpTransitions = 0;
    for (let i = 1; i < lines.length; i++) {
      const ratio = lines[i].length / Math.max(lines[i - 1].length, 1);
      if (ratio > 3 || ratio < 0.33) sharpTransitions++;
    }
    const transitionScore = lines.length > 1 ? Math.min(1, sharpTransitions / (lines.length * 0.3)) : 0;

    return Math.min(1, namingMix + (bracketVariety * 0.3) + (transitionScore * 0.4));
  }

  private charFrequency(str: string): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const ch of str) {
      freq[ch] = (freq[ch] ?? 0) + 1;
    }
    return freq;
  }

  private splitSegments(str: string, count: number): string[] {
    const segLen = Math.floor(str.length / count);
    const segments: string[] = [];
    for (let i = 0; i < count; i++) {
      segments.push(str.slice(i * segLen, (i + 1) * segLen));
    }
    return segments;
  }

  /** Get all available axes. */
  getAvailableAxes(): DescriptorAxis[] {
    return [...this.axes];
  }
}
