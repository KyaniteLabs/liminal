/**
 * CrossModalTransfer — Phase 15
 *
 * Transfers creative patterns across domains (e.g., visual → audio,
 * code → animation). Extracts structural motifs from one domain and
 * applies them as constraints or seeds in another.
 */

import type { ArchiveEntry } from '../emergence/types.js';

export interface CrossModalMapping {
  /** Source domain */
  sourceDomain: string;
  /** Target domain */
  targetDomain: string;
  /** Transferred descriptor pattern */
  transferredDescriptor: number[];
  /** How structurally similar the source and target patterns are */
  structuralSimilarity: number;
}

export interface CrossModalTransferConfig {
  /** Minimum descriptor similarity for valid transfer (default: 0.3) */
  minSimilarity?: number;
}

const DEFAULT_MIN_SIMILARITY = 0.3;

export class CrossModalTransfer {
  private readonly minSimilarity: number;

  constructor(config: CrossModalTransferConfig = {}) {
    this.minSimilarity = config.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  }

  /**
   * Find transfer opportunities between artifacts in different domains.
   * Returns mappings where structural patterns can cross domains.
   */
  findTransfers(entries: ArchiveEntry[]): CrossModalMapping[] {
    const byDomain = this.groupByDomain(entries);
    const domains = Object.keys(byDomain);
    if (domains.length < 2) return [];

    const mappings: CrossModalMapping[] = [];

    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const sourceEntries = byDomain[domains[i]];
        const targetEntries = byDomain[domains[j]];

        for (const source of sourceEntries) {
          for (const target of targetEntries) {
            const similarity = this.structuralSimilarity(
              source.descriptor.values.map(v => v.value),
              target.descriptor.values.map(v => v.value),
            );

            if (similarity >= this.minSimilarity) {
              // Transfer: blend source descriptor into target domain
              const transferred = this.transfer(source, target);
              mappings.push({
                sourceDomain: domains[i],
                targetDomain: domains[j],
                transferredDescriptor: transferred,
                structuralSimilarity: similarity,
              });
            }
          }
        }
      }
    }

    return mappings.sort((a, b) => b.structuralSimilarity - a.structuralSimilarity);
  }

  /**
   * Transfer structural patterns from source to target domain.
   * Takes the source's descriptor pattern and shifts it toward the target's
   * domain constraints while preserving the structural signature.
   */
  transfer(source: ArchiveEntry, target: ArchiveEntry): number[] {
    const srcDesc = source.descriptor.values.map(v => v.value);
    const tgtDesc = target.descriptor.values.map(v => v.value);

    // Weighted blend: 60% source structure + 40% target domain adaptation
    const dim = Math.max(srcDesc.length, tgtDesc.length);
    const result: number[] = [];
    for (let i = 0; i < dim; i++) {
      const sv = srcDesc[i] ?? 0.5;
      const tv = tgtDesc[i] ?? 0.5;
      result.push(Math.max(0, Math.min(1, sv * 0.6 + tv * 0.4)));
    }
    return result;
  }

  /**
   * Compute structural similarity between two descriptor vectors.
   * Uses cosine similarity normalized to 0–1 range.
   */
  private structuralSimilarity(a: number[], b: number[]): number {
    const dim = Math.max(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < dim; i++) {
      const va = a[i] ?? 0.5;
      const vb = b[i] ?? 0.5;
      dotProduct += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;

    const cosine = dotProduct / denom;
    // Cosine is in [-1, 1] → map to [0, 1]
    return (cosine + 1) / 2;
  }

  private groupByDomain(entries: ArchiveEntry[]): Record<string, ArchiveEntry[]> {
    const groups: Record<string, ArchiveEntry[]> = {};
    for (const entry of entries) {
      const domain = entry.artifactRef.kind ?? 'unknown';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(entry);
    }
    return groups;
  }
}
