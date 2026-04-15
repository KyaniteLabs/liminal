export type EvalMode = 'legacy' | 'auto' | 'strict-browser';
export type RepairMode = 'off' | 'single-round';

export function getEvalMode(): EvalMode {
  return (process.env.LIMINAL_EVAL_MODE as EvalMode) || 'legacy';
}

export function getRepairMode(): RepairMode {
  return (process.env.LIMINAL_REPAIR_MODE as RepairMode) || 'off';
}

export function isRepairEnabled(): boolean {
  return getRepairMode() !== 'off';
}
