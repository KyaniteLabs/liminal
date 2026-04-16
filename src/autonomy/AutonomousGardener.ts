/**
 * AutonomousGardener — Phase 16
 *
 * Top-level orchestrator for the autonomous garden runtime.
 * Coordinates policy decisions, scheduling, stagnation detection,
 * and budget enforcement across garden cycles.
 */

import type { ArchiveCell } from '../emergence/types.js';
import type { DescriptorAxis } from '../emergence/types.js';
import { GardenPolicy } from './GardenPolicy.js';
import { GardenScheduler, type GardenMode } from './GardenScheduler.js';
import { LoopMixPolicy } from './LoopMixPolicy.js';
import { StagnationDetector, type StagnationResult } from './StagnationDetector.js';
import type { GardenHealthMetrics } from './GardenHealthMonitor.js';

export interface GardenerCycleResult {
  cycle: number;
  mode: GardenMode;
  actions: number;
  health: GardenHealthMetrics;
  stagnation: StagnationResult;
  budgetRemaining: number;
}

export interface AutonomousGardenerConfig {
  /** Garden mode (default: 'co-create') */
  mode?: GardenMode;
  /** Total budget per session in abstract units (default: 100) */
  totalBudget?: number;
  /** Stagnation detection config */
  stagnationWindow?: number;
  /** Loop mix overrides */
  explorationFraction?: number;
}

export class AutonomousGardener {
  private readonly policy: GardenPolicy;
  private readonly scheduler: GardenScheduler;
  private readonly mixPolicy: LoopMixPolicy;
  private readonly stagnationDetector: StagnationDetector;
  private readonly mode: GardenMode;
  private budgetRemaining: number;
  private cycleCount = 0;
  private active = false;
  private abortController: AbortController | null = null;

  constructor(config: AutonomousGardenerConfig = {}) {
    this.mode = config.mode ?? 'co-create';
    this.budgetRemaining = config.totalBudget ?? 100;
    this.policy = new GardenPolicy({ explorationFraction: config.explorationFraction });
    this.scheduler = new GardenScheduler();
    this.mixPolicy = new LoopMixPolicy({ defaultExploration: config.explorationFraction });
    this.stagnationDetector = new StagnationDetector({ stagnationWindow: config.stagnationWindow });
  }

  /**
   * Run a single garden cycle. Returns the result or null if budget exhausted.
   */
  cycle(cells: ArchiveCell[], axes: DescriptorAxis[]): GardenerCycleResult | null {
    if (this.budgetRemaining <= 0) return null;

    this.cycleCount++;

    // 1. Get policy decisions
    const decisions = this.policy.decide(cells, axes);

    // 2. Measure health
    const health = this.policy.getHealthMonitor().measure(cells);

    // 3. Detect stagnation
    const history = this.policy.getHealthMonitor().getHistory();
    const stagnation = this.stagnationDetector.detect(history);

    // 4. Compute activity mix
    const mix = this.mixPolicy.computeMix(health, stagnation);
    const activities = mix.map(m => m.activity);

    // 5. Budget check — only schedule if we can afford it
    const budgetPerAction = 10;
    const affordable = decisions.filter(() => this.budgetRemaining >= budgetPerAction);
    const cost = affordable.length * budgetPerAction;
    this.budgetRemaining -= cost;

    // 6. Schedule
    const scheduled = this.scheduler.schedule(affordable, activities, this.mode, health);

    return {
      cycle: this.cycleCount,
      mode: this.mode,
      actions: scheduled.length,
      health,
      stagnation,
      budgetRemaining: this.budgetRemaining,
    };
  }

  /**
   * Start continuous autonomous gardening (for autopilot mode).
   */
  async start(
    getCells: () => ArchiveCell[],
    getAxes: () => DescriptorAxis[],
    onCycle?: (result: GardenerCycleResult) => void,
  ): Promise<void> {
    this.active = true;
    this.abortController = new AbortController();

    const interval = this.scheduler.getCycleInterval(this.mode);

    while (this.active && !this.abortController.signal.aborted) {
      const result = this.cycle(getCells(), getAxes());
      if (!result) {
        this.active = false;
        break;
      }
      onCycle?.(result);

      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, interval);
        this.abortController!.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }

    this.active = false;
  }

  /**
   * Stop the autonomous gardener.
   */
  stop(): void {
    this.active = false;
    this.abortController?.abort();
  }

  isActive(): boolean {
    return this.active;
  }

  getMode(): GardenMode {
    return this.mode;
  }

  getBudgetRemaining(): number {
    return this.budgetRemaining;
  }

  getCycleCount(): number {
    return this.cycleCount;
  }

  getScheduler(): GardenScheduler {
    return this.scheduler;
  }

  getPolicy(): GardenPolicy {
    return this.policy;
  }
}
