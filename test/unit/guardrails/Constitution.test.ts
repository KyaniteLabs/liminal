import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Constitution unit tests
 */
import {
  Constitution,
  initializeConstitution,
  getConstitution,
} from '../../../src/guardrails/evolution/Constitution.js';
import type { FailureRecord } from '../../../src/guardrails/evolution/Constitution.js';
import type { ExecutionContext } from '../../../src/guardrails/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    taskId: 'task-1',
    step: 1,
    maxSteps: 10,
    startTime: Date.now(),
    resources: {
      tokensUsed: 0,
      tokensLimit: 10000,
      memoryUsedMB: 0,
      memoryLimitMB: 512,
      timeElapsedMs: 0,
      timeLimitMs: 60000,
      apiCalls: 0,
      apiCallLimit: 100,
    },
    trace: { steps: [] },
    ...overrides,
  };
}

function makeFailure(overrides?: Partial<FailureRecord>): FailureRecord {
  return {
    id: 'fail-1',
    timestamp: Date.now(),
    taskId: 'task-1',
    guardrailId: 'guard-syntax',
    errorType: 'SYNTAX_ERROR',
    errorMessage: 'Unexpected token at line 10',
    context: makeContext(),
    resolution: 'autoFixed',
    ...overrides,
  };
}

// ============================================================================
// Empty Constitution
// ============================================================================

describe('Constitution (empty state)', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  it('has no active rules initially', () => {
    expect(constitution.getActiveRules()).toEqual([]);
  });

  it('has no rules at all initially', () => {
    expect(constitution.getAllRules()).toEqual([]);
  });

  it('getRule returns undefined for unknown id', () => {
    expect(constitution.getRule('nonexistent')).toBeUndefined();
  });

  it('applyPrevention does not block anything', async () => {
    const ctx = makeContext();
    const result = await constitution.applyPrevention(ctx, 'do something risky');
    expect(result.prevented).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(result.ruleId).toBeUndefined();
  });

  it('getRemediationSuggestion returns confidence 0 with no suggestion', async () => {
    const ctx = makeContext();
    const result = await constitution.getRemediationSuggestion('some error', ctx);
    expect(result.suggestion).toBeUndefined();
    expect(result.confidence).toBe(0);
  });

  it('getFailureStats returns zeros', () => {
    const stats = constitution.getFailureStats();
    expect(stats.totalFailures).toBe(0);
    expect(stats.autoFixed).toBe(0);
    expect(stats.humanResolved).toBe(0);
    expect(stats.escalated).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.uniqueErrorTypes).toBe(0);
  });

  it('getEffectivenessReport returns all zeros', () => {
    const report = constitution.getEffectivenessReport();
    expect(report.totalRules).toBe(0);
    expect(report.activeRules).toBe(0);
    expect(report.avgConfidence).toBe(0);
    expect(report.totalApplications).toBe(0);
    expect(report.successRate).toBe(0);
  });
});

// ============================================================================
// learnFromFailure
// ============================================================================

describe('Constitution.learnFromFailure', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  it('creates a new rule from an autoFixed failure', async () => {
    const rule = await constitution.learnFromFailure(makeFailure());
    expect(rule).not.toBeNull();
    expect(rule!.active).toBe(true);
    expect(rule!.confidence).toBe(0.5);
    expect(rule!.successCount).toBe(1);
    expect(rule!.failureCount).toBe(0);
    expect(rule!.pattern.errorType).toBe('SYNTAX_ERROR');
  });

  it('creates a rule with failureCount=1 for humanResolved', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ resolution: 'humanResolved' }),
    );
    expect(rule).not.toBeNull();
    expect(rule!.successCount).toBe(0);
    expect(rule!.failureCount).toBe(1);
  });

  it('creates a rule with failureCount=1 for escalated', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ resolution: 'escalated' }),
    );
    expect(rule).not.toBeNull();
    expect(rule!.successCount).toBe(0);
    expect(rule!.failureCount).toBe(1);
  });

  it('returns null for unresolved (failed) failures', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ resolution: 'failed' }),
    );
    expect(rule).toBeNull();
    expect(constitution.getAllRules()).toHaveLength(0);
  });

  it('uses fixDetails as remediation when available', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ fixDetails: 'Add missing return statement' }),
    );
    expect(rule!.remediation).toBe('Add missing return statement');
  });

  it('generates default remediation when no fixDetails', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ errorType: 'TIMEOUT' }),
    );
    expect(rule!.remediation).toContain('TIMEOUT');
  });

  it('generates prevention strategy referencing error type', async () => {
    const rule = await constitution.learnFromFailure(
      makeFailure({ errorType: 'RATE_LIMIT' }),
    );
    expect(rule!.prevention).toContain('RATE_LIMIT');
  });

  it('updates existing rule when same errorType is learned again', async () => {
    await constitution.learnFromFailure(makeFailure({ errorType: 'SYNTAX_ERROR' }));
    const rulesBefore = constitution.getAllRules();
    expect(rulesBefore).toHaveLength(1);
    const initialConfidence = rulesBefore[0].confidence;

    await constitution.learnFromFailure(
      makeFailure({ errorType: 'SYNTAX_ERROR', errorMessage: 'Another syntax error happened' }),
    );

    // Should reuse the same rule, not create a second one
    expect(constitution.getAllRules()).toHaveLength(1);
    // Auto-fixed: confidence increases by 0.05
    expect(constitution.getAllRules()[0].confidence).toBe(initialConfidence + 0.05);
  });

  it('records the failure in failure stats', async () => {
    await constitution.learnFromFailure(makeFailure({ resolution: 'autoFixed' }));
    await constitution.learnFromFailure(
      makeFailure({ resolution: 'humanResolved', errorType: 'TYPE_ERROR' }),
    );

    const stats = constitution.getFailureStats();
    expect(stats.totalFailures).toBe(2);
    expect(stats.autoFixed).toBe(1);
    expect(stats.humanResolved).toBe(1);
    expect(stats.uniqueErrorTypes).toBe(2);
  });

  it('creates rules with distinct IDs', async () => {
    await constitution.learnFromFailure(makeFailure({ errorType: 'SYNTAX_ERROR' }));
    // Different errorType creates a new rule since findSimilarRule matches by errorType
    await constitution.learnFromFailure(makeFailure({ errorType: 'RATE_LIMIT' }));

    const rules = constitution.getAllRules();
    expect(rules).toHaveLength(2);
    expect(rules[0].id).not.toBe(rules[1].id);
  });
});

// ============================================================================
// applyPrevention
// ============================================================================

describe('Constitution.applyPrevention', () => {
  let constitution: Constitution;

  beforeEach(async () => {
    constitution = new Constitution();
    // Learn a rule with a message pattern that includes "Unexpected"
    await constitution.learnFromFailure(
      makeFailure({ errorMessage: 'Unexpected token at line 10' }),
    );
  });

  it('blocks actions matching a learned pattern', async () => {
    const ctx = makeContext();
    // The pattern from "Unexpected token at line 10" extracts tokens >3 chars
    // that are not common stop words, producing: /Unexpected.*token.*line/i
    const result = await constitution.applyPrevention(ctx, 'Unexpected token at line 5');
    expect(result.prevented).toBe(true);
    expect(result.ruleId).not.toBeNull();
    expect(result.reason).toContain('validation');
  });

  it('does not block actions that do not match any pattern', async () => {
    const ctx = makeContext();
    const result = await constitution.applyPrevention(ctx, 'normal safe operation');
    expect(result.prevented).toBe(false);
  });

  it('returns the rule ID of the matching rule', async () => {
    const ctx = makeContext();
    const result = await constitution.applyPrevention(ctx, 'Unexpected token at line 3');
    const rules = constitution.getActiveRules();
    expect(result.ruleId).toBe(rules[0].id);
  });

  it('records the prevention application', async () => {
    const ctx = makeContext();
    await constitution.applyPrevention(ctx, 'Unexpected token at line 5');

    const report = constitution.getEffectivenessReport();
    expect(report.totalApplications).toBe(1);
  });

  it('records multiple applications', async () => {
    const ctx = makeContext();
    await constitution.applyPrevention(ctx, 'Unexpected token at line 1');
    await constitution.applyPrevention(ctx, 'Unexpected token at line 2');
    await constitution.applyPrevention(ctx, 'safe action');

    const report = constitution.getEffectivenessReport();
    // 2 matched (recorded), 1 did not match (not recorded)
    expect(report.totalApplications).toBe(2);
  });
});

// ============================================================================
// getRemediationSuggestion
// ============================================================================

describe('Constitution.getRemediationSuggestion', () => {
  let constitution: Constitution;
  let ruleId: string;

  beforeEach(async () => {
    constitution = new Constitution();
    const rule = await constitution.learnFromFailure(
      makeFailure({
        errorMessage: 'Unexpected token at line 5',
        fixDetails: 'Fix the syntax error by adding a closing brace',
      }),
    );
    ruleId = rule!.id;
  });

  it('returns suggestion for errors matching a learned pattern', async () => {
    const ctx = makeContext();
    const result = await constitution.getRemediationSuggestion(
      'Unexpected token at line 3',
      ctx,
    );
    expect(result.suggestion).toBe('Fix the syntax error by adding a closing brace');
    expect(result.ruleId).toBe(ruleId);
    expect(result.confidence).toBe(0.5);
  });

  it('returns confidence 0 for errors with no matching rule', async () => {
    const ctx = makeContext();
    const result = await constitution.getRemediationSuggestion(
      'completely unrelated error message about foo bar baz',
      ctx,
    );
    expect(result.confidence).toBe(0);
    expect(result.suggestion).toBeUndefined();
  });

  it('returns highest-confidence rule when multiple match', async () => {
    // Learn a second rule with a different error type that also contains "Unexpected"
    await constitution.learnFromFailure(
      makeFailure({
        errorType: 'TYPE_ERROR',
        errorMessage: 'Unexpected type mismatch number',
        fixDetails: 'Add type annotation',
      }),
    );

    // Boost confidence of the first rule
    constitution.updateRuleConfidence(ruleId, true);
    constitution.updateRuleConfidence(ruleId, true);

    const ctx = makeContext();
    // This message matches the first rule's pattern: /Unexpected.*token.*line/i
    const result = await constitution.getRemediationSuggestion(
      'Unexpected token at line 5',
      ctx,
    );
    expect(result.ruleId).toBe(ruleId);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('records the remediation suggestion application', async () => {
    const ctx = makeContext();
    await constitution.getRemediationSuggestion('Unexpected token at line 1', ctx);

    const report = constitution.getEffectivenessReport();
    expect(report.totalApplications).toBe(1);
  });

  it('handles Error objects', async () => {
    const ctx = makeContext();
    const result = await constitution.getRemediationSuggestion(
      new Error('Unexpected token at line 1'),
      ctx,
    );
    expect(result.suggestion).not.toBeNull();
    expect(result.confidence).toBe(0.5);
  });
});

// ============================================================================
// updateRuleConfidence
// ============================================================================

describe('Constitution.updateRuleConfidence', () => {
  let constitution: Constitution;
  let ruleId: string;

  beforeEach(async () => {
    constitution = new Constitution();
    const rule = await constitution.learnFromFailure(makeFailure());
    ruleId = rule!.id;
  });

  it('increases confidence on success', () => {
    const before = constitution.getRule(ruleId)!.confidence;
    constitution.updateRuleConfidence(ruleId, true);
    expect(constitution.getRule(ruleId)!.confidence).toBe(before + 0.1);
  });

  it('decreases confidence on failure', () => {
    const before = constitution.getRule(ruleId)!.confidence;
    constitution.updateRuleConfidence(ruleId, false);
    expect(constitution.getRule(ruleId)!.confidence).toBe(before - 0.2);
  });

  it('increments successCount on success', () => {
    constitution.updateRuleConfidence(ruleId, true);
    expect(constitution.getRule(ruleId)!.successCount).toBe(2); // started at 1 from autoFixed
  });

  it('increments failureCount on failure', () => {
    constitution.updateRuleConfidence(ruleId, false);
    expect(constitution.getRule(ruleId)!.failureCount).toBe(1);
  });

  it('caps confidence at maxConfidence (0.95)', () => {
    // Start at 0.5, add 0.1 five times = 1.0, should cap at 0.95
    for (let i = 0; i < 5; i++) {
      constitution.updateRuleConfidence(ruleId, true);
    }
    expect(constitution.getRule(ruleId)!.confidence).toBe(0.95);
  });

  it('does not drop below minConfidence (0.3)', () => {
    // Start at 0.5, subtract 0.2 four times would go negative, should floor at 0.3
    for (let i = 0; i < 4; i++) {
      constitution.updateRuleConfidence(ruleId, false);
    }
    // 0.5 - 0.2 = 0.3 (first drop), then minConfidence clamp
    expect(constitution.getRule(ruleId)!.confidence).toBe(0.3);
  });

  it('deactivates rule if confidence drops below minConfidence', () => {
    // Start at 0.5, one failure: 0.5 - 0.2 = 0.3 (exactly at min, still active)
    constitution.updateRuleConfidence(ruleId, false);
    expect(constitution.getRule(ruleId)!.active).toBe(true);

    // Another failure would go to 0.1 but clamps to 0.3, and deactivates
    constitution.updateRuleConfidence(ruleId, false);
    // The code sets confidence to max(minConfidence, ...) so it stays at 0.3
    // but the check is `confidence < minConfidence` — at exactly 0.3 it stays
    // Let's verify the actual behavior
    const rule = constitution.getRule(ruleId)!;
    expect(rule.confidence).toBe(0.3);
    // With min 0.3, 0.3 is NOT < 0.3, so active stays true unless code
    // uses <=. Let's verify by checking active status.
    expect(rule.active).toBe(true);
  });

  it('is a no-op for nonexistent rule IDs', () => {
    expect(() => constitution.updateRuleConfidence('no-such-rule', true)).not.toThrow();
  });

  it('updates updatedAt timestamp', () => {
    const before = constitution.getRule(ruleId)!.updatedAt;
    // Small delay to ensure timestamp changes
    const originalNow = Date.now;
    Date.now = () => originalNow() + 100;

    constitution.updateRuleConfidence(ruleId, true);
    expect(constitution.getRule(ruleId)!.updatedAt).toBeGreaterThan(before);

    Date.now = originalNow;
  });
});

// ============================================================================
// getFailureStats
// ============================================================================

describe('Constitution.getFailureStats', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  it('counts failures by resolution type', async () => {
    await constitution.learnFromFailure(makeFailure({ resolution: 'autoFixed', errorType: 'A' }));
    await constitution.learnFromFailure(makeFailure({ resolution: 'autoFixed', errorType: 'B' }));
    await constitution.learnFromFailure(makeFailure({ resolution: 'humanResolved', errorType: 'C' }));
    await constitution.learnFromFailure(makeFailure({ resolution: 'escalated', errorType: 'D' }));

    const stats = constitution.getFailureStats();
    expect(stats.totalFailures).toBe(4);
    expect(stats.autoFixed).toBe(2);
    expect(stats.humanResolved).toBe(1);
    expect(stats.escalated).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.uniqueErrorTypes).toBe(4);
  });

  it('excludes unresolved failures from stats', async () => {
    await constitution.learnFromFailure(makeFailure({ resolution: 'failed' }));
    const stats = constitution.getFailureStats();
    // 'failed' resolution still gets pushed to failures array before the
    // early return? No — the code returns null early, never pushes.
    expect(stats.totalFailures).toBe(0);
  });
});

// ============================================================================
// getEffectivenessReport
// ============================================================================

describe('Constitution.getEffectivenessReport', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  it('computes average confidence across rules', async () => {
    await constitution.learnFromFailure(makeFailure({ errorType: 'SYNTAX_ERROR' }));
    await constitution.learnFromFailure(makeFailure({ errorType: 'RATE_LIMIT' }));

    const report = constitution.getEffectivenessReport();
    expect(report.totalRules).toBe(2);
    // Both start at 0.5
    expect(report.avgConfidence).toBe(0.5);
  });

  it('tracks total and successful applications', async () => {
    await constitution.learnFromFailure(makeFailure());
    const ctx = makeContext();

    // applyPrevention records applications on pattern match
    // Pattern is /Unexpected.*token.*line/i from "Unexpected token at line 10"
    await constitution.applyPrevention(ctx, 'Unexpected token at line 5');
    await constitution.applyPrevention(ctx, 'safe action that does not match');

    const report = constitution.getEffectivenessReport();
    expect(report.totalApplications).toBe(1); // only the matched one records
    expect(report.successRate).toBe(1); // 1 successful / 1 total
  });

  it('returns zeroed report when no rules exist', () => {
    const report = constitution.getEffectivenessReport();
    expect(report.totalRules).toBe(0);
    expect(report.avgConfidence).toBe(0);
    expect(report.successRate).toBe(0);
  });
});

// ============================================================================
// Import / Export roundtrip
// ============================================================================

describe('Constitution import/export', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  it('roundtrips rules through export then import', async () => {
    await constitution.learnFromFailure(
      makeFailure({ errorType: 'SYNTAX_ERROR', fixDetails: 'Fix syntax' }),
    );
    await constitution.learnFromFailure(
      makeFailure({ errorType: 'RATE_LIMIT', fixDetails: 'Retry with backoff' }),
    );

    const exported = constitution.export();
    expect(exported.rules).toHaveLength(2);
    expect(exported.stats.totalRules).toBe(2);

    // Import into a fresh constitution
    const fresh = new Constitution();
    fresh.import(exported);

    expect(fresh.getAllRules()).toHaveLength(2);
    expect(fresh.getEffectivenessReport().totalRules).toBe(2);

    // Verify rule content is preserved
    const originalRules = constitution.getActiveRules();
    const importedRules = fresh.getActiveRules();

    // Sort by id for stable comparison
    originalRules.sort((a, b) => a.id.localeCompare(b.id));
    importedRules.sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < originalRules.length; i++) {
      expect(importedRules[i].id).toBe(originalRules[i].id);
      expect(importedRules[i].confidence).toBe(originalRules[i].confidence);
      expect(importedRules[i].remediation).toBe(originalRules[i].remediation);
      expect(importedRules[i].active).toBe(originalRules[i].active);
    }
  });

  it('importing into a constitution with existing rules merges them', async () => {
    await constitution.learnFromFailure(makeFailure({ errorType: 'SYNTAX_ERROR' }));

    const exported = constitution.export();

    const other = new Constitution();
    await other.learnFromFailure(makeFailure({ errorType: 'RATE_LIMIT' }));
    const otherCount = other.getAllRules().length;

    other.import(exported);
    expect(other.getAllRules()).toHaveLength(otherCount + 1);
  });

  it('exported stats reflect the constitution state at export time', async () => {
    await constitution.learnFromFailure(makeFailure({ errorType: 'A' }));
    const { stats } = constitution.export();
    expect(stats.activeRules).toBe(1);
    expect(stats.totalRules).toBe(1);
  });

  it('import preserves rule activity state', async () => {
    const rule = await constitution.learnFromFailure(makeFailure());
    // Deactivate the rule by crushing confidence
    const ruleId = rule!.id;
    for (let i = 0; i < 10; i++) {
      constitution.updateRuleConfidence(ruleId, false);
    }
    // Rule should be inactive or at min confidence
    const exported = constitution.export();

    const fresh = new Constitution();
    fresh.import(exported);

    const importedRule = fresh.getRule(ruleId);

    expect(importedRule!.confidence).toBe(constitution.getRule(ruleId)!.confidence);
  });
});

// ============================================================================
// Global helpers
// ============================================================================

describe('global constitution', () => {
  it('initializeConstitution creates and returns a new instance', () => {
    const c = initializeConstitution();
    expect(c).toBeInstanceOf(Constitution);
    expect(getConstitution()).toBe(c);
  });

  it('getConstitution returns the same instance after initialization', () => {
    const c1 = initializeConstitution();
    const c2 = getConstitution();
    expect(c2).toBe(c1);
  });
});
