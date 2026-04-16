/**
 * PreferenceDatasetBuilder — Phase 15
 *
 * Builds a training dataset from user preference interactions:
 * pairwise selections, pins, favorites, branches, compost saves,
 * "more like this" actions, and accepted descendants.
 *
 * Outputs structured preference pairs suitable for taste model training.
 */

import type { ArchiveEntry, PreferenceAction } from '../emergence/types.js';

export interface PreferencePair {
  /** The preferred artifact */
  winner: { id: string; descriptor: number[]; quality: number };
  /** The less-preferred artifact */
  loser: { id: string; descriptor: number[]; quality: number };
  /** What kind of preference this represents */
  source: PreferenceAction;
  /** How confident we are in this signal (0–1) */
  confidence: number;
  /** When the preference was captured */
  capturedAt: string;
}

export interface PreferenceDataset {
  pairs: PreferencePair[];
  /** Summary statistics */
  stats: {
    totalPairs: number;
    uniqueArtifacts: number;
    sources: Record<string, number>;
    avgConfidence: number;
  };
}

export interface PreferenceDatasetBuilderConfig {
  /** Minimum confidence for including a pair (default: 0.3) */
  minConfidence?: number;
  /** Whether to include inferred preferences (default: true) */
  includeInferred?: boolean;
}

const DEFAULT_MIN_CONFIDENCE = 0.3;

export class PreferenceDatasetBuilder {
  private readonly minConfidence: number;
  private readonly includeInferred: boolean;

  constructor(config: PreferenceDatasetBuilderConfig = {}) {
    this.minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.includeInferred = config.includeInferred ?? true;
  }

  /**
   * Build a preference dataset from archive entries and their preference records.
   */
  build(entries: ArchiveEntry[]): PreferenceDataset {
    const pairs: PreferencePair[] = [];

    for (const entry of entries) {
      if (!entry.preference) continue;

      // Direct pairwise comparisons
      if (entry.preference.action === 'pairwise-a' || entry.preference.action === 'pairwise-b') {
        const other = entries.find(e => e.id === entry.preference!.comparedTo);
        if (!other) continue;

        const winner = entry.preference.action === 'pairwise-a' ? entry : other;
        const loser = entry.preference.action === 'pairwise-a' ? other : entry;

        pairs.push(this.makePair(winner, loser, entry.preference.action, 1.0, entry.preference.capturedAt));
      }

      // Pin/favorite → preferred over unpinned entries
      if (entry.preference.action === 'pin' || entry.preference.action === 'favorite') {
        if (!this.includeInferred) continue;
        const unpinned = entries.filter(e =>
          e.id !== entry.id && e.preference?.action !== 'pin' && e.preference?.action !== 'favorite',
        );
        // Compare against up to 3 unpinned neighbors
        const neighbors = unpinned.slice(0, 3);
        for (const neighbor of neighbors) {
          pairs.push(this.makePair(
            entry, neighbor, entry.preference.action,
            0.6, // Inferred preference has lower confidence
            entry.preference!.capturedAt,
          ));
        }
      }

      // Branch → user preferred parent enough to branch from it
      if (entry.preference.action === 'branch' && this.includeInferred) {
        // The branched artifact is preferred over random others in the same niche
        const sameNiche = entries.filter(e => e.id !== entry.id);
        const neighbors = sameNiche.slice(0, 2);
        for (const neighbor of neighbors) {
          pairs.push(this.makePair(
            entry, neighbor, 'branch', 0.5,
            entry.preference!.capturedAt,
          ));
        }
      }

      // More-like-this → explicit positive signal
      if (entry.preference.action === 'more-like-this') {
        if (!this.includeInferred) continue;
        const rejected = entries.filter(e =>
          e.id !== entry.id && e.preference?.action === 'less-like-this',
        );
        for (const r of rejected.slice(0, 2)) {
          pairs.push(this.makePair(
            entry, r, 'more-like-this', 0.8,
            entry.preference!.capturedAt,
          ));
        }
      }
    }

    const filtered = pairs.filter(p => p.confidence >= this.minConfidence);
    const uniqueIds = new Set<string>();
    for (const p of filtered) {
      uniqueIds.add(p.winner.id);
      uniqueIds.add(p.loser.id);
    }

    const sources: Record<string, number> = {};
    let totalConf = 0;
    for (const p of filtered) {
      sources[p.source] = (sources[p.source] ?? 0) + 1;
      totalConf += p.confidence;
    }

    return {
      pairs: filtered,
      stats: {
        totalPairs: filtered.length,
        uniqueArtifacts: uniqueIds.size,
        sources,
        avgConfidence: filtered.length > 0 ? totalConf / filtered.length : 0,
      },
    };
  }

  /**
   * Add a synthetic preference pair (e.g., from quality scoring).
   */
  addSyntheticPair(
    winner: ArchiveEntry,
    loser: ArchiveEntry,
    confidence: number,
  ): PreferencePair {
    return this.makePair(winner, loser, 'pairwise-a', confidence, new Date().toISOString());
  }

  private makePair(
    winner: ArchiveEntry,
    loser: ArchiveEntry,
    source: PreferenceAction,
    confidence: number,
    capturedAt: string,
  ): PreferencePair {
    return {
      winner: {
        id: winner.id,
        descriptor: winner.descriptor.values.map(v => v.value),
        quality: winner.qualityScore,
      },
      loser: {
        id: loser.id,
        descriptor: loser.descriptor.values.map(v => v.value),
        quality: loser.qualityScore,
      },
      source,
      confidence,
      capturedAt,
    };
  }
}
