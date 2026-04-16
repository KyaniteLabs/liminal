/**
 * TaskRunner prompt construction tests — verifies that runTask()
 * builds a well-structured prompt from the task manifest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import type { TaskManifest } from '../../../src/ledger/types.js';

const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn(),
}));

vi.mock('../../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: mockRun,
  },
}));

import { TaskRunner } from '../../../src/ledger/TaskRunner.js';

describe('TaskRunner prompt construction', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;
  let ledger: TaskLedger;
  let runner: TaskRunner;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-prompt-test-'));
    liminalFs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
    runner = new TaskRunner(ledger);
    mockRun.mockReset();
    mockRun.mockResolvedValue({
      code: 'export function retry() {}',
      iterations: 1,
      completed: true,
      reason: 'Quality threshold met',
      timestamp: '2026-04-15T12:00:00Z',
      duration: 1000,
      finalScore: 0.9,
    });
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeTask(overrides: Partial<TaskManifest> = {}): TaskManifest {
    return {
      id: 'L002',
      title: 'Implement retry logic',
      description: 'Add exponential backoff retry to the fetch function',
      taskClass: 'leaf',
      status: 'pending',
      files: { allowlist: ['src/api/fetch.ts', 'src/api/retry.ts'], denylist: ['src/core/*', 'src/fs/*'] },
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

  it('prompt contains the task title', async () => {
    await runner.runTask(makeTask());
    const prompt = mockRun.mock.calls[0][0] as string;
    expect(prompt).toContain('Task: Implement retry logic');
  });

  it('prompt contains the task description', async () => {
    await runner.runTask(makeTask());
    const prompt = mockRun.mock.calls[0][0] as string;
    expect(prompt).toContain('Add exponential backoff retry to the fetch function');
  });

  it('prompt contains ALLOWED files section', async () => {
    await runner.runTask(makeTask());
    const prompt = mockRun.mock.calls[0][0] as string;
    expect(prompt).toContain('ALLOWED files: src/api/fetch.ts, src/api/retry.ts');
  });

  it('prompt contains FORBIDDEN files section', async () => {
    await runner.runTask(makeTask());
    const prompt = mockRun.mock.calls[0][0] as string;
    expect(prompt).toContain('FORBIDDEN files: src/core/*, src/fs/*');
  });

  it('prompt contains the verify command', async () => {
    await runner.runTask(makeTask());
    const prompt = mockRun.mock.calls[0][0] as string;
    expect(prompt).toContain('After making changes, verify with: pnpm test src/api/fetch.test.ts');
  });

  it('prompt is passed as first argument to RalphLoop.run()', async () => {
    await runner.runTask(makeTask());
    const callArgs = mockRun.mock.calls[0];
    expect(typeof callArgs[0]).toBe('string');
    expect(callArgs[0]).toContain('## File Boundaries');
    expect(callArgs[0]).toContain('## Verification');
  });

  it('runTask passes scoringCriteria as evaluationCriteria', async () => {
    await runner.runTask(makeTask());
    const options = mockRun.mock.calls[0][1] as Record<string, unknown>;
    expect(options.evaluationCriteria).toEqual(['technical', 'errorHandling']);
  });
});
