/**
 * TaskRunner unit tests — validates prompt construction, attempt recording,
 * error propagation, and RalphLoop integration via mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import type { TaskManifest } from '../../../src/ledger/types.js';

// vi.hoisted() is mandatory for mock variables referenced in vi.mock() factories
const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn(),
}));

vi.mock('../../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: mockRun,
  },
}));

// Must import AFTER vi.mock setup
import { TaskRunner } from '../../../src/ledger/TaskRunner.js';

describe('TaskRunner', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;
  let ledger: TaskLedger;
  let runner: TaskRunner;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-runner-test-'));
    liminalFs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
    runner = new TaskRunner(ledger);
    mockRun.mockReset();
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeTask(overrides: Partial<TaskManifest> = {}): TaskManifest {
    return {
      id: 'L001',
      title: 'Add timeout parameter',
      description: 'Add a configurable timeout to the fetch function',
      taskClass: 'leaf',
      status: 'pending',
      files: { allowlist: ['src/api/fetch.ts'], denylist: ['src/core/*'] },
      verifyCommand: 'pnpm test src/api/fetch.test.ts',
      scoringCriteria: ['technical', 'errorHandling'],
      lane: 1,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: '2026-04-15T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
      ...overrides,
    };
  }

  function mockLoopResult(overrides = {}) {
    return {
      code: 'export async function fetch(url, opts) { /* ... */ }',
      iterations: 2,
      completed: true,
      reason: 'Quality threshold met',
      timestamp: '2026-04-15T10:05:00Z',
      duration: 5000,
      finalScore: 0.85,
      ...overrides,
    };
  }

  it('runTask — constructs prompt with task title, file boundaries, and verify command', async () => {
    const task = makeTask();
    mockRun.mockResolvedValue(mockLoopResult());

    await runner.runTask(task);

    const callArgs = mockRun.mock.calls[0];
    const prompt = callArgs[0] as string;

    expect(prompt).toContain('Task: Add timeout parameter');
    expect(prompt).toContain('ALLOWED files: src/api/fetch.ts');
    expect(prompt).toContain('FORBIDDEN files: src/core/*');
    expect(prompt).toContain('pnpm test src/api/fetch.test.ts');
    expect(prompt).toContain('Add a configurable timeout to the fetch function');
  });

  it('runTask — records attempt via ledger with correct fields', async () => {
    const task = makeTask();
    mockRun.mockResolvedValue(mockLoopResult());

    const attempt = await runner.runTask(task);

    // Verify returned attempt has correct shape
    expect(attempt.taskId).toBe('L001');
    expect(attempt.iterations).toBe(2);
    expect(attempt.completed).toBe(true);
    expect(attempt.reason).toBe('Quality threshold met');
    expect(attempt.runId).toBe('2026-04-15T10:05:00Z');
    expect(attempt.artifactRef).toBeNull();
    expect(attempt.duration).toBeGreaterThanOrEqual(0);

    // Verify attempt was persisted in ledger
    const attempts = ledger.loadAttempts('L001');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].taskId).toBe('L001');
    expect(attempts[0].iterations).toBe(2);
  });

  it('runTask — returns attempt with RalphLoop score', async () => {
    const task = makeTask();
    mockRun.mockResolvedValue(mockLoopResult({ finalScore: 0.92 }));

    const attempt = await runner.runTask(task);

    expect(attempt.finalScore).toBe(0.92);
  });

  it('runTask — propagates RalphLoop errors', async () => {
    const task = makeTask();
    mockRun.mockRejectedValue(new Error('LLM provider timeout'));

    await expect(runner.runTask(task)).rejects.toThrow('LLM provider timeout');

    // Verify no attempt was recorded
    const attempts = ledger.loadAttempts('L001');
    expect(attempts).toHaveLength(0);
  });
});
