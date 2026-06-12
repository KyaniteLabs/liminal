export type EvalMode = 'legacy' | 'auto' | 'strict-browser';
export type RepairMode = 'off' | 'single-round';

export function getEvalMode(): EvalMode {
  return (process.env.LIMINAL_EVAL_MODE as EvalMode) || 'auto';
}

export function getRepairMode(): RepairMode {
  // Rubric climbing (2026-06-12): the single-round pass lifts competent work
  // toward the 0.9 band (judge names the weakest craft dimension; keep-best
  // adopts the revision only when it scores >= the original). Default stays
  // 'off' for cost control — the self-improve daemon opts in via
  // LIMINAL_REPAIR_MODE=single-round in its launchd plist (Simon-approved
  // daemon-only rollout, 2026-06-12).
  return (process.env.LIMINAL_REPAIR_MODE as RepairMode) || 'off';
}

export function isRepairEnabled(): boolean {
  return getRepairMode() !== 'off';
}
