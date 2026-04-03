import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
/**
 * SafetyGuardrails unit tests
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SafetyGuardrails } from '../../../src/core/SafetyGuardrails.js';
import { ensureDir } from '../../../src/utils/fs.js';

const tmpDir = path.join(os.tmpdir(), `atelier-safety-test-${Date.now()}`);

beforeAll(() => {
  ensureDir(tmpDir);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  // Clean up any stop files created during tests
  const files = fs.readdirSync(tmpDir);
  for (const f of files) {
    fs.unlinkSync(path.join(tmpDir, f));
  }
});

describe('SafetyGuardrails', () => {
  // 1. Constructor uses defaults
  it('uses default config values', () => {
    const g = new SafetyGuardrails();
    expect(g.getBudgetUsed()).toBe(0);
  });

  // 2. Constructor accepts custom config
  it('accepts custom config', () => {
    const g = new SafetyGuardrails({ maxBudgetUsd: 5.0, rateLimitPerMinute: 120 });
    expect(g.getBudgetUsed()).toBe(0);
    // Record costs up to just under 5 — should still pass budget
    g.recordApiCost(4.99);
    expect(g.checkBudget()).toBe(true);
  });

  // 3. checkBudget returns true when under budget
  it('checkBudget returns true when under budget', () => {
    const g = new SafetyGuardrails({ maxBudgetUsd: 1.0 });
    g.recordApiCost(0.50);
    expect(g.checkBudget()).toBe(true);
  });

  // 4. checkBudget returns false when over budget
  it('checkBudget returns false when at or over budget', () => {
    const g = new SafetyGuardrails({ maxBudgetUsd: 1.0 });
    g.recordApiCost(1.0);
    expect(g.checkBudget()).toBe(false);
  });

  // 5. recordApiCost accumulates
  it('recordApiCost accumulates costs', () => {
    const g = new SafetyGuardrails();
    g.recordApiCost(0.1);
    g.recordApiCost(0.2);
    g.recordApiCost(0.05);
    expect(g.getBudgetUsed()).toBeCloseTo(0.35, 6);
  });

  // 6. checkCircuitBreaker returns true initially
  it('checkCircuitBreaker returns true on first low fitness', () => {
    const g = new SafetyGuardrails({ circuitBreakerThreshold: 0.5, circuitBreakerConsecutive: 3 });
    expect(g.checkCircuitBreaker(0.1)).toBe(true);
  });

  // 7. checkCircuitBreaker trips after N consecutive low fitness values
  it('checkCircuitBreaker trips after N consecutive low fitness values', () => {
    const g = new SafetyGuardrails({ circuitBreakerThreshold: 0.5, circuitBreakerConsecutive: 3 });
    // First two low fitness calls should return true
    expect(g.checkCircuitBreaker(0.1)).toBe(true);
    expect(g.checkCircuitBreaker(0.2)).toBe(true);
    // Third low fitness should trip
    expect(g.checkCircuitBreaker(0.0)).toBe(false);
  });

  // 8. checkCircuitBreaker resets when fitness recovers
  it('checkCircuitBreaker resets counter when fitness recovers', () => {
    const g = new SafetyGuardrails({ circuitBreakerThreshold: 0.5, circuitBreakerConsecutive: 3 });
    expect(g.checkCircuitBreaker(0.1)).toBe(true);
    expect(g.checkCircuitBreaker(0.2)).toBe(true);
    // Fitness recovers — counter resets
    expect(g.checkCircuitBreaker(0.8)).toBe(true);
    // Two more low fitness should not trip because counter was reset
    expect(g.checkCircuitBreaker(0.1)).toBe(true);
    expect(g.checkCircuitBreaker(0.2)).toBe(true);
    // Still safe — only 2 consecutive, not 3
    expect(g.checkCircuitBreaker(0.1)).toBe(false); // now 3
  });

  // 9. checkRateLimit returns true when under limit
  it('checkRateLimit returns true when under limit', () => {
    const g = new SafetyGuardrails({ rateLimitPerMinute: 10 });
    for (let i = 0; i < 5; i++) g.recordApiCall();
    expect(g.checkRateLimit()).toBe(true);
  });

  // 10. checkRateLimit returns false when over limit
  it('checkRateLimit returns false when over limit', () => {
    const g = new SafetyGuardrails({ rateLimitPerMinute: 3 });
    for (let i = 0; i < 3; i++) g.recordApiCall();
    expect(g.checkRateLimit()).toBe(false);
  });

  // 11. checkStopFile returns false when no stop file
  it('checkStopFile returns true when no stop file exists', () => {
    const stopFile = path.join(tmpDir, 'no-stop-here');
    const g = new SafetyGuardrails({ stopFilePath: stopFile });
    expect(g.checkStopFile()).toBe(true);
  });

  // 12. checkStopFile returns false when stop file exists
  it('checkStopFile returns false when stop file exists', () => {
    const stopFile = path.join(tmpDir, '.stop');
    fs.writeFileSync(stopFile, '');
    const g = new SafetyGuardrails({ stopFilePath: stopFile });
    expect(g.checkStopFile()).toBe(false);
  });

  // 13. checkAll returns false if any check fails
  it('checkAll returns false if budget exceeded', () => {
    const g = new SafetyGuardrails({ maxBudgetUsd: 0.5, stopFilePath: path.join(tmpDir, 'nope') });
    g.recordApiCost(0.5);
    expect(g.checkAll(0.9)).toBe(false);
  });

  it('checkAll returns false if circuit breaker trips', () => {
    const g = new SafetyGuardrails({
      maxBudgetUsd: 100,
      circuitBreakerThreshold: 0.5,
      circuitBreakerConsecutive: 2,
      stopFilePath: path.join(tmpDir, 'nope'),
    });
    expect(g.checkCircuitBreaker(0.1)).toBe(true);
    expect(g.checkAll(0.1)).toBe(false); // 2nd consecutive low fitness
  });

  it('checkAll returns false if stop file exists', () => {
    const stopFile = path.join(tmpDir, '.stop-all');
    fs.writeFileSync(stopFile, '');
    const g = new SafetyGuardrails({ maxBudgetUsd: 100, stopFilePath: stopFile });
    expect(g.checkAll(0.9)).toBe(false);
  });

  it('checkAll returns true when all checks pass', () => {
    const stopFile = path.join(tmpDir, 'nope-all');
    const g = new SafetyGuardrails({ maxBudgetUsd: 100, stopFilePath: stopFile });
    expect(g.checkAll(0.9)).toBe(true);
  });

  // 14. reset clears all state
  it('reset clears all state', () => {
    const g = new SafetyGuardrails({ maxBudgetUsd: 1.0, stopFilePath: path.join(tmpDir, 'nope-reset') });
    g.recordApiCost(0.5);
    g.recordApiCall();
    g.recordApiCall();
    g.checkCircuitBreaker(0.0); // increment counter
    g.checkCircuitBreaker(0.0);

    g.reset();

    expect(g.getBudgetUsed()).toBe(0);
    expect(g.checkBudget()).toBe(true);
    // Circuit breaker counter should be reset — one low fitness won't trip default (5)
    expect(g.checkCircuitBreaker(0.0)).toBe(true);
  });

  // 15. getBudgetUsed returns accumulated cost
  it('getBudgetUsed returns accumulated cost', () => {
    const g = new SafetyGuardrails();
    expect(g.getBudgetUsed()).toBe(0);
    g.recordApiCost(0.42);
    expect(g.getBudgetUsed()).toBeCloseTo(0.42, 6);
    g.recordApiCost(0.08);
    expect(g.getBudgetUsed()).toBeCloseTo(0.50, 6);
  });
});
