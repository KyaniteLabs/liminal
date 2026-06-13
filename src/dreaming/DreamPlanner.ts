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
   *
   * `options.excludeKeys` lets the caller pass the signatures of recombinations
   * already in the dream queue (queued/completed/failed). The planner then walks
   * DEEPER into each strategy's candidate space to propose only FRESH pairings —
   * without it, a stable archive yields the same top pairs every cycle, which the
   * queue dedups to `+0`, and dreaming goes dark.
   */
  plan(
    cells: ArchiveCell[],
    _axes: DescriptorAxis[],
    options: { excludeKeys?: Set<string> } = {},
  ): DreamPlan {
    const entries = cells
      .map(c => c.elite)
      .filter((e): e is ArchiveEntry => e !== undefined);

    const tasks: DreamPlan['tasks'] = [];

    if (entries.length < 2) return { tasks };

    // Signatures already tried (+ intra-plan dupes) that must not be re-proposed.
    // Matches the garden-tend dedup key: `${strategy}:${sorted source ids}`.
    const excluded = new Set(options.excludeKeys ?? []);
    const signature = (strategy: DreamStrategy, sources: DreamTask['sources']): string =>
      `${strategy}:${sources.map(s => s.id).sort().join('+')}`;
    const tryAdd = (
      strategy: DreamStrategy,
      sources: DreamTask['sources'],
      priority: number,
      reason: string,
    ): boolean => {
      if (tasks.length >= this.maxTasks) return false;
      const key = signature(strategy, sources);
      if (excluded.has(key)) return false;
      excluded.add(key);
      tasks.push({ strategy, sources, priority, reason });
      return true;
    };

    const archive = entries;
    const byQuality = [...entries].sort((a, b) => b.qualityScore - a.qualityScore);
    const byNovelty = [...entries].sort((a, b) =>
      this.noveltyIndex.score(b.descriptor, archive) - this.noveltyIndex.score(a.descriptor, archive),
    );

    // 1. Elite × Elite: best quality × most novel — walk quality/novelty ranks for a fresh pair.
    eliteXElite:
    for (const q of byQuality) {
      for (const n of byNovelty) {
        if (n.id === q.id) continue;
        if (tryAdd('elite-x-elite', [this.toSource(q), this.toSource(n)], 0.9,
          'Recombine best quality with most novel')) {
          break eliteXElite;
        }
      }
    }

    // 2. Distant niche × distant: bridge the farthest-apart niches not yet tried (up to 2).
    if (entries.length >= 4) {
      let distantAdded = 0;
      for (const pair of this.findDistantPairs(entries)) {
        if (distantAdded >= 2 || tasks.length >= this.maxTasks) break;
        if (tryAdd('distant-niche-x-distant', [this.toSource(pair[0]), this.toSource(pair[1])], 0.7,
          `Bridge distant niches (distance: ${pair[2].toFixed(2)})`)) {
          distantAdded++;
        }
      }
    }

    // 3. Cross-modal: pair artifacts from different domains (inert when all share one kind).
    const domainGroups = this.groupByDomain(entries);
    const domains = Object.keys(domainGroups);
    for (let i = 0; i < domains.length - 1 && tasks.length < this.maxTasks; i++) {
      const groupA = domainGroups[domains[i]];
      const groupB = domainGroups[domains[i + 1]];
      crossModal:
      for (const a of groupA) {
        for (const b of groupB) {
          if (tryAdd('cross-modal', [this.toSource(a), this.toSource(b)], 0.6,
            `Cross-modal: ${domains[i]} × ${domains[i + 1]}`)) {
            break crossModal;
          }
        }
      }
    }

    // 4. Elite × compost: fill remaining slots with fresh single-source seeds.
    for (const entry of entries) {
      if (tasks.length >= this.maxTasks) break;
      tryAdd('elite-x-compost', [this.toSource(entry)], 0.4, 'Recombine with compost material');
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
