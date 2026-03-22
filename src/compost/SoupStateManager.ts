/**
 * SoupStateManager — persistent state management for the Compost Soup loop.
 * Handles load/save/mutation of SoupState.
 */

import fs from 'node:fs/promises';
import type { CompostConfig, SoupState, CompostFragment } from './types.js';

/** Default empty soup state. */
const DEFAULT_STATE: SoupState = {
  population: [],
  generation: 0,
  bestSeed: null,
  totalSeedsPromoted: 0,
  domainHeatmap: {},
  lastCycleAt: '',
};

export class SoupStateManager {
  private statePath: string;

  constructor(_config: CompostConfig, statePath?: string) {
    this.statePath = statePath ?? 'compost/soup-state.json';
  }

  /** Load state from disk, returning default if missing/corrupt. */
  async load(): Promise<SoupState> {
    try {
      const raw = await fs.readFile(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as SoupState;
      // Validate required fields
      return {
        population: Array.isArray(parsed.population) ? parsed.population : [],
        generation: typeof parsed.generation === 'number' ? parsed.generation : 0,
        bestSeed: parsed.bestSeed ?? null,
        totalSeedsPromoted: typeof parsed.totalSeedsPromoted === 'number' ? parsed.totalSeedsPromoted : 0,
        domainHeatmap: parsed.domainHeatmap ?? {},
        lastCycleAt: parsed.lastCycleAt ?? '',
      };
    } catch (err) {
      console.warn('[SoupStateManager] failed to load state, using default:', err);
      return { ...DEFAULT_STATE };
    }
  }

  /** Save state to disk. */
  async save(state: SoupState): Promise<void> {
    const dir = this.statePath.substring(0, this.statePath.lastIndexOf('/'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /** Increment generation counter and update lastCycleAt. */
  updateGeneration(state: SoupState): SoupState {
    return {
      ...state,
      generation: state.generation + 1,
      lastCycleAt: new Date().toISOString(),
    };
  }

  /** Record a seed promotion. */
  recordPromotion(state: SoupState, seed: CompostFragment): SoupState {
    const isBest = !state.bestSeed || (seed.score ?? 0) > (state.bestSeed.score ?? 0);
    return {
      ...state,
      totalSeedsPromoted: state.totalSeedsPromoted + 1,
      bestSeed: isBest ? seed : state.bestSeed,
    };
  }

  /** Update domain heatmap score for a domain pair. */
  updateHeatmap(state: SoupState, domainA: string, domainB: string, score: number): SoupState {
    const key = [domainA, domainB].sort().join('-');
    const current = state.domainHeatmap[key] ?? 0;
    return {
      ...state,
      domainHeatmap: {
        ...state.domainHeatmap,
        [key]: Math.max(current, score),
      },
    };
  }

  /** Replace the lowest-scored population member if the new one is better. */
  replaceWorst(state: SoupState, candidate: CompostFragment): SoupState {
    if (state.population.length === 0) {
      return { ...state, population: [candidate] };
    }

    const worstIdx = state.population.reduce(
      (minIdx, frag, idx) =>
        (frag.score ?? 0) < (state.population[minIdx].score ?? 0) ? idx : minIdx,
      0
    );

    if ((candidate.score ?? 0) > (state.population[worstIdx].score ?? 0)) {
      const newPop = [...state.population];
      newPop[worstIdx] = candidate;
      return { ...state, population: newPop };
    }

    return state;
  }
}
