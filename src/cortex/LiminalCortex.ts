import type { CortexSnapshot, CortexGoal, CortexConfig } from './types.js';
import { BudgetTracker } from './BudgetTracker.js';
import { PriorityAllocator } from './PriorityAllocator.js';
import { ActionProposer } from './ActionProposer.js';
export interface CortexEvent { type: 'cortex.loop_tick' | 'cortex.decision' | 'cortex.action_proposed'; tickNumber: number; timestamp: number; data: Record<string, unknown>; }
export interface LiminalCortexDeps { perceptionBus: { getSnapshot(): CortexSnapshot }; goalStore: { getActiveGoals(): CortexGoal[] }; config: CortexConfig; onEvent: (event: CortexEvent) => void; }
export class LiminalCortex {
  private readonly allocator = new PriorityAllocator();
  private readonly budget: BudgetTracker;
  private readonly proposer: ActionProposer;
  private abortController: AbortController | null = null;
  private running = false; private tickNumber = 0; private consecutiveFailures = 0;
  constructor(private deps: LiminalCortexDeps) { this.budget = new BudgetTracker({ actionsLimit: deps.config.budgetActionsLimit, tokenLimit: deps.config.budgetTokenLimit }); this.proposer = new ActionProposer(this.budget, deps.config.autonomyLevel); }
  start(): void { if (this.running) return; this.running = true; this.abortController = new AbortController(); this.loop(this.abortController.signal).catch(() => {}); }
  stop(): void { this.running = false; this.abortController?.abort(); this.abortController = null; }
  isRunning(): boolean { return this.running; }
  tick(): { snapshot: CortexSnapshot; goals: CortexGoal[]; proposals: ReturnType<ActionProposer['propose']> } { const snapshot = this.deps.perceptionBus.getSnapshot(); const goals = this.deps.goalStore.getActiveGoals(); const ranked = this.allocator.rank(snapshot, goals); return { snapshot, goals, proposals: this.proposer.propose(ranked) }; }
  getBudgetUsage() { return this.budget.getUsage(); }
  private async loop(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try { this.tickNumber++; this.budget.reset(); const result = this.tick(); this.emit('cortex.loop_tick', { tickNumber: this.tickNumber, budgetUsage: this.budget.getUsage() }); for (const p of result.proposals) { this.emit('cortex.decision', { actionType: p.actionType, score: p.score, reasoning: p.reasoning, goalIds: p.goalIds, reviewRequired: p.reviewRequired }); this.emit('cortex.action_proposed', { proposal: p }); } this.consecutiveFailures = 0; }
      catch { this.consecutiveFailures++; if (this.consecutiveFailures >= this.deps.config.maxConsecutiveFailures) { this.emit('cortex.loop_tick', { tickNumber: this.tickNumber, circuitBreakerTripped: true, consecutiveFailures: this.consecutiveFailures }); this.running = false; return; } }
      await new Promise<void>((resolve) => { const t = setTimeout(resolve, this.deps.config.loopIntervalMs); signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true }); });
    }
  }
  private emit(type: CortexEvent['type'], data: Record<string, unknown>): void { this.deps.onEvent({ type, tickNumber: this.tickNumber, timestamp: Date.now(), data }); }
}
