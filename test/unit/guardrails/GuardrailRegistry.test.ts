import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — required for vi.mock() factory references
// ---------------------------------------------------------------------------

const { mockRecordEval, mockRecordRemediation, mockRecordEscalation } = vi.hoisted(() => ({
  mockRecordEval: vi.fn(),
  mockRecordRemediation: vi.fn(),
  mockRecordEscalation: vi.fn(),
}));

vi.mock('../../../src/guardrails/observation/TelemetryCollector.js', () => ({
  getTelemetry: () => ({
    recordGuardrailEvaluation: mockRecordEval,
    recordRemediation: mockRecordRemediation,
    recordEscalation: mockRecordEscalation,
  }),
  TelemetryCollector: class {},
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GuardrailRegistry, initializeGuardrails, getGuardrailRegistry } from '../../../src/guardrails/core/GuardrailRegistry.js';
import { GuardrailTier } from '../../../src/guardrails/core/types.js';
import type { GuardrailRule, ExecutionContext, GuardrailResult } from '../../../src/guardrails/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    taskId: 'test-task',
    step: 1,
    maxSteps: 10,
    startTime: Date.now(),
    resources: {
      tokensUsed: 0,
      tokensLimit: 10000,
      memoryUsedMB: 50,
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

function makePassingRule(id: string, category: 'catastrophic' | 'correctness' | 'hygiene' | 'evolution' | 'compliance' = 'correctness'): GuardrailRule {
  return {
    id,
    description: `Passing rule ${id}`,
    tier: GuardrailTier.ENFORCING,
    category,
    evaluate: vi.fn().mockResolvedValue({
      passed: true,
      guardrailId: id,
      message: 'All good',
    }),
  };
}

function makeFailingRule(id: string, category: 'catastrophic' | 'correctness' | 'hygiene' | 'evolution' | 'compliance' = 'correctness'): GuardrailRule {
  return {
    id,
    description: `Failing rule ${id}`,
    tier: GuardrailTier.ENFORCING,
    category,
    evaluate: vi.fn().mockResolvedValue({
      passed: false,
      guardrailId: id,
      message: `Violation from ${id}`,
      severity: 'warning' as const,
    }),
  };
}

// ===========================================================================
// GuardrailRegistry
// ===========================================================================

describe('GuardrailRegistry', () => {
  let registry: GuardrailRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new GuardrailRegistry({ shadowMode: false });
  });

  // ─── register / unregister / get ────────────────────────────────────

  describe('registration', () => {
    it('registers a guardrail and retrievesves it by id', () => {
      const rule = makePassingRule('rule-1');
      registry.register(rule);

      expect(registry.get('rule-1')).toBe(rule);
    });

    it('returns undefined for unregistered id', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('getAll returns all registered guardrails', () => {
      const r1 = makePassingRule('a');
      const r2 = makePassingRule('b');
      registry.register(r1);
      registry.register(r2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(g => g.id).sort()).toEqual(['a', 'b']);
    });

    it('unregister removes a guardrail', () => {
      const rule = makePassingRule('to-remove');
      registry.register(rule);
      expect(registry.get('to-remove')).toBe(rule);

      registry.unregister('to-remove');
      expect(registry.get('to-remove')).toBeUndefined();
    });

    it('getByCategory filters correctly', () => {
      registry.register(makePassingRule('cat', 'catastrophic'));
      registry.register(makePassingRule('cor', 'correctness'));
      registry.register(makePassingRule('hyg', 'hygiene'));

      expect(registry.getByCategory('catastrophic')).toHaveLength(1);
      expect(registry.getByCategory('correctness')).toHaveLength(1);
      expect(registry.getByCategory('hygiene')).toHaveLength(1);
      expect(registry.getByCategory('evolution')).toHaveLength(0);
    });
  });

  // ─── evaluate — all passing ─────────────────────────────────────────

  describe('evaluate() — all pass', () => {
    it('returns passed=true when all guardrails pass', async () => {
      registry.register(makePassingRule('g1'));
      registry.register(makePassingRule('g2'));

      const result = await registry.evaluate(makeContext());

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.blockingResults).toEqual([]);
      expect(result.summary).toContain('2/2 passed');
    });
  });

  // ─── evaluate — failures in shadow mode ─────────────────────────────

  describe('evaluate() — shadow mode', () => {
    it('does not block in shadow mode even when guardrails fail', async () => {
      const shadow = new GuardrailRegistry({ shadowMode: true });
      shadow.register(makeFailingRule('fail-1'));

      const result = await shadow.evaluate(makeContext());

      expect(result.passed).toBe(true);
      expect(result.blockingResults).toEqual([]);
      // Still records the failure in results
      expect(result.results).toHaveLength(1);
      expect(result.results[0].passed).toBe(false);
    });
  });

  // ─── evaluate — failures in enforcing mode ──────────────────────────

  describe('evaluate() — enforcing mode blocks', () => {
    it('blocks when a guardrail fails in enforcing mode', async () => {
      registry.register(makePassingRule('pass-1'));
      registry.register(makeFailingRule('fail-1'));

      const result = await registry.evaluate(makeContext());

      expect(result.passed).toBe(false);
      expect(result.blockingResults).toHaveLength(1);
      expect(result.blockingResults[0].guardrailId).toBe('fail-1');
      expect(result.modifiedContext).toBeUndefined();
      expect(result.summary).toContain('1/2 passed');
      expect(result.summary).toContain('1 failed');
      expect(result.summary).toContain('1 blocking');
    });
  });

  // ─── evaluate — remediation ─────────────────────────────────────────

  describe('evaluate() — remediation', () => {
    it('remediates a blocking result with successful fix', async () => {
      const rule: GuardrailRule = {
        id: 'fixable',
        description: 'Can be fixed',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'fixable',
          message: 'Schema mismatch',
          severity: 'warning' as const,
        }),
        remediate: vi.fn().mockResolvedValue({
          success: true,
          action: 'rewrite',
          newContext: { step: 2 },
          message: 'Fixed schema',
        }),
      };

      registry.register(rule);
      const result = await registry.evaluate(makeContext());

      expect(result.passed).toBe(true);
      expect(result.remediatedResults).toHaveLength(1);
      expect(result.blockingResults).toEqual([]);
      expect(result.modifiedContext).toBeDefined();
      expect(result.modifiedContext!.step).toBe(2);
    });

    it('keeps blocking when remediation uses terminal action', async () => {
      const rule: GuardrailRule = {
        id: 'terminal',
        description: 'Terminal fix',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'terminal',
          message: 'Bad',
        }),
        remediate: vi.fn().mockResolvedValue({
          success: true,
          action: 'abort',
          newContext: {},
          message: 'Aborted',
        }),
      };

      registry.register(rule);
      const result = await registry.evaluate(makeContext());

      expect(result.passed).toBe(false);
      expect(result.blockingResults).toHaveLength(1);
    });
  });

  // ─── evaluate — autonomous mode ─────────────────────────────────────

  describe('evaluate() — autonomous tier', () => {
    it('auto-remediates in autonomous mode', async () => {
      const autoRegistry = new GuardrailRegistry({ shadowMode: false });
      const rule: GuardrailRule = {
        id: 'auto-fix',
        description: 'Auto fixable',
        tier: GuardrailTier.AUTONOMOUS,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'auto-fix',
          message: 'Minor issue',
        }),
        remediate: vi.fn().mockResolvedValue({
          success: true,
          action: 'rewrite',
          newContext: { step: 5 },
          message: 'Auto-fixed',
        }),
      };

      autoRegistry.register(rule);
      const result = await autoRegistry.evaluate(makeContext());

      expect(result.passed).toBe(true);
      expect(result.remediatedResults).toHaveLength(1);
    });

    it('blocks when autonomous remediation fails', async () => {
      const autoRegistry = new GuardrailRegistry({ shadowMode: false });
      const rule: GuardrailRule = {
        id: 'auto-fail',
        description: 'Cannot auto-fix',
        tier: GuardrailTier.AUTONOMOUS,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'auto-fail',
          message: 'Critical issue',
        }),
        remediate: vi.fn().mockResolvedValue({
          success: false,
          action: 'fail',
          message: 'Cannot fix',
        }),
      };

      autoRegistry.register(rule);
      const result = await autoRegistry.evaluate(makeContext());

      expect(result.passed).toBe(false);
      expect(result.blockingResults).toHaveLength(1);
    });
  });

  // ─── evaluate — category priority ordering ──────────────────────────

  describe('evaluate() — category priority', () => {
    it('evaluates catastrophic before correctness', async () => {
      const callOrder: string[] = [];

      const catRule: GuardrailRule = {
        id: 'catastrophic-1',
        description: 'Cat',
        tier: GuardrailTier.ENFORCING,
        category: 'catastrophic',
        evaluate: vi.fn().mockImplementation(async () => {
          callOrder.push('catastrophic');
          return { passed: true, guardrailId: 'catastrophic-1', message: 'ok' };
        }),
      };

      const corRule: GuardrailRule = {
        id: 'correctness-1',
        description: 'Cor',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockImplementation(async () => {
          callOrder.push('correctness');
          return { passed: true, guardrailId: 'correctness-1', message: 'ok' };
        }),
      };

      // Register in reverse order
      registry.register(corRule);
      registry.register(catRule);

      await registry.evaluate(makeContext());

      expect(callOrder).toEqual(['catastrophic', 'correctness']);
    });
  });

  // ─── evaluate — escalation ──────────────────────────────────────────

  describe('evaluate() — escalation', () => {
    it('escalates after repeated failures', async () => {
      const onEscalate = vi.fn();
      const rule: GuardrailRule = {
        id: 'escalating',
        description: 'Escalates',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'escalating',
          message: 'Fail',
        }),
        escalation: {
          afterFailures: 2,
          action: 'circuitBreaker',
          onEscalate,
        },
      };

      registry.register(rule);
      const ctx = makeContext();

      // First failure — no escalation yet
      await registry.evaluate(ctx);
      expect(onEscalate).not.toHaveBeenCalled();

      // Second failure — triggers escalation
      await registry.evaluate(ctx);
      expect(onEscalate).toHaveBeenCalledTimes(1);
    });
  });

  // ─── evaluateCategory ───────────────────────────────────────────────

  describe('evaluateCategory()', () => {
    it('only evaluates guardrails in the specified category', async () => {
      registry.register(makePassingRule('cat-rule', 'catastrophic'));
      registry.register(makeFailingRule('cor-rule', 'correctness'));

      const result = await registry.evaluateCategory('catastrophic', makeContext());

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  // ─── checkGuardrail ─────────────────────────────────────────────────

  describe('checkGuardrail()', () => {
    it('returns result for a specific guardrail', async () => {
      registry.register(makePassingRule('target'));

      const result = await registry.checkGuardrail('target', makeContext());

      expect(result).toBeDefined();
      expect(result!.passed).toBe(true);
    });

    it('returns undefined for unknown guardrail', async () => {
      const result = await registry.checkGuardrail('nope', makeContext());
      expect(result).toBeUndefined();
    });
  });

  // ─── violation tracking ─────────────────────────────────────────────

  describe('violation tracking', () => {
    it('tracks violation counts per guardrail', async () => {
      registry.register(makeFailingRule('f1'));

      await registry.evaluate(makeContext());
      await registry.evaluate(makeContext());

      const stats = registry.getViolationStats();
      expect(stats['f1']).toBe(2);
    });

    it('resets violation counts', async () => {
      registry.register(makeFailingRule('f1'));
      await registry.evaluate(makeContext());

      registry.resetViolationCounts();
      const stats = registry.getViolationStats();
      expect(stats['f1']).toBe(0);
    });
  });

  // ─── configuration ─────────────────────────────────────────────────

  describe('configuration', () => {
    it('setShadowMode updates the config', async () => {
      registry.register(makeFailingRule('f1'));

      registry.setShadowMode(true);
      const result = await registry.evaluate(makeContext());

      expect(result.passed).toBe(true);
    });

    it('setDefaultTier changes enforcement behavior', async () => {
      // Start in enforcing mode
      const reg = new GuardrailRegistry({ shadowMode: false });
      reg.setDefaultTier(GuardrailTier.SHADOW);
      reg.register(makeFailingRule('f1'));

      // Guardrail has ENFORCING tier but registry default is SHADOW
      // getEffectiveTier uses guardrail's own tier (ENFORCING) not default
      // since guardrail.tier is explicitly set
      const result = await reg.evaluate(makeContext());
      // The guardrail has tier: ENFORCING, so it will block
      expect(result.passed).toBe(false);
    });
  });

  // ─── global functions ───────────────────────────────────────────────

  describe('global registry', () => {
    it('initializeGuardrails creates a global instance', () => {
      const reg = initializeGuardrails({ shadowMode: true });
      expect(reg).toBeInstanceOf(GuardrailRegistry);
      expect(getGuardrailRegistry()).toBe(reg);
    });
  });

  // ─── telemetry integration ──────────────────────────────────────────

  describe('telemetry', () => {
    it('records evaluation telemetry for each guardrail', async () => {
      registry.register(makePassingRule('t1'));
      registry.register(makePassingRule('t2'));

      await registry.evaluate(makeContext({ taskId: 'tel-task' }));

      expect(mockRecordEval).toHaveBeenCalledTimes(2);
      // First call: taskId, guardrailId, passed, metadata
      expect(mockRecordEval).toHaveBeenCalledWith(
        'tel-task',
        't1',
        true,
        expect.objectContaining({ category: 'correctness' }),
      );
    });

    it('records remediation telemetry', async () => {
      const rule: GuardrailRule = {
        id: 'rem-tel',
        description: 'Remediation telemetry',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'rem-tel',
          message: 'Fail',
        }),
        remediate: vi.fn().mockResolvedValue({
          success: true,
          action: 'rewrite',
          newContext: {},
          message: 'Fixed',
        }),
      };

      registry.register(rule);
      await registry.evaluate(makeContext({ taskId: 'rem-task' }));

      expect(mockRecordRemediation).toHaveBeenCalledWith(
        'rem-task',
        'rem-tel',
        true,
        expect.objectContaining({ action: 'rewrite' }),
      );
    });

    it('records escalation telemetry', async () => {
      const onEscalate = vi.fn();
      const rule: GuardrailRule = {
        id: 'esc-tel',
        description: 'Escalation telemetry',
        tier: GuardrailTier.ENFORCING,
        category: 'correctness',
        evaluate: vi.fn().mockResolvedValue({
          passed: false,
          guardrailId: 'esc-tel',
          message: 'Fail',
        }),
        escalation: { afterFailures: 1, action: 'circuitBreaker' as const, onEscalate },
      };

      registry.register(rule);
      await registry.evaluate(makeContext({ taskId: 'esc-task' }));

      expect(mockRecordEscalation).toHaveBeenCalledWith(
        'esc-task',
        'esc-tel',
        expect.stringContaining('1'),
      );
    });
  });
});
