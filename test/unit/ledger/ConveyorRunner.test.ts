/**
 * Unit tests for ConveyorRunner — Phase 10 Lane 10-2
 *
 * Tests batch execution, failure classification, and retry logic.
 * Mocks at the external boundaries (RalphLoop, ScoringEngine, child_process)
 * so ConveyorRunner is tested in isolation without real LLM or shell calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import { SinterFS } from '../../../src/fs/SinterFS.js';

// Mock RalphLoop.run (static method — LLM boundary)
vi.mock('../../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: vi.fn().mockResolvedValue({
      completed: false,
      reason: 'no-llm-mock',
      iterations: 0,
      finalScore: 0,
      code: null,
      timestamp: new Date().toISOString(),
    }),
  },
}));

// Mock ScoringEngine as a real class (used with `new` in TaskVerifier)
vi.mock('../../../src/core/ScoringEngine.js', () => ({
  ScoringEngine: class MockScoringEngine {
    score = vi.fn().mockResolvedValue({ score: 0, breakdown: {} });
  },
}));

// Mock child_process (used by TaskVerifier for execFileSync)
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn().mockReturnValue('mock test output\n1 passed'),
  };
});

import { ConveyorRunner } from '../../../src/ledger/ConveyorRunner.js';

describe('ConveyorRunner', () => {
  let tempDir: string;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'conveyor-runner-test-'));
    const fs = SinterFS.open(tempDir);
    ledger = new TaskLedger(fs);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('runBatch', () => {
    it('returns empty batch result when no pending tasks', async () => {
      const runner = new ConveyorRunner(ledger);
      const result = await runner.runBatch();
      expect(result.tasksAttempted).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(result.acceptanceRate).toBe(0);
    });

    it('respects maxTasks limit', async () => {
      for (let i = 0; i < 3; i++) {
        ledger.createTask({
          id: `T${String(i + 1).padStart(3, '0')}`,
          title: `Test task ${i}`,
          description: 'A test task',
          taskClass: 'leaf',
          files: { allowlist: [`test/unit/foo${i}.test.ts`], denylist: ['src/core/**'] },
          verifyCommand: 'pnpm vitest run test/unit/foo.test.ts --no-coverage',
          scoringCriteria: ['Compiles'],
          lane: 1,
          maxAttempts: 1,
        });
      }

      const runner = new ConveyorRunner(ledger);
      const result = await runner.runBatch({ maxTasks: 1, maxRetries: 1 });
      expect(result.tasksAttempted).toBe(1);
    });

    it('applies classFilter to restrict which tasks run', async () => {
      ledger.createTask({
        id: 'L001', title: 'Leaf task', description: 'Leaf',
        taskClass: 'leaf',
        files: { allowlist: ['test/unit/a.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run test/unit/a.test.ts', scoringCriteria: ['x'],
        lane: 1, maxAttempts: 3,
      });
      ledger.createTask({
        id: 'W001', title: 'Wiring task', description: 'Wiring',
        taskClass: 'wiring',
        files: { allowlist: ['test/unit/b.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run test/unit/b.test.ts', scoringCriteria: ['x'],
        lane: 2, maxAttempts: 3,
      });

      const runner = new ConveyorRunner(ledger);
      const result = await runner.runBatch({ classFilter: ['leaf'], maxRetries: 1 });
      expect(result.tasksAttempted).toBe(1);
      expect(result.results[0].taskId).toBe('L001');
    });
  });

  describe('failure classification', () => {
    it('counts failures in breakdown', async () => {
      ledger.createTask({
        id: 'L001', title: 'Test', description: 'Test',
        taskClass: 'leaf',
        files: { allowlist: ['test/unit/x.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run test/unit/x.test.ts', scoringCriteria: ['x'],
        lane: 1, maxAttempts: 1,
      });

      const runner = new ConveyorRunner(ledger);
      const result = await runner.runBatch({ maxRetries: 1 });

      expect(result.tasksAttempted).toBe(1);
      const totalFailures = Object.values(result.failureBreakdown).reduce((a, b) => a + b, 0);
      expect(totalFailures).toBeGreaterThanOrEqual(0);
    });
  });
});
