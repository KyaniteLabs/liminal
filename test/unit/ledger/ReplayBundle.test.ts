/**
 * Unit tests for ReplayBundle — Phase 10 Lane 10-4
 *
 * Tests evidence packaging, file export, and retry recommendations.
 * Uses real SinterFS (tmpdir) — no mocks on the ledger.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import { SinterFS } from '../../../src/fs/SinterFS.js';
import { ReplayBundle } from '../../../src/ledger/ReplayBundle.js';

describe('ReplayBundle', () => {
  let tempDir: string;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'replay-bundle-test-'));
    const fs = SinterFS.open(tempDir);
    ledger = new TaskLedger(fs);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('export', () => {
    it('exports a complete bundle for a completed task', () => {
      ledger.createTask({
        id: 'L001', title: 'Test task', description: 'A test',
        taskClass: 'leaf',
        files: { allowlist: ['test/unit/foo.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run test/unit/foo.test.ts',
        scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });

      const bundle = new ReplayBundle(ledger);
      const data = bundle.export('L001');

      expect(data.taskId).toBe('L001');
      expect(data.manifest.id).toBe('L001');
      expect(data.manifest.title).toBe('Test task');
      expect(data.manifest.taskClass).toBe('leaf');
      expect(data.attempts).toHaveLength(0);
      expect(data.candidates).toHaveLength(0);
      expect(data.decision).toBeNull();
    });

    it('throws for non-existent task', () => {
      const bundle = new ReplayBundle(ledger);
      expect(() => bundle.export('NONEXISTENT')).toThrow('Task not found: NONEXISTENT');
    });
  });

  describe('exportToFile', () => {
    it('writes bundle to a JSON file', () => {
      ledger.createTask({
        id: 'L001', title: 'Test', description: 'Test',
        taskClass: 'leaf',
        files: { allowlist: ['test/unit/foo.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });

      const outputDir = join(tempDir, 'replays');
      const bundle = new ReplayBundle(ledger);
      const filePath = bundle.exportToFile('L001', outputDir);

      expect(existsSync(filePath)).toBe(true);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content.taskId).toBe('L001');
    });
  });

  describe('recommendRetry', () => {
    it('recommends fallback-provider for timeout errors', () => {
      ledger.createTask({
        id: 'L001', title: 'Test', description: 'Test',
        taskClass: 'leaf',
        files: { allowlist: ['test/unit/foo.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      // Simulate a failed task with a timeout
      ledger.updateTaskStatus('L001', 'failed');

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('L001');

      expect(rec.taskId).toBe('L001');
      expect(rec.action).not.toBeNull();
      expect(rec.rationale.length).toBeGreaterThan(0);
      expect(rec.suggestedChanges.length).toBeGreaterThan(0);
    });

    it('recommends respec for task-spec issues', () => {
      ledger.createTask({
        id: 'W001', title: 'Wiring test', description: 'Wiring',
        taskClass: 'wiring',
        files: { allowlist: ['test/unit/bar.test.ts'], denylist: [] },
        verifyCommand: 'pnpm vitest run', scoringCriteria: ['x'], lane: 2, maxAttempts: 3,
      });
      ledger.updateTaskStatus('W001', 'failed');

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('W001');

      expect(rec.taskId).toBe('W001');
      expect(rec.failureClass).not.toBeNull();
    });
  });

  describe('inferFailureClass branches', () => {
    it('returns harness-issue when no attempts exist', () => {
      ledger.createTask({
        id: 'F001', title: 'Empty', description: 'No attempts',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F001');

      expect(rec.failureClass).toBe('harness-issue');
      expect(rec.action).toBe('fix-harness');
    });

    it('returns provider-issue for timeout reason', () => {
      ledger.createTask({
        id: 'F002', title: 'Timeout', description: 'Provider timeout',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      ledger.recordAttempt({
        id: 'A1', taskId: 'F002', startedAt: new Date().toISOString(),
        finalScore: 0.1, reason: 'Generation timeout after 120s', status: 'failed',
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F002');

      expect(rec.failureClass).toBe('provider-issue');
      expect(rec.action).toBe('fallback-provider');
    });

    it('returns provider-issue for rate limit (429)', () => {
      ledger.createTask({
        id: 'F003', title: 'Rate', description: 'Rate limited',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      ledger.recordAttempt({
        id: 'A1', taskId: 'F003', startedAt: new Date().toISOString(),
        finalScore: 0, reason: 'HTTP 429 rate limit exceeded', status: 'failed',
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F003');

      expect(rec.failureClass).toBe('provider-issue');
    });

    it('returns harness-issue for harness error reason', () => {
      ledger.createTask({
        id: 'F004', title: 'Harness', description: 'Harness failure',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      ledger.recordAttempt({
        id: 'A1', taskId: 'F004', startedAt: new Date().toISOString(),
        finalScore: 0.5, reason: 'harness crashed during verification', status: 'failed',
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F004');

      expect(rec.failureClass).toBe('harness-issue');
    });

    it('returns generator-weakness for low score after multiple attempts', () => {
      ledger.createTask({
        id: 'F005', title: 'Weak', description: 'Weak output',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      ledger.recordAttempt({
        id: 'A1', taskId: 'F005', startedAt: new Date().toISOString(),
        finalScore: 0.2, reason: 'low score', status: 'failed',
      });
      ledger.recordAttempt({
        id: 'A2', taskId: 'F005', startedAt: new Date().toISOString(),
        finalScore: 0.15, reason: 'still weak', status: 'failed',
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F005');

      expect(rec.failureClass).toBe('generator-weakness');
      expect(rec.action).toBe('retry-different-temp');
    });

    it('returns verifier-opacity as default fallback', () => {
      ledger.createTask({
        id: 'F006', title: 'Opaque', description: 'Can not distinguish',
        taskClass: 'leaf',
        files: { allowlist: [], denylist: [] },
        verifyCommand: 'echo ok', scoringCriteria: ['x'], lane: 1, maxAttempts: 3,
      });
      ledger.recordAttempt({
        id: 'A1', taskId: 'F006', startedAt: new Date().toISOString(),
        finalScore: 0.6, reason: 'unclear scoring', status: 'failed',
      });

      const bundle = new ReplayBundle(ledger);
      const rec = bundle.recommendRetry('F006');

      expect(rec.failureClass).toBe('verifier-opacity');
      expect(rec.action).toBe('respec');
    });
  });
});
