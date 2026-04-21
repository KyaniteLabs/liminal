/**
 * CompostRehydrator — Phase 15
 *
 * Rehydrates compost fragments into viable branch candidates and
 * mutation templates. Distinguishes "bad result" from "valuable fragment"
 * by scoring fragments on structural richness and motif density.
 */

import type { CompostFragment } from './types.js';

export interface RehydratedCandidate {
  /** The rehydrated content */
  content: string;
  /** Source fragment IDs */
  sourceIds: string[];
  /** How rich the fragment is in reusable motifs */
  motifDensity: number;
  /** Structural complexity (0–1) */
  complexity: number;
  /** Whether this is a complete candidate or a template fragment */
  isComplete: boolean;
}

export interface CompostRehydratorConfig {
  /** Minimum motif density to consider a fragment reusable (default: 0.3) */
  minMotifDensity?: number;
  /** Maximum fragments to rehydrate per call (default: 10) */
  maxPerBatch?: number;
}

const DEFAULT_MIN_MOTIF = 0.3;
const DEFAULT_MAX_BATCH = 10;

export class CompostRehydrator {
  private readonly minMotifDensity: number;
  private readonly maxPerBatch: number;

  constructor(config: CompostRehydratorConfig = {}) {
    this.minMotifDensity = config.minMotifDensity ?? DEFAULT_MIN_MOTIF;
    this.maxPerBatch = config.maxPerBatch ?? DEFAULT_MAX_BATCH;
  }

  /**
   * Find fragments worth rehydrating from the compost heap.
   */
  findRehydratable(fragments: CompostFragment[]): CompostFragment[] {
    return fragments
      .filter(f => {
        const density = this.computeMotifDensity(f.content);
        return density >= this.minMotifDensity;
      })
      .sort((a, b) => this.computeMotifDensity(b.content) - this.computeMotifDensity(a.content))
      .slice(0, this.maxPerBatch);
  }

  /**
   * Rehydrate a set of fragments into candidate content.
   * Merges fragments by domain, removing duplicates and
   * combining complementary pieces.
   */
  rehydrate(fragments: CompostFragment[]): RehydratedCandidate[] {
    const candidates: RehydratedCandidate[] = [];

    // Group by domain for coherent rehydration
    const byDomain = new Map<string, CompostFragment[]>();
    for (const f of fragments) {
      const group = byDomain.get(f.domain) ?? [];
      group.push(f);
      byDomain.set(f.domain, group);
    }

    for (const [, domainFrags] of byDomain) {
      // Merge fragments in the same domain
      const merged = this.mergeFragments(domainFrags);
      const complexity = this.computeComplexity(merged);

      candidates.push({
        content: merged,
        sourceIds: domainFrags.map(f => f.id),
        motifDensity: this.computeMotifDensity(merged),
        complexity,
        isComplete: complexity > 0.5,
      });
    }

    // Also try cross-domain pairs
    const domains = [...byDomain.keys()];
    if (domains.length >= 2) {
      const topA = byDomain.get(domains[0])?.slice(0, 2) ?? [];
      const topB = byDomain.get(domains[1])?.slice(0, 2) ?? [];
      const crossContent = this.mergeFragments([...topA, ...topB]);
      candidates.push({
        content: crossContent,
        sourceIds: [...topA, ...topB].map(f => f.id),
        motifDensity: this.computeMotifDensity(crossContent),
        complexity: this.computeComplexity(crossContent),
        isComplete: false, // Cross-domain is a template, not complete
      });
    }

    return candidates.slice(0, this.maxPerBatch);
  }

  /**
   * Score a fragment's value (distinguishes bad result from valuable fragment).
   */
  scoreFragment(fragment: CompostFragment): number {
    const density = this.computeMotifDensity(fragment.content);
    const complexity = this.computeComplexity(fragment.content);
    const hasScore = fragment.score ?? 0;
    const tagBonus = Math.min(0.3, fragment.tags.length * 0.05);

    return (density * 0.4) + (complexity * 0.3) + (hasScore * 0.2) + tagBonus;
  }

  private mergeFragments(fragments: CompostFragment[]): string {
    // Remove duplicate lines across fragments
    const seen = new Set<string>();
    const lines: string[] = [];

    for (const f of fragments) {
      for (const line of f.content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          lines.push(line);
        }
      }
    }

    return lines.join('\n');
  }

  private computeMotifDensity(content: string): number {
    if (content.length < 10) return 0;

    // Count structural motifs: function/class definitions, control flow, patterns
    const motifs = [
      /\b(function|class|const|let|var)\s+\w+/g,
      /\b(if|else|for|while|switch)\b/g,
      /\b(draw|render|update|animate|loop)\b/g,
      /\b(setup|init|create|build|compose)\b/g,
      /\{[^}]{10,}\}/g,  // Block expressions
      /\b\d+\.?\d*\b/g,  // Numeric literals
    ];

    let totalMatches = 0;
    for (const pattern of motifs) {
      const matches = content.match(pattern);
      if (matches) totalMatches += matches.length;
    }

    // Normalize by content length (per 100 chars)
    return Math.min(1, totalMatches / (content.length / 100));
  }

  private computeComplexity(content: string): number {
    if (content.length < 10) return 0;

    const lines = content.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return 0.1;

    // Nesting depth variance
    const depths = lines.map(l => (l.match(/^(\s*)/)?.[1]?.length ?? 0));
    const maxDepth = Math.max(...depths);
    const hasNesting = maxDepth > 2;

    // Line length variance
    const lengths = lines.map(l => l.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;

    return Math.min(1,
      (hasNesting ? 0.3 : 0.1) +
      (Math.min(1, maxDepth / 10) * 0.3) +
      (Math.min(1, Math.sqrt(variance) / 30) * 0.4),
    );
  }
}
