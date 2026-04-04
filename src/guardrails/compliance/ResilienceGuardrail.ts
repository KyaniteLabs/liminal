/**
 * M18: Resilience Guardrail
 *
 * Circuit breakers and graceful degradation.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
  RemediationResult,
} from '../core/types.js';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// Circuit breaker storage
const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60000; // 1 minute

/**
 * Get or create circuit breaker for a task
 */
function getCircuitBreaker(taskId: string): CircuitBreakerState {
  if (!circuitBreakers.has(taskId)) {
    circuitBreakers.set(taskId, {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    });
  }
  return circuitBreakers.get(taskId)!;
}

/**
 * Record failure for circuit breaker
 */
function recordFailure(taskId: string): void {
  const cb = getCircuitBreaker(taskId);
  cb.failures++;
  cb.lastFailure = Date.now();

  if (cb.failures >= FAILURE_THRESHOLD) {
    cb.state = 'open';
  }
}

/**
 * Record success for circuit breaker
 */
function recordSuccess(taskId: string): void {
  const cb = getCircuitBreaker(taskId);
  
  if (cb.state === 'half-open') {
    // Success in half-open state closes the circuit
    cb.failures = 0;
    cb.state = 'closed';
  }
}

/**
 * Check if circuit breaker allows operation
 */
function canExecute(taskId: string): boolean {
  const cb = getCircuitBreaker(taskId);

  if (cb.state === 'closed') {
    return true;
  }

  if (cb.state === 'open') {
    // Check if we should try half-open
    const timeSinceFailure = Date.now() - cb.lastFailure;
    if (timeSinceFailure > RESET_TIMEOUT_MS) {
      cb.state = 'half-open';
      return true;
    }
    return false;
  }

  // Half-open: allow one test request
  return true;
}

/**
 * M18 Resilience Guardrail
 */
export const ResilienceGuardrail: GuardrailRule = {
  id: 'guardrail-m18-resilience',
  description: 'Circuit breakers and graceful degradation',
  tier: GuardrailTier.AUTONOMOUS,
  category: 'compliance',

  // eslint-disable-next-line @typescript-eslint/require-await
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const cb = getCircuitBreaker(context.taskId);

    // Check if circuit breaker allows execution
    if (!canExecute(context.taskId)) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `Circuit breaker OPEN for task ${context.taskId}`,
        details: {
          failures: cb.failures,
          lastFailure: cb.lastFailure,
          state: cb.state,
        },
        suggestion: 'Wait for circuit breaker to reset or use fallback',
      };
    }

    // Record success (will close circuit if half-open)
    recordSuccess(context.taskId);

    return {
      passed: true,
      guardrailId: this.id,
      message: 'Circuit breaker allows execution',
      details: {
        state: cb.state,
        failures: cb.failures,
      },
    };
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  async remediate(): Promise<RemediationResult> {
    return {
      success: true,
      action: 'fallback',
      message: 'Switching to fallback mode',
    };
  },
};

export { getCircuitBreaker, recordFailure, recordSuccess, canExecute };
export type { CircuitBreakerState };
