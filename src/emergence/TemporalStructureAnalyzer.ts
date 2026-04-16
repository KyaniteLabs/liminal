/**
 * TemporalStructureAnalyzer — Phase 14
 *
 * Analyzes temporal and structural richness of creative outputs.
 * Detects multi-scale patterns, phase transitions, and temporal evolution.
 *
 * Works on the output string as a sequence of segments — no execution needed.
 * For generated code, it looks at the code structure; for animation/generative
 * art, it looks at temporal keywords and transition patterns.
 */

export interface TemporalStructureResult {
  /** Multi-scale structure richness (0 = flat, 1 = rich fractal structure) */
  structure: number;
  /** Temporal phase richness (0 = monotone, 1 = rich phase changes) */
  temporalRichness: number;
  /** Detected structure level (flat, single-scale, multi-scale, fractal) */
  structureLevel: 'flat' | 'single-scale' | 'multi-scale' | 'fractal';
  /** Number of detected phase transitions */
  phaseCount: number;
}

export interface TemporalStructureConfig {
  /** Number of segments to split the output into for analysis (default: 8) */
  segmentCount?: number;
  /** Minimum number of scales to consider multi-scale (default: 3) */
  multiScaleThreshold?: number;
}

const DEFAULT_SEGMENTS = 8;

export class TemporalStructureAnalyzer {
  private readonly segmentCount: number;

  constructor(config: TemporalStructureConfig = {}) {
    this.segmentCount = config.segmentCount ?? DEFAULT_SEGMENTS;
  }

  /**
   * Analyze temporal and structural properties of a creative output.
   */
  analyze(output: string): TemporalStructureResult {
    if (output.length < 20) {
      return { structure: 0.1, temporalRichness: 0.1, structureLevel: 'flat', phaseCount: 0 };
    }

    const segments = this.splitIntoSegments(output);
    const structure = this.computeStructure(output, segments);
    const temporalRichness = this.computeTemporalRichness(output, segments);
    const phaseCount = this.countPhaseTransitions(segments);
    const structureLevel = this.classifyStructure(structure);

    return { structure, temporalRichness, structureLevel, phaseCount };
  }

  /**
   * Multi-scale structure: detects self-similarity and hierarchical patterns.
   * Analyzes at multiple granularities and checks for consistent patterns.
   */
  private computeStructure(output: string, segments: string[]): number {
    // 1. Line-length variance (captures indentation/structure patterns)
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return 0.2;

    const lineLengths = lines.map(l => l.length);
    const lineVar = this.coefficientOfVariation(lineLengths);

    // 2. Nesting depth variance (captures hierarchical structure)
    const depths = lines.map(l => {
      const indent = l.match(/^(\s*)/)?.[1]?.length ?? 0;
      return indent;
    });
    const hasNesting = Math.max(...depths) - Math.min(...depths) > 2;

    // 3. Block structure: count distinct sections separated by blank lines
    const blocks = output.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    const blockCount = Math.min(1, blocks.length / 5);

    // 4. Multi-scale similarity: compare segment-level and sub-segment-level patterns
    const multiScale = this.computeMultiScaleSimilarity(segments);

    const structureScore =
      (Math.min(1, lineVar * 0.5) * 0.15) +
      ((hasNesting ? 0.3 : 0.1) * 0.2) +
      (blockCount * 0.25) +
      (multiScale * 0.4);

    return Math.min(1, Math.max(0, structureScore));
  }

  /**
   * Temporal richness: detects phase changes and evolution patterns.
   */
  private computeTemporalRichness(output: string, segments: string[]): number {
    // 1. Temporal keyword density
    const temporalPatterns = [
      /\b(animate|tween|transition|lerp|easing|frameCount|deltaTime)\b/gi,
      /\b(draw|update|loop|tick|step|evolve|cycle|phase)\b/gi,
      /\b(time|duration|speed|velocity|acceleration|period)\b/gi,
      /\b(setInterval|setTimeout|requestAnimationFrame)\b/gi,
      /\b(if.*time|if.*frame|if.*phase|if.*step)\b/gi,
    ];

    let temporalHits = 0;
    for (const pattern of temporalPatterns) {
      const matches = output.match(pattern);
      if (matches) temporalHits += matches.length;
    }
    const temporalDensity = Math.min(1, temporalHits / 10);

    // 2. Phase transitions: detect segments with different "character"
    const densities = segments.map(s => {
      const nonWs = s.replace(/\s/g, '').length;
      return nonWs / Math.max(s.length, 1);
    });

    let transitions = 0;
    for (let i = 1; i < densities.length; i++) {
      const delta = Math.abs(densities[i] - densities[i - 1]);
      if (delta > 0.15) transitions++;
    }
    const transitionScore = segments.length > 1 ? transitions / (segments.length - 1) : 0;

    // 3. Complexity gradient: does the output get more complex over time?
    const firstHalf = segments.slice(0, Math.floor(segments.length / 2));
    const secondHalf = segments.slice(Math.floor(segments.length / 2));
    const firstDensity = this.avgDensity(firstHalf);
    const secondDensity = this.avgDensity(secondHalf);
    const hasGradient = Math.abs(secondDensity - firstDensity) > 0.1;

    const temporalScore =
      (temporalDensity * 0.5) +
      (transitionScore * 0.3) +
      ((hasGradient ? 0.5 : 0) * 0.2);

    return Math.min(1, Math.max(0, temporalScore));
  }

  /**
   * Count phase transitions between segments.
   */
  private countPhaseTransitions(segments: string[]): number {
    const densities = segments.map(s => {
      const nonWs = s.replace(/\s/g, '').length;
      return nonWs / Math.max(s.length, 1);
    });

    let count = 0;
    for (let i = 1; i < densities.length; i++) {
      if (Math.abs(densities[i] - densities[i - 1]) > 0.15) count++;
    }
    return count;
  }

  /**
   * Compute self-similarity across scales.
   * Split segments into sub-segments and compare density patterns.
   */
  private computeMultiScaleSimilarity(segments: string[]): number {
    if (segments.length < 4) return 0.2;

    const densities = segments.map(s => {
      const nonWs = s.replace(/\s/g, '').length;
      return nonWs / Math.max(s.length, 1);
    });

    // Normalize densities to ranks to check pattern similarity, not value similarity
    const ranks = this.rank(densities);

    // Split into two halves and compare rank patterns
    const mid = Math.floor(ranks.length / 2);
    const firstHalf = ranks.slice(0, mid);
    const secondHalf = ranks.slice(mid, mid + firstHalf.length);

    if (firstHalf.length === 0 || secondHalf.length === 0) return 0.2;

    // Correlation between halves
    const correlation = this.pearsonCorrelation(firstHalf, secondHalf);

    // Negative correlation = fractal (inverted pattern), positive = repeating
    // Both indicate multi-scale structure
    return Math.min(1, Math.abs(correlation) * 1.5);
  }

  private classifyStructure(score: number): 'flat' | 'single-scale' | 'multi-scale' | 'fractal' {
    if (score < 0.25) return 'flat';
    if (score < 0.5) return 'single-scale';
    if (score < 0.75) return 'multi-scale';
    return 'fractal';
  }

  private splitIntoSegments(output: string): string[] {
    const segLen = Math.max(1, Math.floor(output.length / this.segmentCount));
    const segments: string[] = [];
    for (let i = 0; i < this.segmentCount; i++) {
      const start = i * segLen;
      const end = i === this.segmentCount - 1 ? output.length : (i + 1) * segLen;
      if (start < output.length) {
        segments.push(output.slice(start, end));
      }
    }
    return segments;
  }

  private coefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private avgDensity(segments: string[]): number {
    if (segments.length === 0) return 0;
    return segments.reduce((sum, s) => {
      const nonWs = s.replace(/\s/g, '').length;
      return sum + nonWs / Math.max(s.length, 1);
    }, 0) / segments.length;
  }

  private rank(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    return values.map(v => sorted.indexOf(v));
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    const den = Math.sqrt(denX * denY);
    return den === 0 ? NaN : num / den;
  }
}
