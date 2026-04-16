/**
 * DreamPlanner — Phase 15
 *
 * Plans dream tasks based on archive state and strategy.
 * Selects artifact pairs for recombination based on novelty gaps,
 * fertile lineages, and niche diversity.
 */

import type { ArchiveCell, ArchiveEntry, DescriptorAxis } from '../emergence/types.js';
import type { DreamStrategy, DreamTask } from './DreamQueue.js';
import { NoveltyIndex } from '../emergence/NoveltyIndex.js';

export interface DreamPlan {
  tasks: Array<{
    strategy: DreamStrategy;
    sources: DreamTask['sources'];
    priority: number;
    reason: string;
  }>;
}

export interface DreamPlannerConfig {
  /** Maximum tasks per planning cycle (default: 8) */
  maxTasks?: number;
  /** Minimum novelty gap to trigger distant-niche strategy (default: 0.4) */
  distantNicheThreshold?: number;
}

const DEFAULT_MAX_TASKS = 8;
const DEFAULT_DISTANT_THRESHOLD = 0.4;

export class DreamPlanner {
  private readonly noveltyIndex: NoveltyIndex;
  private readonly maxTasks: number;
  private readonly distantThreshold: number;

  constructor(config: DreamPlannerConfig = {}) {
    this.noveltyIndex = new NoveltyIndex();
    this.maxTasks = config.maxTasks ?? DEFAULT_MAX_TASKS;
    this.distantThreshold = config.distantNicheThreshold ?? DEFAULT_DISTANT_THRESHOLD;
  }

  /**
   * Plan dream tasks from the current archive state.
   */
  plan(cells: ArchiveCell[], _axes: DescriptorAxis[]): DreamPlan {
    const entries = cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry => e !== undefined);

    const tasks: DreamPlan['tasks'] = [];

    if (entries.length < 2) return { tasks };

    // 1. Elite × Elite: pair highest-quality with most novel
    const byQuality = [...entries].sort((a, b) => b.qualityScore - a.qualityScore);
    const archive = entries;
    const byNovelty = [...entries].sort((a, b) =>
      this.noveltyIndex.score(b.descriptor, archive) - this.noveltyIndex.score(a.descriptor, archive),
    );

    const topQuality = byQuality[0];
    const topNovel = byNovelty.find(e => e.id !== topQuality.id) ?? byQuality[1];
    if (topQuality && topNovel) {
      tasks.push({
        strategy: 'elite-x-elite',
        sources: [this.toSource(topQuality), this.toSource(topNovel)],
        priority: 0.9,
        reason: 'Recombine best quality with most novel',
      });
    }

    // 2. Distant niche × distant niche: pair from opposite corners
    if (entries.length >= 4) {
      const pairs = this.findDistantPairs(entries);
      for (const pair of pairs.slice(0, 2)) {
        if (tasks.length >= this.maxTasks) break;
        tasks.push({
          strategy: 'distant-niche-x-distant',
          sources: [this.toSource(pair[0]), this.toSource(pair[1])],
          priority: 0.7,
          reason: `Bridge distant niches (distance: ${pair[2].toFixed(2)})`,
        });
      }
    }

    // 3. Cross-modal: pair artifacts from different domains
    const domainGroups = this.groupByDomain(entries);
    const domains = Object.keys(domainGroups);
    if (domains.length >= 2) {
      for (let i = 0; i < domains.length - 1 && tasks.length < this.maxTasks; i++) {
        const groupA = domainGroups[domains[i]];
        const groupB = domainGroups[domains[i + 1]];
        if (groupA.length > 0 && groupB.length > 0) {
          tasks.push({
            strategy: 'cross-modal',
            sources: [this.toSource(groupA[0]), this.toSource(groupB[0])],
            priority: 0.6,
            reason: `Cross-modal: ${domains[i]} × ${domains[i + 1]}`,
          });
        }
      }
    }

    // 4. Elite × compost: fill remaining slots
    while (tasks.length < this.maxTasks && tasks.length < entries.length) {
      const entry = entries[tasks.length];
      tasks.push({
        strategy: 'elite-x-compost',
        sources: [this.toSource(entry)],
        priority: 0.4,
        reason: `Recombine with compost material`,
      });
    }

    return { tasks };
  }

  private toSource(entry: ArchiveEntry): DreamTask['sources'][0] {
    return {
      id: entry.id,
      descriptor: entry.descriptor.values.map(v => v.value),
      quality: entry.qualityScore,
    };
  }

  private findDistantPairs(entries: ArchiveEntry[]): Array<[ArchiveEntry, ArchiveEntry, number]> {
    const pairs: Array<[ArchiveEntry, ArchiveEntry, number]> = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const dist = this.descriptorDistance(entries[i], entries[j]);
        if (dist >= this.distantThreshold) {
          pairs.push([entries[i], entries[j], dist]);
        }
      }
    }

    return pairs.sort((a, b) => b[2] - a[2]);
  }

  private descriptorDistance(a: ArchiveEntry, b: ArchiveEntry): number {
    const aMap = new Map(a.descriptor.values.map(v => [v.axis, v.value]));
    let sumSq = 0;
    for (const bv of b.descriptor.values) {
      const av = aMap.get(bv.axis) ?? 0.5;
      sumSq += (av - bv.value) ** 2;
    }
    return Math.sqrt(sumSq);
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
