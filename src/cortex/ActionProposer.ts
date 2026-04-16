import type { RankedAction, CortexConfig } from './types.js';
import type { BudgetTracker } from './BudgetTracker.js';
export interface ActionProposal { actionType: RankedAction['actionType']; score: number; reasoning: string; goalIds: string[]; urgency: number; reviewRequired: boolean; estimatedTokens: number; }
const LOW_RISK = new Set<RankedAction['actionType']>(['improve-coverage', 'increase-score']);
const TOKENS_PER_ACTION = 2000;
export class ActionProposer {
  constructor(private budget: BudgetTracker, private autonomyLevel: CortexConfig['autonomyLevel']) {}
  propose(ranked: RankedAction[]): ActionProposal[] {
    const out: ActionProposal[] = [];
    for (const a of ranked) { if (!this.budget.canAfford({ tokenEstimate: TOKENS_PER_ACTION })) break; out.push({ actionType: a.actionType, score: a.score, reasoning: a.reasoning, goalIds: a.goalIds, urgency: a.urgency, reviewRequired: this.requiresReview(a), estimatedTokens: TOKENS_PER_ACTION }); this.budget.record({ tokenEstimate: TOKENS_PER_ACTION }); }
    return out;
  }
  private requiresReview(a: RankedAction): boolean { if (this.autonomyLevel === 'autopilot') return false; if (this.autonomyLevel === 'co-create') return !LOW_RISK.has(a.actionType); return true; }
}
