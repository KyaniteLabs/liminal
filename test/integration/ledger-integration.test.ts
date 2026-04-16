/**
 * TaskLedger integration test — full lifecycle against a real LiminalFS
 * instance in a temp directory, plus corpus file loading.
 *
 * Exercises: createTask, recordAttempt, recordCandidate, recordDecision,
 * loadTask, loadAttempts, loadCandidates, loadLatestDecision.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LiminalFS } from '../../src/fs/LiminalFS.js';
import { TaskLedger } from '../../src/ledger/TaskLedger.js';
import type { TaskAttempt, TaskCandidate, TaskDecision } from '../../src/ledger/types.js';

// ─── Helpers ──────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'liminal-ledger-inttest-'));
}

/** Minimal task definition matching L001.json from the corpus */
function l001Def() {
  return {
    id: 'L001',
    title: 'Add test for TraceFSAdapter.linkReasoningTrace',
    description:
      'Write a unit test in test/unit/fs/TraceFSAdapter.test.ts that verifies linkReasoningTrace stores a trace artifact via LiminalFS.writeArtifact and creates a ref at trace/<traceId>.',
    taskClass: 'leaf' as const,
    files: {
      allowlist: ['test/unit/fs/TraceFSAdapter.test.ts'],
      denylist: ['src/**', 'test/unit/core/*', 'test/unit/generators/*'],
    },
    verifyCommand: 'pnpm vitest run test/unit/fs/TraceFSAdapter.test.ts --coverage=false',
    scoringCriteria: ['technical', 'codeStructure'],
    lane: 1,
    maxAttempts: 3,
  };
}

function makeAttempt(taskId: string, attemptId: string): TaskAttempt {
  return {
    id: attemptId,
    taskId,
    prompt: 'Write a unit test for linkReasoningTrace',
    runId: 'run-001',
    startedAt: '2026-04-15T10:00:00.000Z',
    completedAt: '2026-04-15T10:05:00.000Z',
    duration: 300000,
    iterations: 3,
    completed: true,
    reason: 'maxIterationsReached',
    finalScore: 0.85,
    artifactRef: null,
  };
}

function makeCandidate(taskId: string, attemptId: string, candidateId: string): TaskCandidate {
  return {
    id: candidateId,
    taskId,
    attemptId,
    code: "import { describe, it, expect } from 'vitest';\n// test code here\n",
    semanticScore: 0.82,
    testPassed: true,
    evaluatedAt: '2026-04-15T10:06:00.000Z',
  };
}

function makeDecision(taskId: string, candidateId: string, decisionId: string): TaskDecision {
  return {
    id: decisionId,
    taskId,
    candidateId,
    decision: 'accepted',
    rationale: 'Test passes all assertions and covers the required behavior.',
    score: 0.82,
    decidedAt: '2026-04-15T10:07:00.000Z',
  };
}

// ─── Full Lifecycle Test ──────────────────────────────────────────

describe('TaskLedger integration — full lifecycle', () => {
  let tempDir: string;
  let liminalFs: LiminalFS;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = makeTempDir();
    liminalFs = LiminalFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs the full task lifecycle: create -> attempt -> candidate -> decision', () => {
    // Step 1: Create task from L001 definition
    const task = ledger.createTask(l001Def());

    // Step 2: Verify manifest file exists on disk
    const manifestPath = join(tempDir, '.liminal', 'manifests', 'task', 'L001', 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const onDisk = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(onDisk.id).toBe('L001');
    expect(onDisk.status).toBe('pending');
    expect(onDisk.taskClass).toBe('leaf');
    expect(onDisk.scoringCriteria).toEqual(['technical', 'codeStructure']);
    expect(onDisk.lane).toBe(1);
    expect(onDisk.attemptCount).toBe(0);

    // Step 3: Record an attempt
    const attempt = makeAttempt('L001', 'att-test');
    ledger.recordAttempt(attempt);

    // Step 4: Verify attempt manifest exists
    const attemptManifest = join(
      tempDir, '.liminal', 'manifests', 'task', 'L001', 'attempt', 'att-test.json',
    );
    expect(existsSync(attemptManifest)).toBe(true);

    const attemptOnDisk = JSON.parse(readFileSync(attemptManifest, 'utf-8'));
    expect(attemptOnDisk.taskId).toBe('L001');
    expect(attemptOnDisk.runId).toBe('run-001');
    expect(attemptOnDisk.finalScore).toBe(0.85);

    // Step 5: Verify attempt ref exists
    const attemptRef = join(tempDir, '.liminal', 'refs', 'task', 'L001', 'attempt', 'att-test.json');
    expect(existsSync(attemptRef)).toBe(true);

    // Step 6: Verify task status advanced to in-progress
    const afterAttempt = ledger.loadTask('L001');
    expect(afterAttempt!.status).toBe('in-progress');
    expect(afterAttempt!.attemptCount).toBe(1);

    // Step 7: Record a candidate
    const candidate = makeCandidate('L001', 'att-test', 'cand-test');
    ledger.recordCandidate(candidate);

    // Step 8: Verify candidate manifest exists
    const candidateManifest = join(
      tempDir, '.liminal', 'manifests', 'task', 'L001', 'candidate', 'cand-test.json',
    );
    expect(existsSync(candidateManifest)).toBe(true);

    const candidateOnDisk = JSON.parse(readFileSync(candidateManifest, 'utf-8'));
    expect(candidateOnDisk.taskId).toBe('L001');
    expect(candidateOnDisk.semanticScore).toBe(0.82);
    expect(candidateOnDisk.testPassed).toBe(true);

    // Step 9: Verify candidate ref exists
    const candidateRef = join(tempDir, '.liminal', 'refs', 'task', 'L001', 'candidate', 'cand-test.json');
    expect(existsSync(candidateRef)).toBe(true);

    // Step 10: Record a decision (accept)
    const decision = makeDecision('L001', 'cand-test', 'dec-test');
    ledger.recordDecision(decision);

    // Step 11: Verify decision manifest exists
    const decisionManifest = join(
      tempDir, '.liminal', 'manifests', 'task', 'L001', 'decision', 'dec-test.json',
    );
    expect(existsSync(decisionManifest)).toBe(true);

    const decisionOnDisk = JSON.parse(readFileSync(decisionManifest, 'utf-8'));
    expect(decisionOnDisk.decision).toBe('accepted');
    expect(decisionOnDisk.score).toBe(0.82);

    // Step 12: Verify task status is now completed
    const completed = ledger.loadTask('L001');
    expect(completed!.status).toBe('completed');

    // Step 13: Verify loadable via ledger query methods
    const attempts = ledger.loadAttempts('L001');
    expect(attempts.length).toBe(1);
    expect(attempts[0].id).toBe('att-test');
    expect(attempts[0].finalScore).toBe(0.85);

    const candidates = ledger.loadCandidates('L001');
    expect(candidates.length).toBe(1);
    expect(candidates[0].id).toBe('cand-test');
    expect(candidates[0].testPassed).toBe(true);

    const latestDecision = ledger.loadLatestDecision('L001');
    expect(latestDecision!.decision).toBe('accepted');
    expect(latestDecision!.candidateId).toBe('cand-test');
  });

  it('loads task definitions from corpus JSON files', () => {
    // Read L001.json from the ledger-tasks corpus directory
    const corpusPath = join(process.cwd(), 'ledger-tasks', 'L001.json');
    const raw = readFileSync(corpusPath, 'utf-8');
    const corpusDef = JSON.parse(raw);

    // Create task from the corpus definition
    const task = ledger.createTask(corpusDef);

    expect(task.id).toBe('L001');
    expect(task.taskClass).toBe('leaf');
    expect(task.scoringCriteria).toEqual(['technical', 'codeStructure']);
    expect(task.lane).toBe(1);
    expect(task.maxAttempts).toBe(3);
    expect(task.status).toBe('pending');
    expect(task.attemptCount).toBe(0);

    // Verify persisted correctly
    const loaded = ledger.loadTask('L001');
    expect(loaded!.title).toBe('Add test for TraceFSAdapter.linkReasoningTrace');
    expect(loaded!.files.allowlist).toEqual(['test/unit/fs/TraceFSAdapter.test.ts']);
  });

  it('handles rejection decision — task remains in-progress', () => {
    ledger.createTask(l001Def());

    const attempt = makeAttempt('L001', 'att-rej');
    ledger.recordAttempt(attempt);

    const candidate = makeCandidate('L001', 'att-rej', 'cand-rej');
    ledger.recordCandidate(candidate);

    const rejection: TaskDecision = {
      id: 'dec-rej',
      taskId: 'L001',
      candidateId: 'cand-rej',
      decision: 'rejected',
      rationale: 'Test does not cover error paths.',
      score: 0.45,
      decidedAt: '2026-04-15T11:00:00.000Z',
    };
    ledger.recordDecision(rejection);

    const task = ledger.loadTask('L001');
    expect(task!.status).toBe('in-progress');

    const latest = ledger.loadLatestDecision('L001');
    expect(latest!.decision).toBe('rejected');
    expect(latest!.score).toBe(0.45);
  });

  it('returns empty arrays and null for tasks with no sub-entities', () => {
    ledger.createTask(l001Def());

    expect(ledger.loadAttempts('L001')).toEqual([]);
    expect(ledger.loadCandidates('L001')).toEqual([]);
    expect(ledger.loadLatestDecision('L001')).toBeNull();
  });
});
