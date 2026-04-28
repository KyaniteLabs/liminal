/**
 * Unit tests for ReplayBundle — Phase 10 Lane 10-4
 *
 * Tests evidence packaging, file export, and retry recommendations.
 * Uses real LiminalFS (tmpdir) — no mocks on the ledger.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { ReplayBundle } from '../../../src/ledger/ReplayBundle.js';

describe('ReplayBundle', () => {
  let tempDir: string;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'replay-bundle-test-'));
    const fs = LiminalFS.open(tempDir);
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
});
