/**
 * SafetyGuardrails unit tests
 */

import { SafetyGuardrails } from '../../src/core/SafetyGuardrails.js';

describe('SafetyGuardrails', () => {
  describe('budget', () => {
    it('should pass when budget not exceeded', () => {
      const guard = new SafetyGuardrails({ maxBudgetUsd: 1.00 });
      guard.recordApiCost(0.50);
      expect(guard.checkBudget()).toBe(true);
    });

    it('should trip when budget exceeded', () => {
      const guard = new SafetyGuardrails({ maxBudgetUsd: 1.00 });
      guard.recordApiCost(0.99);
      expect(guard.checkBudget()).toBe(true);
      guard.recordApiCost(0.02);
      expect(guard.checkBudget()).toBe(false);
    });

    it('should track cumulative costs', () => {
      const guard = new SafetyGuardrails({ maxBudgetUsd: 5.00 });
      guard.recordApiCost(1.00);
      guard.recordApiCost(2.00);
      expect(guard.getBudgetUsed()).toBe(3.00);
      expect(guard.checkBudget()).toBe(true);
    });
  });

  describe('circuit breaker', () => {
    it('should pass when fitness is above threshold', () => {
      const guard = new SafetyGuardrails({
        circuitBreakerThreshold: 0.3,
        circuitBreakerConsecutive: 3,
      });
      expect(guard.checkCircuitBreaker(0.8)).toBe(true);
    });

    it('should accumulate low fitness and trip after N consecutive', () => {
      const guard = new SafetyGuardrails({
        circuitBreakerThreshold: 0.3,
        circuitBreakerConsecutive: 4,
      });
      expect(guard.checkCircuitBreaker(0.2)).toBe(true);  // count=1
      expect(guard.checkCircuitBreaker(0.1)).toBe(true);  // count=2
      expect(guard.checkCircuitBreaker(0.2)).toBe(true);  // count=3
      expect(guard.checkCircuitBreaker(0.1)).toBe(false); // count=4, trip
    });

    it('should reset on high fitness', () => {
      const guard = new SafetyGuardrails({
        circuitBreakerThreshold: 0.3,
        circuitBreakerConsecutive: 4,
      });
      guard.checkCircuitBreaker(0.2); // count=1
      guard.checkCircuitBreaker(0.2); // count=2
      guard.checkCircuitBreaker(0.8); // reset count=0
      guard.checkCircuitBreaker(0.2); // count=1
      guard.checkCircuitBreaker(0.2); // count=2
      expect(guard.checkCircuitBreaker(0.2)).toBe(true); // count=3, not tripped yet
    });
  });

  describe('rate limit', () => {
    it('should pass when under limit', () => {
      const guard = new SafetyGuardrails({ rateLimitPerMinute: 5 });
      guard.recordApiCall();
      expect(guard.checkRateLimit()).toBe(true);
    });

    it('should trip when over limit', () => {
      const guard = new SafetyGuardrails({ rateLimitPerMinute: 3 });
      guard.recordApiCall();
      guard.recordApiCall();
      guard.recordApiCall();
      expect(guard.checkRateLimit()).toBe(false);
    });
  });

  describe('stop file', () => {
    it('should pass when no stop file exists', () => {
      const guard = new SafetyGuardrails({ stopFilePath: '/tmp/nonexistent-stop-file-test-' + Date.now() });
      expect(guard.checkStopFile()).toBe(true);
    });
  });

  describe('checkAll', () => {
    it('should pass when all checks pass', () => {
      const guard = new SafetyGuardrails({
        maxBudgetUsd: 10,
        circuitBreakerConsecutive: 10,
        rateLimitPerMinute: 100,
        stopFilePath: '/tmp/nonexistent-stop-file-test-' + Date.now(),
      });
      expect(guard.checkAll(0.8)).toBe(true);
    });

    it('should fail when budget exceeded', () => {
      const guard = new SafetyGuardrails({
        maxBudgetUsd: 0.01,
        rateLimitPerMinute: 100,
        stopFilePath: '/tmp/nonexistent-stop-file-test-' + Date.now(),
      });
      guard.recordApiCost(1.00);
      expect(guard.checkAll()).toBe(false);
    });

    it('should fail when circuit breaker trips', () => {
      const guard = new SafetyGuardrails({
        maxBudgetUsd: 10,
        circuitBreakerThreshold: 0.5,
        circuitBreakerConsecutive: 2,
        rateLimitPerMinute: 100,
        stopFilePath: '/tmp/nonexistent-stop-file-test-' + Date.now(),
      });
      guard.checkCircuitBreaker(0.1);
      guard.checkCircuitBreaker(0.1);
      expect(guard.checkAll(0.1)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const guard = new SafetyGuardrails({ maxBudgetUsd: 0.01 });
      guard.recordApiCost(1.00);
      guard.recordApiCall();
      guard.checkCircuitBreaker(0.1);
      guard.reset();
      expect(guard.checkBudget()).toBe(true);
      expect(guard.checkRateLimit()).toBe(true);
      expect(guard.checkCircuitBreaker(0.1)).toBe(true);
    });
  });
});
