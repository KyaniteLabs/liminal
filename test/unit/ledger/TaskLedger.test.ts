/**
 * TaskLedger unit tests — validates manifest CRUD, attempt recording,
 * candidate recording, and decision lifecycle against a real LiminalFS
 * instance in a temp directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { TaskLedger } from '../../../src/ledger/TaskLedger.js';
import type { TaskManifest, TaskAttempt, TaskCandidate, TaskDecision } from '../../../src/ledger/types.js';

describe('TaskLedger', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-ledger-test-'));
    liminalFs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Helper: minimal task definition ────────────────────────────

  function makeTaskDef(overrides: Partial<TaskManifest> = {}) {
    return {
      id: 'L001',
      title: 'Test task',
      description: 'A test task for unit testing',
      taskClass: 'leaf' as const,
      files: { allowlist: ['src/fs/types.ts'], denylist: ['src/core/*'] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical', 'codeStructure'],
      lane: 1,
      maxAttempts: 3,
      ...overrides,
    };
  }

  // ─── createTask ─────────────────────────────────────────────────

  it('createTask — writes manifest and returns task with auto-filled fields', () => {
    const task = ledger.createTask(makeTaskDef());

    expect(task.id).toBe('L001');
    expect(task.status).toBe('pending');
    expect(task.attemptCount).toBe(0);
    expect(task.title).toBe('Test task');
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });

  it('createTask — persists manifest to .liminal/manifests/task/<id>/manifest.json', () => {
    ledger.createTask(makeTaskDef());

    const manifestPath = join(tempDir, '.liminal', 'manifests', 'task', 'L001', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const stored = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(stored.id).toBe('L001');
    expect(stored.status).toBe('pending');
  });

  // ─── loadTask ───────────────────────────────────────────────────

  it('loadTask — reads back a created task', () => {
    ledger.createTask(makeTaskDef());

    const task = ledger.loadTask('L001');
    expect(task).not.toBeNull();
    expect(task!.id).toBe('L001');
    expect(task!.title).toBe('Test task');
    expect(task!.taskClass).toBe('leaf');
  });

  it('loadTask — returns null for non-existent task', () => {
    const task = ledger.loadTask('NONEXISTENT');
    expect(task).toBeNull();
  });

  // ─── listTasks ──────────────────────────────────────────────────

  it('listTasks — returns all created tasks', () => {
    ledger.createTask(makeTaskDef({ id: 'L001', lane: 1 }));
    ledger.createTask(makeTaskDef({ id: 'W001', lane: 2 }));

    const tasks = ledger.listTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.id).sort()).toEqual(['L001', 'W001']);
  });

  it('listTasks — filters by lane', () => {
    ledger.createTask(makeTaskDef({ id: 'L001', lane: 1 }));
    ledger.createTask(makeTaskDef({ id: 'W001', lane: 2 }));

    const lane1 = ledger.listTasks({ lane: 1 });
    expect(lane1).toHaveLength(1);
    expect(lane1[0].id).toBe('L001');
  });

  it('listTasks — filters by status', () => {
    ledger.createTask(makeTaskDef({ id: 'L001' }));
    ledger.createTask(makeTaskDef({ id: 'W001' }));
    ledger.updateTaskStatus('W001', 'completed');

    const pending = ledger.listTasks({ status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('L001');
  });

  it('listTasks — returns empty array when no tasks exist', () => {
    const tasks = ledger.listTasks();
    expect(tasks).toEqual([]);
  });

  // ─── updateTaskStatus ───────────────────────────────────────────

  it('updateTaskStatus — changes status and persists', () => {
    ledger.createTask(makeTaskDef());
    ledger.updateTaskStatus('L001', 'in-progress');

    const task = ledger.loadTask('L001');
    expect(task!.status).toBe('in-progress');
  });

  it('updateTaskStatus — throws for non-existent task', () => {
    expect(() => ledger.updateTaskStatus('NONEXISTENT', 'completed')).toThrow('Task not found');
  });

  // ─── recordAttempt ──────────────────────────────────────────────

  it('recordAttempt — stores manifest and ref', () => {
    ledger.createTask(makeTaskDef());

    const attempt: TaskAttempt = {
      id: 'att-001',
      taskId: 'L001',
      prompt: 'Fix the type definition',
      runId: 'run-2026-04-15-001',
      startedAt: '2026-04-15T10:00:00Z',
      completedAt: '2026-04-15T10:05:00Z',
      duration: 300000,
      iterations: 3,
      completed: true,
      reason: 'Quality threshold met',
      finalScore: 0.85,
      artifactRef: null,
    };

    ledger.recordAttempt(attempt);

    // Verify manifest exists
    const manifestPath = join(tempDir, '.liminal', 'manifests', 'task', 'L001', 'attempt', 'att-001.json');
    expect(existsSync(manifestPath)).toBe(true);

    // Verify ref exists
    const refPath = join(tempDir, '.liminal', 'refs', 'task', 'L001', 'attempt', 'att-001.json');
    expect(existsSync(refPath)).toBe(true);

    const stored = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(stored.finalScore).toBe(0.85);
    expect(stored.iterations).toBe(3);
  });

  it('recordAttempt — increments attemptCount on task', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordAttempt({
      id: 'att-001', taskId: 'L001', prompt: 'test', runId: 'r1',
      startedAt: '', completedAt: '', duration: 0, iterations: 1,
      completed: true, reason: 'done', finalScore: 0.8, artifactRef: null,
    });

    const task = ledger.loadTask('L001');
    expect(task!.attemptCount).toBe(1);
  });

  it('recordAttempt — transitions pending task to in-progress', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordAttempt({
      id: 'att-001', taskId: 'L001', prompt: 'test', runId: 'r1',
      startedAt: '', completedAt: '', duration: 0, iterations: 1,
      completed: true, reason: 'done', finalScore: 0.8, artifactRef: null,
    });

    const task = ledger.loadTask('L001');
    expect(task!.status).toBe('in-progress');
  });

  // ─── loadAttempts ───────────────────────────────────────────────

  it('loadAttempts — returns all attempts sorted by ID', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordAttempt({
      id: 'att-002', taskId: 'L001', prompt: 'second', runId: 'r2',
      startedAt: '', completedAt: '', duration: 0, iterations: 2,
      completed: true, reason: 'done', finalScore: 0.9, artifactRef: null,
    });
    ledger.recordAttempt({
      id: 'att-001', taskId: 'L001', prompt: 'first', runId: 'r1',
      startedAt: '', completedAt: '', duration: 0, iterations: 1,
      completed: true, reason: 'done', finalScore: 0.8, artifactRef: null,
    });

    const attempts = ledger.loadAttempts('L001');
    expect(attempts).toHaveLength(2);
    expect(attempts[0].id).toBe('att-001');
    expect(attempts[1].id).toBe('att-002');
  });

  it('loadAttempts — returns empty array when no attempts', () => {
    ledger.createTask(makeTaskDef());
    expect(ledger.loadAttempts('L001')).toEqual([]);
  });

  // ─── recordCandidate ────────────────────────────────────────────

  it('recordCandidate — stores artifact, manifest, and ref', () => {
    ledger.createTask(makeTaskDef());

    const candidate: TaskCandidate = {
      id: 'cand-001',
      taskId: 'L001',
      attemptId: 'att-001',
      code: 'export const x = 42;',
      semanticScore: 0.88,
      testPassed: true,
      evaluatedAt: '2026-04-15T10:06:00Z',
    };

    ledger.recordCandidate(candidate);

    // Verify manifest exists (metadata)
    const manifestPath = join(tempDir, '.liminal', 'manifests', 'task', 'L001', 'candidate', 'cand-001.json');
    expect(existsSync(manifestPath)).toBe(true);

    // Verify ref exists (pointer to artifact)
    const refPath = join(tempDir, '.liminal', 'refs', 'task', 'L001', 'candidate', 'cand-001.json');
    expect(existsSync(refPath)).toBe(true);

    const stored = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(stored.semanticScore).toBe(0.88);
    expect(stored.testPassed).toBe(true);
  });

  // ─── loadCandidates ─────────────────────────────────────────────

  it('loadCandidates — returns all candidates for a task', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordCandidate({
      id: 'cand-001', taskId: 'L001', attemptId: 'att-001',
      code: 'const a = 1;', semanticScore: 0.7, testPassed: false,
      evaluatedAt: '2026-04-15T10:06:00Z',
    });
    ledger.recordCandidate({
      id: 'cand-002', taskId: 'L001', attemptId: 'att-001',
      code: 'const b = 2;', semanticScore: 0.9, testPassed: true,
      evaluatedAt: '2026-04-15T10:07:00Z',
    });

    const candidates = ledger.loadCandidates('L001');
    expect(candidates).toHaveLength(2);
    expect(candidates[0].id).toBe('cand-001');
    expect(candidates[1].id).toBe('cand-002');
    expect(candidates[1].semanticScore).toBe(0.9);
  });

  it('loadCandidates — returns empty array when no candidates', () => {
    ledger.createTask(makeTaskDef());
    expect(ledger.loadCandidates('L001')).toEqual([]);
  });

  // ─── recordDecision ─────────────────────────────────────────────

  it('recordDecision — stores decision manifest', () => {
    ledger.createTask(makeTaskDef());

    const decision: TaskDecision = {
      id: 'dec-001',
      taskId: 'L001',
      candidateId: 'cand-001',
      decision: 'accepted',
      rationale: 'Score 0.9 meets threshold, tests pass',
      score: 0.9,
      decidedAt: '2026-04-15T10:08:00Z',
    };

    ledger.recordDecision(decision);

    const manifestPath = join(tempDir, '.liminal', 'manifests', 'task', 'L001', 'decision', 'dec-001.json');
    expect(existsSync(manifestPath)).toBe(true);

    const stored = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(stored.decision).toBe('accepted');
    expect(stored.rationale).toBe('Score 0.9 meets threshold, tests pass');
  });

  it('recordDecision — accepted decision marks task completed', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordDecision({
      id: 'dec-001', taskId: 'L001', candidateId: 'cand-001',
      decision: 'accepted', rationale: 'Good', score: 0.9,
      decidedAt: '2026-04-15T10:08:00Z',
    });

    const task = ledger.loadTask('L001');
    expect(task!.status).toBe('completed');
  });

  it('recordDecision — rejected decision does NOT change task status to completed', () => {
    ledger.createTask(makeTaskDef());
    ledger.updateTaskStatus('L001', 'in-progress');

    ledger.recordDecision({
      id: 'dec-001', taskId: 'L001', candidateId: 'cand-001',
      decision: 'rejected', rationale: 'Tests failed', score: 0.3,
      decidedAt: '2026-04-15T10:08:00Z',
    });

    const task = ledger.loadTask('L001');
    expect(task!.status).toBe('in-progress');
  });

  // ─── loadLatestDecision ─────────────────────────────────────────

  it('loadLatestDecision — returns the most recent decision', () => {
    ledger.createTask(makeTaskDef());

    ledger.recordDecision({
      id: 'dec-001', taskId: 'L001', candidateId: 'cand-001',
      decision: 'rejected', rationale: 'Low score', score: 0.3,
      decidedAt: '2026-04-15T10:08:00Z',
    });
    ledger.recordDecision({
      id: 'dec-002', taskId: 'L001', candidateId: 'cand-002',
      decision: 'accepted', rationale: 'Good score', score: 0.9,
      decidedAt: '2026-04-15T10:10:00Z',
    });

    const latest = ledger.loadLatestDecision('L001');
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('dec-002');
    expect(latest!.decision).toBe('accepted');
  });

  it('loadLatestDecision — returns null when no decisions exist', () => {
    ledger.createTask(makeTaskDef());
    expect(ledger.loadLatestDecision('L001')).toBeNull();
  });

  // ─── Full lifecycle ─────────────────────────────────────────────

  it('full lifecycle — create, attempt, candidate, accept', () => {
    // 1. Create task
    const task = ledger.createTask(makeTaskDef());
    expect(task.status).toBe('pending');

    // 2. Record attempt
    ledger.recordAttempt({
      id: 'att-001', taskId: 'L001', prompt: 'Fix the type', runId: 'r1',
      startedAt: '2026-04-15T10:00:00Z', completedAt: '2026-04-15T10:05:00Z',
      duration: 300000, iterations: 3, completed: true,
      reason: 'Quality met', finalScore: 0.85, artifactRef: null,
    });

    const afterAttempt = ledger.loadTask('L001');
    expect(afterAttempt!.status).toBe('in-progress');
    expect(afterAttempt!.attemptCount).toBe(1);

    // 3. Record candidate
    ledger.recordCandidate({
      id: 'cand-001', taskId: 'L001', attemptId: 'att-001',
      code: 'export type X = string | number;',
      semanticScore: 0.88, testPassed: true,
      evaluatedAt: '2026-04-15T10:06:00Z',
    });

    // 4. Accept
    ledger.recordDecision({
      id: 'dec-001', taskId: 'L001', candidateId: 'cand-001',
      decision: 'accepted', rationale: 'Score meets threshold', score: 0.88,
      decidedAt: '2026-04-15T10:08:00Z',
    });

    // 5. Verify final state
    const finalTask = ledger.loadTask('L001');
    expect(finalTask!.status).toBe('completed');

    const attempts = ledger.loadAttempts('L001');
    expect(attempts).toHaveLength(1);

    const candidates = ledger.loadCandidates('L001');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].semanticScore).toBe(0.88);

    const decision = ledger.loadLatestDecision('L001');
    expect(decision!.decision).toBe('accepted');
  });
});
