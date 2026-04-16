import type { CortexSnapshot, CortexGoal, CortexConfig, ActiveLease, StuckWorker } from './types.js';
import { BudgetTracker } from './BudgetTracker.js';
import { PriorityAllocator } from './PriorityAllocator.js';
import { ActionProposer } from './ActionProposer.js';
import { CortexSupervisor } from './CortexSupervisor.js';
import { StuckDetector } from './StuckDetector.js';
import type { ActionProposal } from './ActionProposer.js';

export interface CortexEvent {
  type:
    | 'cortex.loop_tick'
    | 'cortex.decision'
    | 'cortex.action_proposed'
    | 'cortex.stuck_detected'
    | 'cortex.lease_expired';
  tickNumber: number;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface LiminalCortexDeps {
  perceptionBus: { getSnapshot(): CortexSnapshot };
  goalStore: { getActiveGoals(): CortexGoal[] };
  config: CortexConfig;
  onEvent: (event: CortexEvent) => void;
}

interface SupervisionResult {
  stuckWorkers: StuckWorker[];
  expiredLeases: ActiveLease[];
}

export class LiminalCortex {
  private readonly allocator = new PriorityAllocator();
  private readonly budget: BudgetTracker;
  private readonly proposer: ActionProposer;
  private readonly supervisor = new CortexSupervisor();
  private readonly stuckDetector = new StuckDetector();
  private abortController: AbortController | null = null;
  private running = false;
  private tickNumber = 0;
  private consecutiveFailures = 0;
  private latestDecisions: ActionProposal[] = [];
  private latestStuckWorkers: StuckWorker[] = [];

  constructor(private deps: LiminalCortexDeps) {
    this.budget = new BudgetTracker({
      actionsLimit: deps.config.budgetActionsLimit,
      tokenLimit: deps.config.budgetTokenLimit,
    });
    this.proposer = new ActionProposer(this.budget, deps.config.autonomyLevel);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.abortController = new AbortController();
    this.loop(this.abortController.signal).catch(() => {});
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  isRunning(): boolean {
    return this.running;
  }

  tick(): {
    snapshot: CortexSnapshot;
    goals: CortexGoal[];
    proposals: ActionProposal[];
    supervision: SupervisionResult;
  } {
    const snapshot = this.deps.perceptionBus.getSnapshot();
    const goals = this.deps.goalStore.getActiveGoals();
    const ranked = this.allocator.rank(snapshot, goals);
    const proposals = this.proposer.propose(ranked);

    // Grant leases for new proposals
    for (const p of proposals) {
      const deadlineMs = this.deadlineForAction(p.actionType);
      this.supervisor.grantLease(
        `${this.tickNumber}-${p.actionType}`,
        deadlineMs,
        p.reasoning,
      );
    }

    // Check supervision
    const supervision = this.supervise(snapshot);

    return { snapshot, goals, proposals, supervision };
  }

  getBudgetUsage() {
    return this.budget.getUsage();
  }

  getState() {
    return {
      tickNumber: this.tickNumber,
      decisions: this.latestDecisions,
      stuckWorkers: this.latestStuckWorkers,
    };
  }

  private supervise(snapshot: CortexSnapshot): SupervisionResult {
    // Check expired leases
    const expiredLeases = this.supervisor.checkExpired();

    // Detect stuck workers from active processes
    const stuckWorkers = this.stuckDetector.detect(
      snapshot.activeProcesses,
      snapshot.timestamp,
    );

    return { stuckWorkers, expiredLeases };
  }

  private deadlineForAction(actionType: string): number {
    switch (actionType) {
      case 'resolve-stuck-worker':
        return 30_000; // 30 seconds
      case 'improve-coverage':
      case 'increase-score':
        return 120_000; // 2 minutes
      default:
        return 60_000; // 1 minute
    }
  }

  private async loop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        this.tickNumber++;
        this.budget.reset();

        const result = this.tick();

        this.emit('cortex.loop_tick', {
          tickNumber: this.tickNumber,
          budgetUsage: this.budget.getUsage(),
        });

        // Emit supervision events — always emit stuck state so TUI clears when recovered
        this.latestStuckWorkers = result.supervision.stuckWorkers;
        this.emit('cortex.stuck_detected', {
          stuckWorkers: result.supervision.stuckWorkers,
        });
        if (result.supervision.expiredLeases.length > 0) {
          this.emit('cortex.lease_expired', {
            expiredLeases: result.supervision.expiredLeases,
          });
        }

        // Emit decision events for proposals
        this.latestDecisions = result.proposals;
        for (const p of result.proposals) {
          this.emit('cortex.decision', {
            actionType: p.actionType,
            score: p.score,
            reasoning: p.reasoning,
            goalIds: p.goalIds,
            reviewRequired: p.reviewRequired,
          });
          this.emit('cortex.action_proposed', { proposal: p });
        }

        this.consecutiveFailures = 0;
      } catch {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.deps.config.maxConsecutiveFailures) {
          this.emit('cortex.loop_tick', {
            tickNumber: this.tickNumber,
            circuitBreakerTripped: true,
            consecutiveFailures: this.consecutiveFailures,
          });
          this.running = false;
          return;
        }
      }

      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, this.deps.config.loopIntervalMs);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          resolve();
        }, { once: true });
      });
    }
  }

  private emit(type: CortexEvent['type'], data: Record<string, unknown>): void {
    this.deps.onEvent({
      type,
      tickNumber: this.tickNumber,
      timestamp: Date.now(),
      data,
    });
  }
}
