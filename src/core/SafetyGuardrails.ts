/**
 * SafetyGuardrails - Budget tracking, circuit breaker, rate limiting, stop file check.
 *
 * Provides safety mechanisms for long-running generative loops:
 * - Budget: stop if API costs exceed maxBudgetUsd
 * - Circuit breaker: stop if fitness stays below threshold for N consecutive iterations
 * - Rate limit: throttle to max N API calls per 60-second window
 * - Stop file: halt if a .stop file appears on disk
 */

import fs from 'fs';

export interface SafetyConfig {
  maxBudgetUsd?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerConsecutive?: number;
  rateLimitPerMinute?: number;
  stopFilePath?: string;
}

const DEFAULTS: Required<SafetyConfig> = {
  maxBudgetUsd: 1.00,
  circuitBreakerThreshold: 0.3,
  circuitBreakerConsecutive: 5,
  rateLimitPerMinute: 60,
  stopFilePath: '.stop',
};

export class SafetyGuardrails {
  private config: Required<SafetyConfig>;
  private budgetUsed: number;
  private apiCallsInWindow: number[];
  private consecutiveLowFitness: number;

  constructor(config?: SafetyConfig) {
    this.config = { ...DEFAULTS, ...config };
    this.budgetUsed = 0;
    this.apiCallsInWindow = [];
    this.consecutiveLowFitness = 0;
  }

  /** Returns true if budget is still within limit. */
  checkBudget(): boolean {
    return this.budgetUsed < this.config.maxBudgetUsd;
  }

  /**
   * Returns false (trips) if fitness has been below the threshold for
   * circuitBreakerConsecutive iterations in a row. Returns true otherwise.
   */
  checkCircuitBreaker(currentFitness: number): boolean {
    if (currentFitness < this.config.circuitBreakerThreshold) {
      this.consecutiveLowFitness++;
      if (this.consecutiveLowFitness >= this.config.circuitBreakerConsecutive) {
        return false; // trip
      }
    } else {
      this.consecutiveLowFitness = 0;
    }
    return true;
  }

  /** Returns true if the number of API calls in the last 60s is under the limit. */
  checkRateLimit(): boolean {
    const cutoff = Date.now() - 60_000;
    this.apiCallsInWindow = this.apiCallsInWindow.filter((t) => t > cutoff);
    return this.apiCallsInWindow.length < this.config.rateLimitPerMinute;
  }

  /** Returns true if NO stop file exists (safe to continue). */
  checkStopFile(): boolean {
    return !fs.existsSync(this.config.stopFilePath);
  }

  /**
   * Runs all checks. Returns true only if every check passes.
   * Circuit breaker check is included only when currentFitness is provided.
   */
  checkAll(currentFitness?: number): boolean {
    if (!this.checkBudget()) return false;
    if (currentFitness !== undefined && !this.checkCircuitBreaker(currentFitness)) return false;
    if (!this.checkRateLimit()) return false;
    if (!this.checkStopFile()) return false;
    return true;
  }

  /** Record an API cost in USD. */
  recordApiCost(cost: number): void {
    this.budgetUsed += cost;
  }

  /** Record an API call timestamp for rate limiting. */
  recordApiCall(): void {
    this.apiCallsInWindow.push(Date.now());
  }

  /** Reset all internal state. */
  reset(): void {
    this.budgetUsed = 0;
    this.apiCallsInWindow = [];
    this.consecutiveLowFitness = 0;
  }

  /** Get current budget usage in USD. */
  getBudgetUsed(): number {
    return this.budgetUsed;
  }
}
