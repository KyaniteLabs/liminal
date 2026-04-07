/**
 * Tests for M18: Resilience Guardrail
 *
 * Exercises circuit breaker state transitions (closed -> open -> half-open -> closed),
 * evaluate() behavior under each state, and remediate().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ResilienceGuardrail,
  getCircuitBreaker,
  recordFailure,
  recordSuccess,
  canExecute,
} from '../../../../src/guardrails/compliance/ResilienceGuardrail.js';
import type { CircuitBreakerState } from '../../../../src/guardrails/compliance/ResilienceGuardrail.js';
import type { ExecutionContext, GuardrailResult } from '../../../../src/guardrails/core/types.js';
import { GuardrailTier } from '../../../../src/guardrails/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    taskId: `resilience-task-${Math.random().toString(36).slice(2, 8)}`,
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

// ---------------------------------------------------------------------------
// getCircuitBreaker
// ---------------------------------------------------------------------------

describe('getCircuitBreaker', () => {
  it('creates a new circuit breaker in closed state', () => {
    const taskId = `cb-new-${Date.now()}`;
    const cb = getCircuitBreaker(taskId);

    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
    expect(cb.lastFailure).toBe(0);
  });

  it('returns the same breaker on subsequent calls for the same task', () => {
    const taskId = `cb-same-${Date.now()}`;
    const cb1 = getCircuitBreaker(taskId);
    const cb2 = getCircuitBreaker(taskId);

    expect(cb1).toBe(cb2); // same reference
  });
});

// ---------------------------------------------------------------------------
// recordFailure
// ---------------------------------------------------------------------------

describe('recordFailure', () => {
  it('increments failure count', () => {
    const taskId = `fail-incr-${Date.now()}`;
    recordFailure(taskId);
    const cb = getCircuitBreaker(taskId);

    expect(cb.failures).toBe(1);
  });

  it('sets lastFailure timestamp', () => {
    const taskId = `fail-ts-${Date.now()}`;
    const before = Date.now();
    recordFailure(taskId);
    const cb = getCircuitBreaker(taskId);

    expect(cb.lastFailure).toBeGreaterThanOrEqual(before);
  });

  it('transitions to open state after 5 failures', () => {
    const taskId = `fail-open-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    const cb = getCircuitBreaker(taskId);

    expect(cb.state).toBe('open');
    expect(cb.failures).toBe(5);
  });

  it('remains in closed state after 4 failures', () => {
    const taskId = `fail-closed-${Date.now()}`;
    for (let i = 0; i < 4; i++) {
      recordFailure(taskId);
    }
    const cb = getCircuitBreaker(taskId);

    expect(cb.state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// recordSuccess
// ---------------------------------------------------------------------------

describe('recordSuccess', () => {
  it('closes the circuit when in half-open state', () => {
    const taskId = `succ-halfopen-${Date.now()}`;
    // Drive to open
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    // Manually set to half-open for testing
    const cb = getCircuitBreaker(taskId);
    cb.state = 'half-open';

    recordSuccess(taskId);

    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
  });

  it('has no effect when circuit is already closed', () => {
    const taskId = `succ-closed-${Date.now()}`;
    const cb = getCircuitBreaker(taskId);
    expect(cb.state).toBe('closed');

    recordSuccess(taskId);
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// canExecute
// ---------------------------------------------------------------------------

describe('canExecute', () => {
  it('returns true when circuit is closed', () => {
    const taskId = `can-closed-${Date.now()}`;
    expect(canExecute(taskId)).toBe(true);
  });

  it('returns false when circuit is open and timeout has not elapsed', () => {
    const taskId = `can-open-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    // The failures just happened, so timeout hasn't elapsed
    expect(canExecute(taskId)).toBe(false);
  });

  it('returns true and transitions to half-open when timeout has elapsed', () => {
    const taskId = `can-halfopen-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    // Simulate timeout by rewinding lastFailure
    const cb = getCircuitBreaker(taskId);
    cb.lastFailure = Date.now() - 61000; // 61 seconds ago (> 60000ms timeout)

    const result = canExecute(taskId);
    expect(result).toBe(true);
    expect(cb.state).toBe('half-open');
  });

  it('returns true when circuit is half-open', () => {
    const taskId = `can-ho-execute-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    const cb = getCircuitBreaker(taskId);
    cb.state = 'half-open';

    expect(canExecute(taskId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ResilienceGuardrail.evaluate
// ---------------------------------------------------------------------------

describe('ResilienceGuardrail.evaluate', () => {
  it('has correct static metadata', () => {
    expect(ResilienceGuardrail.id).toBe('guardrail-m18-resilience');
    expect(ResilienceGuardrail.tier).toBe(GuardrailTier.AUTONOMOUS);
    expect(ResilienceGuardrail.category).toBe('compliance');
  });

  it('passes when circuit breaker is closed', async () => {
    const ctx = makeContext();
    const result = await ResilienceGuardrail.evaluate(ctx);

    expect(result.passed).toBe(true);
    expect(result.guardrailId).toBe('guardrail-m18-resilience');
    expect(result.message).toBe('Circuit breaker allows execution');
  });

  it('includes breaker state and failure count in details when passing', async () => {
    const ctx = makeContext();
    const result = await ResilienceGuardrail.evaluate(ctx);

    const details = result.details as { state: string; failures: number };
    expect(details.state).toBe('closed');
    expect(details.failures).toBe(0);
  });

  it('fails with error severity when circuit breaker is open', async () => {
    const taskId = `eval-open-${Date.now()}`;
    // Drive to open state
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }

    const ctx = makeContext({ taskId });
    const result = await ResilienceGuardrail.evaluate(ctx);

    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('Circuit breaker OPEN');
    expect(result.message).toContain(taskId);
  });

  it('includes failure details when circuit is open', async () => {
    const taskId = `eval-details-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }

    const ctx = makeContext({ taskId });
    const result = await ResilienceGuardrail.evaluate(ctx);

    const details = result.details as {
      failures: number;
      lastFailure: number;
      state: string;
    };
    expect(details.failures).toBe(5);
    expect(details.state).toBe('open');
    expect(details.lastFailure).toBeGreaterThan(0);
  });

  it('suggests waiting for reset when circuit is open', async () => {
    const taskId = `eval-suggest-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }

    const ctx = makeContext({ taskId });
    const result = await ResilienceGuardrail.evaluate(ctx);

    expect(result.suggestion).toBe('Wait for circuit breaker to reset or use fallback');
  });

  it('closes the circuit after half-open success via evaluate', async () => {
    const taskId = `eval-recover-${Date.now()}`;
    // Drive to open
    for (let i = 0; i < 5; i++) {
      recordFailure(taskId);
    }
    // Force to half-open
    const cb = getCircuitBreaker(taskId);
    cb.lastFailure = Date.now() - 61000;
    canExecute(taskId); // triggers transition to half-open
    expect(cb.state).toBe('half-open');

    // Evaluate should succeed and close the circuit
    const ctx = makeContext({ taskId });
    const result = await ResilienceGuardrail.evaluate(ctx);

    expect(result.passed).toBe(true);
    // After evaluate, recordSuccess is called which should close the circuit
    expect(cb.state).toBe('closed');
    expect(cb.failures).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ResilienceGuardrail.remediate
// ---------------------------------------------------------------------------

describe('ResilienceGuardrail.remediate', () => {
  it('returns a fallback remediation result', async () => {
    const ctx = makeContext();
    const violation: GuardrailResult = {
      passed: false,
      guardrailId: 'guardrail-m18-resilience',
      message: 'Circuit breaker OPEN',
    };

    const result = await ResilienceGuardrail.remediate!(ctx, violation);

    expect(result.success).toBe(true);
    expect(result.action).toBe('fallback');
    expect(result.message).toBe('Switching to fallback mode');
  });
});
