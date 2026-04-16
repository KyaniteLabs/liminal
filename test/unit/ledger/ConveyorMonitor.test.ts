/**
 * Unit tests for ConveyorMonitor — Phase 10 Lane 10-5
 *
 * Tests dashboard generation, alert detection, and text formatting.
 * Uses real LiminalFS (tmpdir) — no mocks on the ledger.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { ConveyorMonitor } from '../../../src/ledger/ConveyorMonitor.js';
import type { ConveyorBatchResult } from '../../../src/ledger/types.js';

function makeBatchResult(overrides: Partial<ConveyorBatchResult> = {}): ConveyorBatchResult {
  return {
    batchId: 'batch-test',
    startedAt: new Date(Date.now() - 5000).toISOString(),
    completedAt: new Date().toISOString(),
    tasksAttempted: 5,
    tasksAccepted: 3,
    tasksFailed: 1,
    tasksEscalated: 1,
    acceptanceRate: 0.6,
    coverageBefore: { statements: 65, branches: 55, functions: 68, lines: 67 },
    coverageAfter: { statements: 67, branches: 57, functions: 70, lines: 69 },
    failureBreakdown: {
      'generator-weakness': 1,
      'verifier-opacity': 0,
      'harness-issue': 0,
      'task-spec-issue': 0,
      'provider-issue': 0,
    },
    results: [
      { taskId: 'L001', status: 'accepted', attempts: 1, finalScore: 0.8, testPassed: true, durationMs: 1200 },
      { taskId: 'L002', status: 'accepted', attempts: 1, finalScore: 0.75, testPassed: true, durationMs: 900 },
      { taskId: 'W001', status: 'accepted', attempts: 2, finalScore: 0.65, testPassed: true, durationMs: 2100 },
      { taskId: 'W002', status: 'failed', attempts: 3, finalScore: 0.15, testPassed: false, durationMs: 3000, failureClass: 'generator-weakness' },
      { taskId: 'H001', status: 'escalated', attempts: 2, finalScore: 0.45, testPassed: false, durationMs: 1800 },
    ],
    ...overrides,
  };
}

describe('ConveyorMonitor', () => {
  let tempDir: string;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'conveyor-monitor-test-'));
    const fs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(fs);

    // Create tasks that match the batch result
    ledger.createTask({
      id: 'L001', title: 'Leaf 1', description: 'L1',
      taskClass: 'leaf',
      files: { allowlist: ['test/unit/a.test.ts'], denylist: [] },
      verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
    });
    ledger.createTask({
      id: 'L002', title: 'Leaf 2', description: 'L2',
      taskClass: 'leaf',
      files: { allowlist: ['test/unit/b.test.ts'], denylist: [] },
      verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
    });
    ledger.createTask({
      id: 'W001', title: 'Wiring 1', description: 'W1',
      taskClass: 'wiring',
      files: { allowlist: ['test/unit/c.test.ts'], denylist: [] },
      verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 2, maxAttempts: 3,
    });
    ledger.createTask({
      id: 'W002', title: 'Wiring 2', description: 'W2',
      taskClass: 'wiring',
      files: { allowlist: ['test/unit/d.test.ts'], denylist: [] },
      verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 2, maxAttempts: 3,
    });
    ledger.createTask({
      id: 'H001', title: 'Harness 1', description: 'H1',
      taskClass: 'harness-quality',
      files: { allowlist: ['test/unit/e.test.ts'], denylist: [] },
      verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 3, maxAttempts: 3,
    });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateDashboard', () => {
    it('generates dashboard with correct summary', () => {
      const monitor = new ConveyorMonitor(ledger);
      const result = makeBatchResult();
      const dashboard = monitor.generateDashboard(result);

      expect(dashboard.summary.attempted).toBe(5);
      expect(dashboard.summary.accepted).toBe(3);
      expect(dashboard.summary.failed).toBe(1);
      expect(dashboard.summary.escalated).toBe(1);
      expect(dashboard.summary.acceptanceRate).toBe(0.6);
    });

    it('computes coverage delta correctly', () => {
      const monitor = new ConveyorMonitor(ledger);
      const result = makeBatchResult();
      const dashboard = monitor.generateDashboard(result);

      expect(dashboard.coverageDelta.statements).toBe(2);
      expect(dashboard.coverageDelta.branches).toBe(2);
      expect(dashboard.coverageDelta.functions).toBe(2);
      expect(dashboard.coverageDelta.lines).toBe(2);
    });

    it('detects coverage regression as critical alert', () => {
      const monitor = new ConveyorMonitor(ledger);
      const result = makeBatchResult({
        coverageBefore: { statements: 70, branches: 60, functions: 72, lines: 71 },
        coverageAfter: { statements: 68, branches: 58, functions: 70, lines: 69 },
      });
      const dashboard = monitor.generateDashboard(result);

      const regressionAlerts = dashboard.alerts.filter(a =>
        a.severity === 'critical' && a.message.includes('Coverage regression')
      );
      expect(regressionAlerts.length).toBeGreaterThan(0);
    });

    it('detects low acceptance rate as warning', () => {
      const monitor = new ConveyorMonitor(ledger);
      const result = makeBatchResult({
        tasksAttempted: 5,
        tasksAccepted: 1,
        acceptanceRate: 0.2,
      });
      const dashboard = monitor.generateDashboard(result);

      const rateAlerts = dashboard.alerts.filter(a =>
        a.severity === 'warning' && a.message.includes('Low acceptance rate')
      );
      expect(rateAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('formatText', () => {
    it('produces a readable text report', () => {
      const monitor = new ConveyorMonitor(ledger);
      const result = makeBatchResult();
      const dashboard = monitor.generateDashboard(result);
      const text = monitor.formatText(dashboard);

      expect(text).toContain('Conveyor Dashboard');
      expect(text).toContain('Attempted:  5');
      expect(text).toContain('Accepted:   3');
      expect(text).toContain('Coverage Delta:');
      expect(text).toContain('+2.0pp');
    });
  });
});
