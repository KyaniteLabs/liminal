/**
 * MotifIndexer — Phase 15
 *
 * Indexes reusable motifs, fragments, and failure patterns from compost.
 * Builds a searchable index of structural patterns that can be reused
 * in new branch candidates and mutation templates.
 */

import type { CompostFragment } from './types.js';

export interface MotifEntry {
  /** Normalized pattern string */
  pattern: string;
  /** Fragments containing this motif */
  fragmentIds: string[];
  /** How often this pattern appears */
  frequency: number;
  /** Domains where this pattern appears */
  domains: string[];
  /** Whether this is a success or failure pattern */
  kind: 'success' | 'failure' | 'structural';
}

export interface MotifIndexResult {
  motifs: MotifEntry[];
  /** Total unique motifs found */
  uniqueCount: number;
  /** Most common motif pattern */
  topPattern: string | null;
}

export interface MotifIndexerConfig {
  /** Minimum pattern length to index (default: 4) */
  minPatternLength?: number;
  /** Maximum motifs to track (default: 200) */
  maxMotifs?: number;
}

const DEFAULT_MIN_LEN = 4;
const DEFAULT_MAX_MOTIFS = 200;

export class MotifIndexer {
  private readonly motifs: Map<string, MotifEntry> = new Map();
  private readonly minPatternLength: number;
  private readonly maxMotifs: number;

  constructor(config: MotifIndexerConfig = {}) {
    this.minPatternLength = config.minPatternLength ?? DEFAULT_MIN_LEN;
    this.maxMotifs = config.maxMotifs ?? DEFAULT_MAX_MOTIFS;
  }

  /**
   * Index motifs from a set of compost fragments.
   */
  index(fragments: CompostFragment[]): MotifIndexResult {
    for (const fragment of fragments) {
      const patterns = this.extractPatterns(fragment.content);
      for (const pattern of patterns) {
        const existing = this.motifs.get(pattern);
        if (existing) {
          existing.frequency++;
          existing.fragmentIds.push(fragment.id);
          if (!existing.domains.includes(fragment.domain)) {
            existing.domains.push(fragment.domain);
          }
        } else {
          if (this.motifs.size >= this.maxMotifs) continue;
          this.motifs.set(pattern, {
            pattern,
            fragmentIds: [fragment.id],
            frequency: 1,
            domains: [fragment.domain],
            kind: this.classifyPattern(pattern, fragment),
          });
        }
      }
    }

    const sorted = [...this.motifs.values()].sort((a, b) => b.frequency - a.frequency);
    return {
      motifs: sorted,
      uniqueCount: this.motifs.size,
      topPattern: sorted.length > 0 ? sorted[0].pattern : null,
    };
  }

  /**
   * Search for motifs matching a query pattern.
   */
  search(query: string, limit?: number): MotifEntry[] {
    const normalized = query.toLowerCase().trim();
    const results: MotifEntry[] = [];

    for (const entry of this.motifs.values()) {
      if (entry.pattern.includes(normalized) || normalized.includes(entry.pattern)) {
        results.push(entry);
      }
    }

    return results
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit ?? 20);
  }

  /**
   * Get motifs that appear across multiple domains (cross-domain patterns).
   */
  getCrossDomainMotifs(): MotifEntry[] {
    return [...this.motifs.values()]
      .filter(m => m.domains.length >= 2)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get motifs classified as failure patterns.
   */
  getFailurePatterns(): MotifEntry[] {
    return [...this.motifs.values()]
      .filter(m => m.kind === 'failure')
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Clear the motif index.
   */
  clear(): void {
    this.motifs.clear();
  }

  private extractPatterns(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n').filter(l => l.trim().length >= this.minPatternLength);

    // Extract structural patterns: normalized line shapes
    for (const line of lines) {
      const normalized = this.normalizePattern(line);
      if (normalized.length >= this.minPatternLength) {
        patterns.push(normalized);
      }
    }

    // Extract block patterns: consecutive line shapes
    for (let i = 0; i < lines.length - 1; i++) {
      const pair = this.normalizePattern(lines[i]) + '|' + this.normalizePattern(lines[i + 1]);
      if (pair.length >= this.minPatternLength * 2) {
        patterns.push(pair);
      }
    }

    return patterns;
  }

  private normalizePattern(line: string): string {
    return line
      .trim()
      .replace(/\b\d+\.?\d*\b/g, 'N')        // Numbers → N
      .replace(/\b[a-zA-Z_]\w*\b/g, 'ID')     // Identifiers → ID
      .replace(/\s+/g, ' ')                     // Collapse whitespace
      .replace(/".*?"/g, '"S"')                 // Strings → "S"
      .replace(/'.*?'/g, "'S'");
  }

  private classifyPattern(pattern: string, _fragment: CompostFragment): MotifEntry['kind'] {
    // Failure patterns: common error-like structures
    const failureSignals = ['error', 'catch', 'fail', 'undefined', 'null', 'NaN'];
    const lower = pattern.toLowerCase();
    if (failureSignals.some(s => lower.includes(s))) return 'failure';

    // Structural patterns: control flow, declarations
    const structuralSignals = ['if', 'for', 'while', 'function', 'class', 'return'];
    if (structuralSignals.some(s => lower.includes(s))) return 'structural';

    return 'success';
  }
}
