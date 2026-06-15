/**
 * AutonomousGardener — Phase 16
 *
 * Top-level orchestrator for the autonomous garden runtime.
 * Coordinates policy decisions, scheduling, stagnation detection,
 * and budget enforcement across garden cycles.
 */

import type { ArchiveCell, CreativeTaskType, DescriptorAxis } from '../emergence/types.js';
import { GardenPolicy } from './GardenPolicy.js';
import { GardenScheduler, type GardenMode } from './GardenScheduler.js';
import { LoopMixPolicy } from './LoopMixPolicy.js';
import { StagnationDetector, type StagnationResult } from './StagnationDetector.js';
import type { GardenHealthMetrics } from './GardenHealthMonitor.js';
import { ArchiveTaskPlanner } from './ArchiveTaskPlanner.js';
import { PromisingStateSelector } from './PromisingStateSelector.js';
import { ReplayBudgetPolicy } from './ReplayBudgetPolicy.js';
import { ReplayBiasPolicy } from '../learning/ReplayBiasPolicy.js';
import type { TasteModelWeights } from '../learning/TasteModelTrainer.js';
import { DreamPlanner } from '../dreaming/DreamPlanner.js';
import { RecombinationEngine, type RecombinationResult } from '../dreaming/RecombinationEngine.js';
import type { DreamQueue, DreamTask } from '../dreaming/DreamQueue.js';

export interface GardenerCycleResult {
  cycle: number;
  mode: GardenMode;
  actions: number;
  health: GardenHealthMetrics;
  stagnation: StagnationResult;
  budgetRemaining: number;
  /** Breakdown of action types this cycle */
  taskBreakdown?: { fresh: number; replay: number; dream: number };
  /** Tasks planned by ArchiveTaskPlanner */
  plannedTasks?: number;
  /** Promising states selected for replay */
  promisingStates?: number;
  /** Dream recombination results from this cycle */
  dreamResults?: RecombinationResult[];
  /** Number of taste-aligned entries in this cycle */
  tasteAlignedCount?: number;
  /** Archive entry IDs selected by the loaded taste model during replay */
  tasteSelectedEntryIds?: string[];
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
  /** Replay budget config */
  replayRatio?: number;
  /** Max consecutive replay actions (default: 3) */
  maxConsecutiveReplay?: number;
  /** Max archive tasks per cycle (default: 10) */
  maxArchiveTasks?: number;
  /** Taste bias strength for replay selection (0–1, default: 0.7) */
  replayBiasStrength?: number;
  /** Minimum taste score for priority replay (default: 0.5) */
  minTasteScore?: number;
  /**
   * Optional dream queue. When provided, in-cycle recombinations are enqueued
   * as dream tasks so the cognitive work actually feeds the dream→gen loop
   * instead of being computed and discarded as a telemetry count. Leave unset
   * for callers that run their own separate enqueue path (e.g. `garden tend`),
   * to avoid double-feeding the same pairings.
   */
  dreamQueue?: DreamQueue;
}

export class AutonomousGardener {
  private readonly policy: GardenPolicy;
  private readonly scheduler: GardenScheduler;
  private readonly mixPolicy: LoopMixPolicy;
  private readonly stagnationDetector: StagnationDetector;
  private readonly archiveTaskPlanner: ArchiveTaskPlanner;
  private readonly promisingStateSelector: PromisingStateSelector;
  private readonly replayBudgetPolicy: ReplayBudgetPolicy;
  private readonly replayBiasPolicy: ReplayBiasPolicy;
  private readonly dreamPlanner: DreamPlanner;
  private readonly recombinationEngine: RecombinationEngine;
  private readonly dreamQueue?: DreamQueue;
  /** Signatures of recombinations already enqueued this gardener's lifetime. */
  private readonly enqueuedDreamKeys = new Set<string>();
  private readonly mode: GardenMode;
  private budgetRemaining: number;
  private cycleCount = 0;
  private active = false;
  private abortController: AbortController | null = null;
  private stopped = false;
  /** Tracks actions within a cycle for replay budget gating */
  private currentCycleActions: Array<{ type: CreativeTaskType }> = [];

  constructor(config: AutonomousGardenerConfig = {}) {
    this.mode = config.mode ?? 'co-create';
    this.budgetRemaining = config.totalBudget ?? 100;
    this.policy = new GardenPolicy({ explorationFraction: config.explorationFraction });
    this.scheduler = new GardenScheduler();
    this.mixPolicy = new LoopMixPolicy({ defaultExploration: config.explorationFraction });
    this.stagnationDetector = new StagnationDetector({ stagnationWindow: config.stagnationWindow });
    this.archiveTaskPlanner = new ArchiveTaskPlanner({ maxTasks: config.maxArchiveTasks });
    this.promisingStateSelector = new PromisingStateSelector();
    this.replayBudgetPolicy = new ReplayBudgetPolicy({
      replayRatio: config.replayRatio,
      maxConsecutiveReplay: config.maxConsecutiveReplay,
    });
    this.replayBiasPolicy = new ReplayBiasPolicy({
      biasStrength: config.replayBiasStrength,
      minTasteScore: config.minTasteScore,
    });
    this.dreamPlanner = new DreamPlanner();
    this.recombinationEngine = new RecombinationEngine();
    this.dreamQueue = config.dreamQueue;
  }

  /**
   * Run a single garden cycle. Returns the result or null if budget exhausted.
   * Uses ArchiveTaskPlanner, PromisingStateSelector, ReplayBudgetPolicy,
   * DreamPlanner, and RecombinationEngine to drive structured creative actions.
   */
  cycle(
    cells: ArchiveCell[],
    axes: DescriptorAxis[],
    preferenceCounts?: Map<string, { positive: number; negative: number }>,
  ): GardenerCycleResult | null {
    if (this.budgetRemaining <= 0) return null;

    this.cycleCount++;
    this.currentCycleActions = [];

    // 1. Get policy decisions (existing GardenPolicy as fallback)
    const decisions = this.policy.decide(cells, axes);

    // 2. Measure health
    const health = this.policy.getHealthMonitor().measure(cells);

    // 3. Detect stagnation
    const history = this.policy.getHealthMonitor().getHistory();
    const stagnation = this.stagnationDetector.detect(history);

    // 4. Plan structured tasks from archive state
    const archivePlan = this.archiveTaskPlanner.plan(cells, axes, preferenceCounts);

    // 5. Compute archive coverage for budget gating
    const occupiedCells = cells.filter(c => c.elite !== undefined).length;
    const archiveCoverage = cells.length > 0 ? occupiedCells / cells.length : 0;

    // 6. Use ReplayBudgetPolicy to decide each action type
    let freshCount = 0;
    let replayCount = 0;
    let dreamCount = 0;
    let promisingStatesCount = 0;
    let tasteAlignedCount = 0;
    const tasteSelectedEntryIds: string[] = [];
    const dreamResults: RecombinationResult[] = [];
    const budgetPerAction = 10;

    const elites = cells
      .map(c => c.elite)
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    for (let i = 0; i < archivePlan.tasks.length; i++) {
      if (this.budgetRemaining < budgetPerAction) break;

      const nextType = this.replayBudgetPolicy.decideNextTask(
        this.currentCycleActions,
        archiveCoverage,
      );

      this.currentCycleActions.push({ type: nextType });
      this.budgetRemaining -= budgetPerAction;

      // Categorize for reporting
      if (nextType === 'fresh-exploration' || nextType === 'perturbation-probe') {
        freshCount++;
      } else if (nextType === 'dream-recombination') {
        dreamCount++;
        // Dream tasks: use DreamPlanner + RecombinationEngine
        const dreamPlan = this.dreamPlanner.plan(cells, axes);
        for (const dt of dreamPlan.tasks) {
          if (dt.sources.length >= 2) {
            const result = this.recombinationEngine.recombine(
              { id: dt.sources[0].id, descriptor: dt.sources[0].descriptor },
              { id: dt.sources[1].id, descriptor: dt.sources[1].descriptor },
            );
            dreamResults.push(result);
            // Wire the recombination into the dream→gen loop instead of only
            // counting it. Deduped per gardener lifetime so the same pairing is
            // not re-enqueued every cycle. Skipped when no queue is injected
            // (callers with a separate enqueue path opt out to avoid double-feed).
            this.enqueueDream(dt.strategy, dt.sources, dt.priority);
          }
        }
      } else {
        // Replay/branch tasks: use taste-biased selection when model is loaded,
        // fall back to PromisingStateSelector otherwise
        replayCount++;
        if (this.replayBiasPolicy.isModelLoaded()) {
          const tasteSelected = this.replayBiasPolicy.selectForReplay(elites, 3);
          tasteSelectedEntryIds.push(...tasteSelected.map(e => e.id));
          promisingStatesCount += tasteSelected.length;
          tasteAlignedCount += tasteSelected.filter(e => this.replayBiasPolicy.isTasteAligned(e)).length;
        } else {
          const promising = this.promisingStateSelector.select(
            elites,
            preferenceCounts ?? new Map(),
            3,
          );
          promisingStatesCount += promising.length;
        }
      }
    }

    this.replayBudgetPolicy.recordCycle(freshCount, replayCount);

    // 7. Fallback to existing GardenPolicy + scheduler for remaining budget
    const mix = this.mixPolicy.computeMix(health, stagnation);
    const activities = mix.map(m => m.activity);
    const affordable = decisions.filter(() => this.budgetRemaining >= budgetPerAction);
    const cost = affordable.length * budgetPerAction;
    this.budgetRemaining -= cost;
    const scheduled = this.scheduler.schedule(affordable, activities, this.mode, health);

    const archiveActionsExecuted = this.currentCycleActions.length;
    const totalActions = archiveActionsExecuted + scheduled.length;
    if (totalActions === 0) return null;

    return {
      cycle: this.cycleCount,
      mode: this.mode,
      actions: totalActions,
      health,
      stagnation,
      budgetRemaining: this.budgetRemaining,
      taskBreakdown: { fresh: freshCount, replay: replayCount, dream: dreamCount },
      plannedTasks: archivePlan.tasks.length,
      promisingStates: promisingStatesCount,
      dreamResults: dreamResults.length > 0 ? dreamResults : undefined,
      tasteAlignedCount,
      tasteSelectedEntryIds: tasteSelectedEntryIds.length > 0 ? tasteSelectedEntryIds : undefined,
    };
  }

  /**
   * Persist an in-cycle recombination into the dream queue so it feeds the
   * dream→gen loop. No-op when no queue is injected. Deduped by
   * `${strategy}:${sorted source ids}` (the same signature `garden tend` uses)
   * so a stable archive does not re-enqueue identical pairings each cycle.
   */
  private enqueueDream(
    strategy: DreamTask['strategy'],
    sources: DreamTask['sources'],
    priority: number,
  ): void {
    if (!this.dreamQueue) return;
    const key = `${strategy}:${sources.map(s => s.id).sort().join('+')}`;
    if (this.enqueuedDreamKeys.has(key)) return;
    const id = this.dreamQueue.enqueue(strategy, sources, priority);
    // Only mark as enqueued if the queue accepted it (enqueue returns undefined
    // when full); otherwise leave the key unset so a later cycle can retry.
    if (id) this.enqueuedDreamKeys.add(key);
  }

  /**
   * Start continuous autonomous gardening (for autopilot mode).
   */
  async start(
    getCells: () => ArchiveCell[],
    getAxes: () => DescriptorAxis[],
    onCycle?: (result: GardenerCycleResult) => void,
    getPreferenceCounts?: () => Map<string, { positive: number; negative: number }>,
  ): Promise<void> {
    if (this.stopped) return;
    this.active = true;
    this.abortController = new AbortController();

    const interval = this.scheduler.getCycleInterval(this.mode);

    while (this.active && !this.abortController.signal.aborted) {
      const result = this.cycle(getCells(), getAxes(), getPreferenceCounts?.());
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
    this.stopped = true;
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

  /**
   * Load a trained taste model for replay bias.
   * Once loaded, replay selection uses taste scores to prioritize
   * artifacts aligned with user preferences.
   */
  loadTasteModel(weights: TasteModelWeights): void {
    this.replayBiasPolicy.loadModel(weights);
  }

  /**
   * Check whether a taste model is loaded and active.
   */
  isTasteModelLoaded(): boolean {
    return this.replayBiasPolicy.isModelLoaded();
  }
}
