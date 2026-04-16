/**
 * NoveltyIndex — Phase 14
 *
 * Computes novelty scores for artifacts relative to the archive.
 * An artifact is novel if its behavior descriptor is far from existing
 * archive entries in descriptor space.
 *
 * Uses k-nearest-neighbor distance in descriptor space.
 * No LLM calls — pure vector math for high throughput.
 */

import type { ArchiveEntry, BehaviorDescriptor } from './types.js';

export interface NoveltyIndexConfig {
  /** Number of nearest neighbors to consider (default: 5) */
  k?: number;
  /** Maximum novelty score when no archive entries exist (default: 1.0) */
  defaultNovelty?: number;
}

const DEFAULT_K = 5;
const DEFAULT_NOVELTY = 1.0;

export class NoveltyIndex {
  private readonly k: number;
  private readonly defaultNovelty: number;

  constructor(config: NoveltyIndexConfig = {}) {
    this.k = config.k ?? DEFAULT_K;
    this.defaultNovelty = config.defaultNovelty ?? DEFAULT_NOVELTY;
  }

  /**
   * Compute novelty of a descriptor against the archive.
   * Returns 0–1 where 1 = totally novel, 0 = duplicate.
   */
  score(descriptor: BehaviorDescriptor, archive: ArchiveEntry[]): number {
    if (archive.length === 0) return this.defaultNovelty;

    const distances = archive
      .map(entry => this.euclidean(descriptor, entry.descriptor))
      .sort((a, b) => a - b);

    // Average distance to k nearest neighbors
    const k = Math.min(this.k, distances.length);
    const avgDist = distances.slice(0, k).reduce((s, d) => s + d, 0) / k;

    // Normalize: max possible distance in 6D 0–1 space is sqrt(6) ≈ 2.449
    // A novelty of 1.0 means "far from everything"
    const maxDist = Math.sqrt(descriptor.values.length);
    const normalized = maxDist > 0 ? avgDist / maxDist : 0;

    return Math.min(1, Math.max(0, normalized));
  }

  /**
   * Find the nearest neighbors in the archive for a descriptor.
   */
  findNearest(descriptor: BehaviorDescriptor, archive: ArchiveEntry[], count: number = 5): Array<{ entry: ArchiveEntry; distance: number }> {
    return archive
      .map(entry => ({ entry, distance: this.euclidean(descriptor, entry.descriptor) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count);
  }

  /**
   * Compute archive coverage: fraction of descriptor space that is populated.
   * Uses a simple grid-based estimate.
   */
  computeCoverage(archive: ArchiveEntry[], binsPerAxis: number = 10): number {
    if (archive.length === 0) return 0;

    const axisCount = archive[0]?.descriptor.values.length ?? 6;
    const occupiedBins = new Set<string>();

    for (const entry of archive) {
      const binKey = entry.descriptor.values
        .map(v => {
          const bin = Math.min(Math.floor(v.value * binsPerAxis), binsPerAxis - 1);
          return `${v.axis}:${bin}`;
        })
        .join('|');
      occupiedBins.add(binKey);
    }

    const totalBins = Math.pow(binsPerAxis, axisCount);
    return occupiedBins.size / totalBins;
  }

  /**
   * Compute distance between two descriptors.
   */
  private euclidean(a: BehaviorDescriptor, b: BehaviorDescriptor): number {
    const aMap = new Map(a.values.map(v => [v.axis, v.value]));

    let sumSq = 0;
    for (const bv of b.values) {
      const av = aMap.get(bv.axis) ?? 0.5;
      sumSq += (av - bv.value) ** 2;
    }

    // Add axes present in a but not in b
    const bAxes = new Set(b.values.map(v => v.axis));
    for (const av of a.values) {
      if (!bAxes.has(av.axis)) {
        sumSq += (av.value - 0.5) ** 2;
      }
    }

    return Math.sqrt(sumSq);
  }
}
