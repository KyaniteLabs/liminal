/**
 * TaskVerifier unit tests — validates semantic scoring, test pass/fail
 * detection, and candidate recording via mocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import type { TaskManifest, TaskAttempt } from '../../../src/ledger/types.js';

// vi.hoisted() is mandatory for mock variables referenced in vi.mock() factories
const { mockScore } = vi.hoisted(() => ({
  mockScore: vi.fn(),
}));

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

vi.mock('../../../src/core/ScoringEngine.js', () => ({
  ScoringEngine: class {
    score = mockScore;
  },
}));

vi.mock('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

// Must import AFTER vi.mock setup
import { TaskVerifier } from '../../../src/ledger/TaskVerifier.js';

describe('TaskVerifier', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;
  let ledger: TaskLedger;
  let verifier: TaskVerifier;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-verifier-test-'));
    liminalFs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
    verifier = new TaskVerifier(ledger);
    mockScore.mockReset();
    mockExecFileSync.mockReset();
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

  function makeAttempt(overrides: Partial<TaskAttempt> = {}): TaskAttempt {
    return {
      id: 'att-001',
      taskId: 'L001',
      prompt: 'Task: Add timeout parameter\n\nAdd a configurable timeout',
      runId: '2026-04-15T10:05:00Z',
      startedAt: '2026-04-15T10:00:00Z',
      completedAt: '2026-04-15T10:05:00Z',
      duration: 300000,
      iterations: 2,
      completed: true,
      reason: 'Quality threshold met',
      finalScore: 0.85,
      artifactRef: null,
      ...overrides,
    };
  }

  it('verify — returns candidate with semantic score from ScoringEngine', async () => {
    const task = makeTask();
    const attempt = makeAttempt();
    const code = 'export async function fetch(url, opts = {}) { return fetch(url, opts); }';

    mockScore.mockResolvedValue({
      score: 0.88,
      dimensions: { technical: 0.9, errorHandling: 0.85 },
      strategy: 'comprehensive',
    });
    mockExecFileSync.mockReturnValue('All tests passed');

    const candidate = await verifier.verify(task, attempt, code);

    expect(candidate.semanticScore).toBe(0.88);
    expect(candidate.taskId).toBe('L001');
    expect(candidate.attemptId).toBe('att-001');
    expect(candidate.code).toBe(code);
    expect(candidate.testPassed).toBe(true);
  });

  it('verify — records candidate via ledger', async () => {
    const task = makeTask();
    const attempt = makeAttempt();
    const code = 'const x = 42;';

    mockScore.mockResolvedValue({ score: 0.75, dimensions: {}, strategy: 'fast' });
    mockExecFileSync.mockReturnValue('');

    await verifier.verify(task, attempt, code);

    const candidates = ledger.loadCandidates('L001');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].semanticScore).toBe(0.75);
    expect(candidates[0].attemptId).toBe('att-001');
  });

  it('verify — detects test pass when execSync succeeds', async () => {
    const task = makeTask();
    const attempt = makeAttempt();
    const code = 'export const x = 1;';

    mockScore.mockResolvedValue({ score: 0.9, dimensions: {}, strategy: 'fast' });
    mockExecFileSync.mockReturnValue('3 tests passed');

    const candidate = await verifier.verify(task, attempt, code);

    expect(candidate.testPassed).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'pnpm',
      ['test', 'src/api/fetch.test.ts'],
      expect.objectContaining({ timeout: 120000, encoding: 'utf-8', stdio: 'pipe' }),
    );
  });

  it('verify — detects test failure when execSync throws', async () => {
    const task = makeTask();
    const attempt = makeAttempt();
    const code = 'export const broken = undefined;';

    mockScore.mockResolvedValue({ score: 0.4, dimensions: {}, strategy: 'fast' });
    mockExecFileSync.mockImplementation(() => {
      const err = new Error('Test suite failed: 2 failures');
      throw err;
    });

    const candidate = await verifier.verify(task, attempt, code);

    expect(candidate.testPassed).toBe(false);
    expect(candidate.semanticScore).toBe(0.4);
  });

  it('verify — rejects disallowed verifyCommand (command injection guard)', async () => {
    const task = makeTask({ verifyCommand: 'rm -rf /' });
    const attempt = makeAttempt();
    const code = 'const malicious = true;';

    mockScore.mockResolvedValue({ score: 0.9, dimensions: {}, strategy: 'fast' });

    await expect(verifier.verify(task, attempt, code)).rejects.toThrow('Blocked: verifyCommand');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('verify — rejects shell chaining via metacharacters', async () => {
    const task = makeTask({ verifyCommand: 'pnpm test && rm -rf /' });
    const attempt = makeAttempt();
    const code = 'const chained = true;';

    mockScore.mockResolvedValue({ score: 0.9, dimensions: {}, strategy: 'fast' });

    await expect(verifier.verify(task, attempt, code)).rejects.toThrow('shell metacharacters');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});
