export interface BudgetConfig { actionsLimit: number; tokenLimit: number; }
export interface ActionCost { tokenEstimate: number; }
export interface BudgetUsage { actionsTaken: number; actionsLimit: number; tokenEstimate: number; tokenLimit: number; }
export class BudgetTracker {
  private actionsTaken = 0; private tokenEstimate = 0;
  constructor(private config: BudgetConfig) {}
  canAfford(cost: ActionCost): boolean { return this.actionsTaken < this.config.actionsLimit && this.tokenEstimate + cost.tokenEstimate <= this.config.tokenLimit; }
  record(cost: ActionCost): void { this.actionsTaken++; this.tokenEstimate += cost.tokenEstimate; }
  getUsage(): BudgetUsage { return { actionsTaken: this.actionsTaken, actionsLimit: this.config.actionsLimit, tokenEstimate: this.tokenEstimate, tokenLimit: this.config.tokenLimit }; }
  reset(): void { this.actionsTaken = 0; this.tokenEstimate = 0; }
}
