import { describe, it, expect } from 'vitest';
import { ActionProposer } from '../../../src/cortex/ActionProposer.js';
import type { RankedAction } from '../../../src/cortex/types.js';
import { BudgetTracker } from '../../../src/cortex/BudgetTracker.js';
function mkA(o: Partial<RankedAction> = {}): RankedAction { return { actionType: 'improve-coverage', score: 0.8, reasoning: 'Low coverage', goalIds: [], urgency: 0.7, ...o }; }
describe('ActionProposer', () => {
  it('empty for no actions', () => expect(new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'assist').propose([])).toEqual([]));
  it('converts ranked to proposals', () => { const r = new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'assist').propose([mkA()]); expect(r).toHaveLength(1); expect(r[0].actionType).toBe('improve-coverage'); });
  it('respects action budget', () => expect(new ActionProposer(new BudgetTracker({ actionsLimit: 2, tokenLimit: 50000 }), 'assist').propose([mkA(), mkA({ actionType: 'fix-flaky-test' }), mkA({ actionType: 'reduce-latency' })])).toHaveLength(2));
  it('respects token budget', () => expect(new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 4000 }), 'assist').propose([mkA(), mkA(), mkA()])).toHaveLength(2));
  it('assist requires review for all', () => { for (const p of new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'assist').propose([mkA(), mkA({ actionType: 'fix-flaky-test' })])) expect(p.reviewRequired).toBe(true); });
  it('autopilot skips review', () => { for (const p of new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'autopilot').propose([mkA(), mkA({ actionType: 'fix-flaky-test' })])) expect(p.reviewRequired).toBe(false); });
  it('co-create reviews non-low-risk only', () => { const r = new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'co-create').propose([mkA(), mkA({ actionType: 'fix-flaky-test' })]); expect(r[0].reviewRequired).toBe(false); expect(r[1].reviewRequired).toBe(true); });
  it('proposal has all fields', () => { const p = new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'assist').propose([mkA()])[0]; expect(p.actionType).toBeTruthy(); expect(typeof p.score).toBe('number'); expect(p.reasoning).toBeTruthy(); expect(typeof p.reviewRequired).toBe('boolean'); expect(typeof p.estimatedTokens).toBe('number'); });
  it('preserves goal IDs', () => expect(new ActionProposer(new BudgetTracker({ actionsLimit: 10, tokenLimit: 50000 }), 'assist').propose([mkA({ goalIds: ['g1', 'g2'] })])[0].goalIds).toEqual(['g1', 'g2']));
});
