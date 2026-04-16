/**
 * GardenScheduler — Phase 16
 *
 * Schedules garden actions over time, respecting budgets,
 * concurrency limits, and mode constraints (assist/co-create/autopilot).
 */

import type { GardenPolicyDecision } from './GardenPolicy.js';
import type { LoopActivity } from './LoopMixPolicy.js';
import type { GardenHealthMetrics } from './GardenHealthMonitor.js';

export type GardenMode = 'assist' | 'co-create' | 'autopilot';

export interface ScheduledAction {
  decision: GardenPolicyDecision;
  scheduledAt: number;
  activity: LoopActivity;
  budget: number;
}

export interface GardenSchedulerConfig {
  /** Maximum concurrent actions (default: 3) */
  maxConcurrent?: number;
  /** Budget per action in abstract units (default: 10) */
  budgetPerAction?: number;
  /** Cycle interval in ms for autopilot (default: 30000) */
  cycleIntervalMs?: number;
  /** Mode-specific action limits per cycle */
  modeLimits?: Record<GardenMode, number>;
}

const DEFAULT_MODE_LIMITS: Record<GardenMode, number> = {
  assist: 2,
  'co-create': 5,
  autopilot: 10,
};

export class GardenScheduler {
  private readonly maxConcurrent: number;
  private readonly budgetPerAction: number;
  private readonly cycleIntervalMs: number;
  private readonly modeLimits: Record<GardenMode, number>;
  private readonly history: ScheduledAction[] = [];
  private running = 0;

  constructor(config: GardenSchedulerConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 3;
    this.budgetPerAction = config.budgetPerAction ?? 10;
    this.cycleIntervalMs = config.cycleIntervalMs ?? 30000;
    this.modeLimits = config.modeLimits ?? DEFAULT_MODE_LIMITS;
  }

  /**
   * Schedule the next batch of actions given policy decisions and mode.
   */
  schedule(
    decisions: GardenPolicyDecision[],
    activities: LoopActivity[],
    mode: GardenMode,
    _health?: GardenHealthMetrics,
  ): ScheduledAction[] {
    const limit = this.modeLimits[mode];
    const available = Math.max(0, limit - this.running);
    const toSchedule = decisions.slice(0, Math.min(available, this.maxConcurrent));

    const now = Date.now();
    const scheduled: ScheduledAction[] = toSchedule.map((decision, i) => ({
      decision,
      scheduledAt: now + i * (this.cycleIntervalMs / limit),
      activity: activities[i % activities.length] ?? 'exploration',
      budget: this.budgetPerAction,
    }));

    this.history.push(...scheduled);
    this.running += scheduled.length;

    // Trim history to last 100 entries
    if (this.history.length > 100) {
      this.history.splice(0, this.history.length - 100);
    }

    return scheduled;
  }

  /**
   * Mark an action as completed, freeing a slot.
   */
  complete(_action: ScheduledAction): void {
    this.running = Math.max(0, this.running - 1);
  }

  /**
   * Get cycle interval for the given mode.
   */
  getCycleInterval(mode: GardenMode): number {
    if (mode === 'assist') return this.cycleIntervalMs * 2;
    if (mode === 'co-create') return this.cycleIntervalMs;
    return Math.max(5000, this.cycleIntervalMs / 2);
  }

  /**
   * Whether the scheduler can accept more work.
   */
  hasCapacity(mode: GardenMode): boolean {
    return this.running < Math.min(this.maxConcurrent, this.modeLimits[mode]);
  }

  getRunningCount(): number {
    return this.running;
  }

  getHistory(): ScheduledAction[] {
    return [...this.history];
  }

  getModeLimit(mode: GardenMode): number {
    return this.modeLimits[mode];
  }
}
