/**
 * CircuitBreaker — LLM provider failover protection.
 *
 * Prevents cascading failures by tracking consecutive errors against a
 * configurable threshold.  When the threshold is breached the breaker opens
 * (requests are rejected fast) until a cooldown period elapses, at which point
 * it transitions to half-open and allows a limited number of probe requests
 * through.  A successful probe closes the circuit again.
 *
 * Inspired by DialectOS.
 */

// ── Public types ──

/** Possible states of a circuit breaker. */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Configuration options for a CircuitBreaker instance. */
interface CircuitBreakerConfig {
  /** Consecutive failures required to trip the breaker open. */
  failureThreshold: number;
  /** Milliseconds to wait in the open state before transitioning to half-open. */
  resetTimeoutMs: number;
  /** Maximum requests allowed through while in the half-open state. */
  halfOpenMaxAttempts: number;
}

/** Snapshot of the internal health metrics of a circuit breaker. */
interface CircuitStats {
  /** Current breaker state. */
  state: CircuitState;
  /** Consecutive failures since the last success. */
  failureCount: number;
  /** Total successes recorded over the lifetime of this instance. */
  successCount: number;
  /** Epoch timestamp (ms) of the most recent failure, or `null`. */
  lastFailureAt: number | null;
  /** Epoch timestamp (ms) of the most recent state transition. */
  lastStateChangeAt: number;
}

// ── Defaults ──

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
};

// ── Implementation ──

/**
 * Circuit breaker for LLM provider failover.
 *
 * Wrap each provider call with `canExecute()` / `recordSuccess()` /
 * `recordFailure()` to automatically isolate failing providers and recover
 * once they start responding again.
 *
 * @example
 * ```ts
 * const breaker = new CircuitBreaker({ failureThreshold: 3 });
 * if (breaker.canExecute()) {
 *   try {
 *     await callProvider();
 *     breaker.recordSuccess();
 *   } catch {
 *     breaker.recordFailure();
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  /** Current state of the circuit. */
  private state: CircuitState = 'closed';

  /** Consecutive failures since the last success. */
  private failureCount = 0;

  /** Lifetime success counter. */
  private successCount = 0;

  /** Epoch timestamp of the most recent failure. */
  private lastFailureAt: number | null = null;

  /** Epoch timestamp of the most recent state transition. */
  private lastStateChangeAt: number;

  /** Resolved configuration. */
  private readonly config: CircuitBreakerConfig;

  /** Number of requests already attempted during the current half-open window. */
  private halfOpenAttempts = 0;

  /**
   * Create a new CircuitBreaker.
   *
   * @param config - Partial overrides; any omitted field keeps its default
   *   (`failureThreshold: 5`, `resetTimeoutMs: 30_000`, `halfOpenMaxAttempts: 1`).
   */
  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lastStateChangeAt = Date.now();
  }

  /**
   * Whether a new request may be attempted.
   *
   * Returns `true` when the breaker is **closed** (healthy) or **half-open**
   * (probing).  Returns `false` when the breaker is **open** (tripped) and
   * the reset timeout has not yet elapsed.
   */
  canExecute(): boolean {
    this.checkStateTransition();

    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'half-open') {
      return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }

    // open
    return false;
  }

  /**
   * Record a successful call.
   *
   * Increments the lifetime success counter, resets the consecutive-failure
   * streak, and — if the breaker was half-open — closes the circuit.
   */
  recordSuccess(): void {
    this.successCount++;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;

    if (this.state === 'half-open') {
      this.transitionTo('closed');
    }
  }

  /**
   * Record a failed call.
   *
   * Increments the consecutive-failure counter and trips the breaker open if
   * the threshold is reached.  In the half-open state a single failure is
   * enough to re-open the circuit immediately.
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.state === 'half-open') {
      // A single failure in half-open is enough to re-open.
      this.transitionTo('open');
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /**
   * Return the current circuit state.
   *
   * This does **not** trigger an automatic state transition; call
   * `canExecute()` first if you need up-to-date state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Return a snapshot of the internal health metrics.
   *
   * The stats object is a plain copy — mutating it has no effect on the
   * breaker.
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
    };
  }

  /**
   * Manually reset the breaker to the closed state.
   *
   * Clears the failure counter and resets the half-open probe window.
   * Useful for administrative overrides or health-check endpoints.
   */
  reset(): void {
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.transitionTo('closed');
  }

  // ── Private helpers ──

  /**
   * Potentially transition from open to half-open if the reset timeout has
   * elapsed.
   */
  private checkStateTransition(): void {
    if (this.state !== 'open') {
      return;
    }

    const elapsed = Date.now() - this.lastStateChangeAt;
    if (elapsed >= this.config.resetTimeoutMs) {
      this.halfOpenAttempts = 0;
      this.transitionTo('half-open');
    }
  }

  /**
   * Perform a state transition and record the timestamp.
   */
  private transitionTo(next: CircuitState): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    this.lastStateChangeAt = Date.now();
  }
}
