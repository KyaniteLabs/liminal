/**
 * Integration test: Ledger CLI lifecycle
 *
 * Tests the full dispatch path: parseArgs → execute against real SinterFS.
 * Exercises load, list, show, accept, and status subcommands with
 * actual TaskLedger persistence (tmpdir, no mocks).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { SinterFS } from '../../src/fs/SinterFS.js';
import { TaskLedger } from '../../src/ledger/TaskLedger.js';
import { parseArgs, execute } from '../../src/ledger/cli.js';

describe('Ledger CLI integration', () => {
  let tempDir: string;
  let liminalFs: SinterFS;
  let ledger: TaskLedger;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'liminal-cli-integ-'));
    liminalFs = SinterFS.open(tempDir);
    ledger = new TaskLedger(liminalFs);
  });

  afterEach(() => {
    liminalFs.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('load — creates tasks from JSON file', async () => {
    const corpusPath = join(tempDir, 'tasks.json');
    writeFileSync(corpusPath, JSON.stringify([
      {
        id: 'INT-001',
        title: 'Integration test task',
        description: 'Test task for CLI lifecycle',
        taskClass: 'leaf',
        files: { allowlist: ['src/**'], denylist: [] },
        verifyCommand: 'pnpm test',
        scoringCriteria: ['technical'],
        lane: 1,
        maxAttempts: 3,
      },
    ]));

    const action = parseArgs(['load', corpusPath]);
    await execute(action, ledger);

    const task = ledger.loadTask('INT-001');
    expect(task).not.toBeNull();
    expect(task!.title).toBe('Integration test task');
    expect(task!.status).toBe('pending');
    expect(task!.attemptCount).toBe(0);
  });

  it('list — shows loaded tasks', async () => {
    ledger.createTask({
      id: 'INT-002',
      title: 'List test task',
      description: 'Test listing',
      taskClass: 'leaf',
      files: { allowlist: ['src/**'], denylist: [] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical'],
      lane: 1,
      maxAttempts: 2,
    });

    const action = parseArgs(['list']);
    // Capture console output
    const logSpy = [];
    const origLog = console.log;
    console.log = (...args) => logSpy.push(args.join(' '));

    try {
      await execute(action, ledger);
    } finally {
      console.log = origLog;
    }

    const output = logSpy.join('\n');
    expect(output).toContain('INT-002');
    expect(output).toContain('List test task');
  });

  it('show — displays task details', async () => {
    ledger.createTask({
      id: 'INT-003',
      title: 'Show test task',
      description: 'Detailed description for show test',
      taskClass: 'wiring',
      files: { allowlist: ['src/a.ts'], denylist: ['src/core/*'] },
      verifyCommand: 'pnpm build',
      scoringCriteria: ['correctness'],
      lane: 2,
      maxAttempts: 3,
    });

    const action = parseArgs(['show', 'INT-003']);
    const logSpy = [];
    const origLog = console.log;
    console.log = (...args) => logSpy.push(args.join(' '));

    try {
      await execute(action, ledger);
    } finally {
      console.log = origLog;
    }

    const output = logSpy.join('\n');
    expect(output).toContain('Show test task');
    expect(output).toContain('wiring');
    expect(output).toContain('pending');
    expect(output).toContain('pnpm build');
    expect(output).toContain('Detailed description for show test');
  });

  it('accept — records acceptance decision and updates status', async () => {
    ledger.createTask({
      id: 'INT-004',
      title: 'Accept test task',
      description: 'Test accept',
      taskClass: 'leaf',
      files: { allowlist: ['src/**'], denylist: [] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical'],
      lane: 1,
      maxAttempts: 1,
    });

    const action = parseArgs(['accept', 'INT-004', 'cand-test-001']);
    await execute(action, ledger);

    // Task status should now be 'completed'
    const task = ledger.loadTask('INT-004');
    expect(task!.status).toBe('completed');

    // Decision should be recorded
    const decision = ledger.loadLatestDecision('INT-004');
    expect(decision).not.toBeNull();
    expect(decision!.decision).toBe('accepted');
    expect(decision!.candidateId).toBe('cand-test-001');
  });

  it('status — shows summary counts', async () => {
    ledger.createTask({
      id: 'INT-005',
      title: 'Status pending',
      description: 'Pending task',
      taskClass: 'leaf',
      files: { allowlist: ['src/**'], denylist: [] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical'],
      lane: 1,
      maxAttempts: 1,
    });
    ledger.createTask({
      id: 'INT-006',
      title: 'Status completed',
      description: 'Completed task',
      taskClass: 'leaf',
      files: { allowlist: ['src/**'], denylist: [] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical'],
      lane: 1,
      maxAttempts: 1,
    });
    ledger.updateTaskStatus('INT-006', 'completed');

    const action = parseArgs(['status']);
    const logSpy = [];
    const origLog = console.log;
    console.log = (...args) => logSpy.push(args.join(' '));

    try {
      await execute(action, ledger);
    } finally {
      console.log = origLog;
    }

    const output = logSpy.join('\n');
    expect(output).toContain('Total:       2');
    expect(output).toContain('Pending:     1');
    expect(output).toContain('Completed:   1');
  });

  it('status --verbose — shows per-task attempt/candidate breakdown', async () => {
    ledger.createTask({
      id: 'INT-007',
      title: 'Verbose task',
      description: 'Test verbose status',
      taskClass: 'leaf',
      files: { allowlist: ['src/**'], denylist: [] },
      verifyCommand: 'pnpm test',
      scoringCriteria: ['technical'],
      lane: 1,
      maxAttempts: 3,
    });

    const action = parseArgs(['status', '--verbose']);
    const logSpy = [];
    const origLog = console.log;
    console.log = (...args) => logSpy.push(args.join(' '));

    try {
      await execute(action, ledger);
    } finally {
      console.log = origLog;
    }

    const output = logSpy.join('\n');
    expect(output).toContain('INT-007');
    expect(output).toContain('attempts:');
    expect(output).toContain('candidates:');
  });
});
