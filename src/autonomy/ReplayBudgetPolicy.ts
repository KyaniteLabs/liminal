/**
 * ReplayBudgetPolicy — Phase 13E
 *
 * Allocates Cortex budget between fresh exploration and replay/branch tasks.
 * Prevents the system from getting stuck replaying existing artifacts
 * when it should be exploring new regions of behavior space.
 */

import type { ReplayBudget, CreativeTaskType } from '../emergence/types.js';
import { Logger } from '../utils/Logger.js';

export interface ReplayBudgetPolicyConfig {
  /** Fraction of budget for replay/branch (0–1, default: 0.3) */
  replayRatio?: number;
  /** Total actions per cycle (default: 10) */
  actionsPerCycle?: number;
  /** Max consecutive replay before forcing exploration (default: 3) */
  maxConsecutiveReplay?: number;
}

export class ReplayBudgetPolicy {
  private readonly config: Required<ReplayBudgetPolicyConfig>;
  private consecutiveReplay = 0;
  private cycleHistory: Array<{ fresh: number; replay: number }> = [];

  constructor(config: ReplayBudgetPolicyConfig = {}) {
    this.config = {
      replayRatio: config.replayRatio ?? 0.3,
      actionsPerCycle: config.actionsPerCycle ?? 10,
      maxConsecutiveReplay: config.maxConsecutiveReplay ?? 3,
    };
  }

  /**
   * Get the budget allocation for the current cycle.
   */
  getBudget(): ReplayBudget {
    return {
      replayRatio: this.config.replayRatio,
      actionsPerCycle: this.config.actionsPerCycle,
      maxConsecutiveReplay: this.config.maxConsecutiveReplay,
    };
  }

  /**
   * Decide the next task type based on budget policy.
   * Returns the recommended task type, respecting replay limits.
   */
  decideNextTask(
    currentCycleActions: Array<{ type: CreativeTaskType }>,
    archiveCoverage: number, // 0–1, fraction of cells occupied
  ): CreativeTaskType {
    const replayTypes: Set<CreativeTaskType> = new Set([
      'replay-promising',
      'branch-from-pinned',
      'compost-resurrection',
    ]);

    const freshTypes: CreativeTaskType[] = ['fresh-exploration', 'dream-recombination'];

    // Count what's been done this cycle
    const replayCount = currentCycleActions.filter(a => replayTypes.has(a.type)).length;
    const totalActions = currentCycleActions.length;
    const freshBudget = Math.ceil(this.config.actionsPerCycle * (1 - this.config.replayRatio));

    // Force exploration if consecutive replay limit hit
    if (this.consecutiveReplay >= this.config.maxConsecutiveReplay) {
      Logger.info('ReplayBudgetPolicy', `Forcing exploration — ${this.consecutiveReplay} consecutive replays`);
      this.consecutiveReplay = 0;
      return freshTypes[Math.floor(Math.random() * freshTypes.length)];
    }

    // Force exploration if fresh budget exhausted
    const freshCount = totalActions - replayCount;
    if (freshCount < freshBudget && replayCount > 0) {
      return freshTypes[Math.floor(Math.random() * freshTypes.length)];
    }

    // Prefer exploration when coverage is low
    if (archiveCoverage < 0.3) {
      return Math.random() < 0.8 ? 'fresh-exploration' : 'dream-recombination';
    }

    // Normal allocation: random weighted by replayRatio
    if (Math.random() < this.config.replayRatio) {
      this.consecutiveReplay++;
      const replayOptions: CreativeTaskType[] = ['replay-promising', 'branch-from-pinned', 'compost-resurrection'];
      return replayOptions[Math.floor(Math.random() * replayOptions.length)];
    }

    this.consecutiveReplay = 0;
    return freshTypes[Math.floor(Math.random() * freshTypes.length)];
  }

  /**
   * Record that a cycle completed.
   */
  recordCycle(fresh: number, replay: number): void {
    this.cycleHistory.push({ fresh, replay });
    this.consecutiveReplay = 0;

    // Keep only last 20 cycles
    if (this.cycleHistory.length > 20) {
      this.cycleHistory = this.cycleHistory.slice(-20);
    }
  }

  /**
   * Get the effective replay ratio based on recent history.
   */
  getEffectiveReplayRatio(): number {
    if (this.cycleHistory.length === 0) return this.config.replayRatio;

    const recent = this.cycleHistory.slice(-5);
    const totalReplay = recent.reduce((sum, c) => sum + c.replay, 0);
    const totalActions = recent.reduce((sum, c) => sum + c.fresh + c.replay, 0);

    return totalActions > 0 ? totalReplay / totalActions : this.config.replayRatio;
  }
}
