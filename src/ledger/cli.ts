/**
 * Phase 9 Lane 2: Task Ledger CLI
 *
 * Provides the `liminal ledger` command surface.
 * parseArgs() returns a LedgerCLIAction discriminated union.
 * execute() dispatches against a TaskLedger instance.
 *
 * Follows the CompostMill CLI pattern (parseArgs + execute).
 */

import type { TaskLedger } from './TaskLedger.js';
import type { LedgerCLIAction, TaskManifest } from './types.js';

export function parseArgs(args: string[]): LedgerCLIAction {
  const argv = args[0] === 'ledger' ? args.slice(1) : args;

  if (argv[0] === 'list') {
    const laneIdx = argv.indexOf('--lane');
    const lane = laneIdx !== -1 ? parseInt(argv[laneIdx + 1], 10) : undefined;
    return { command: 'list', lane: !isNaN(lane as number) ? lane : undefined };
  }
  if (argv[0] === 'show') {
    return { command: 'show', taskId: argv[1] ?? '' };
  }
  if (argv[0] === 'run') {
    const dryRun = argv.includes('--dry-run');
    return { command: 'run', taskId: argv[1] ?? '', dryRun };
  }
  if (argv[0] === 'verify') {
    return { command: 'verify', taskId: argv[1] ?? '' };
  }
  if (argv[0] === 'accept') {
    return { command: 'accept', taskId: argv[1] ?? '', candidateId: argv[2] ?? '' };
  }
  if (argv[0] === 'reject') {
    const reasonIdx = argv.indexOf('--reason');
    return {
      command: 'reject',
      taskId: argv[1] ?? '',
      candidateId: argv[2] ?? '',
      reason: reasonIdx !== -1 ? argv[reasonIdx + 1] : undefined,
    };
  }
  if (argv[0] === 'load') {
    return { command: 'load', path: argv[1] ?? '' };
  }
  return { command: 'status' };
}

export async function execute(
  action: LedgerCLIAction,
  ledger: TaskLedger,
): Promise<void> {
  switch (action.command) {
    case 'status': {
      const tasks = ledger.listTasks();
      const pending = tasks.filter(t => t.status === 'pending').length;
      const inProgress = tasks.filter(t => t.status === 'in-progress').length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      console.log(`\n  Task Ledger Status\n`);
      console.log(`  Total:       ${tasks.length}`);
      console.log(`  Pending:     ${pending}`);
      console.log(`  In Progress: ${inProgress}`);
      console.log(`  Completed:   ${completed}`);
      console.log(`  Failed:      ${failed}`);
      console.log('');
      break;
    }
    case 'list': {
      const tasks = ledger.listTasks({ lane: action.lane });
      if (tasks.length === 0) {
        console.log('No tasks found.');
        break;
      }
      console.log(`\n  Tasks (${tasks.length}):\n`);
      for (const task of tasks) {
        console.log(`  ${task.id.padEnd(6)} ${task.status.padEnd(12)} ${task.taskClass.padEnd(18)} ${task.title}`);
      }
      console.log('');
      break;
    }
    case 'show': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      console.log(`\n  Task: ${task.id}\n`);
      console.log(`  Title:     ${task.title}`);
      console.log(`  Class:     ${task.taskClass}`);
      console.log(`  Status:    ${task.status}`);
      console.log(`  Lane:      ${task.lane}`);
      console.log(`  Attempts:  ${task.attemptCount}/${task.maxAttempts}`);
      console.log(`  Verify:    ${task.verifyCommand}`);
      console.log(`  Allow:     ${task.files.allowlist.join(', ')}`);
      console.log(`  Deny:      ${task.files.denylist.join(', ')}`);
      console.log(`  Created:   ${task.createdAt}`);
      console.log(`  Updated:   ${task.updatedAt}`);
      console.log('');
      console.log(`  Description:\n    ${task.description}`);
      console.log('');
      break;
    }
    case 'run': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      if (action.dryRun) {
        console.log(`\n  Dry run for task ${task.id}: ${task.title}\n`);
        console.log(`  Would execute with prompt based on task definition.`);
        console.log(`  Max iterations: 3`);
        console.log(`  Verify command: ${task.verifyCommand}`);
        console.log('');
        break;
      }
      console.log(`\n  Running task ${task.id}: ${task.title}...\n`);
      console.log('  (TaskRunner execution not yet wired — use from code)');
      console.log('');
      break;
    }
    case 'verify': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      console.log(`\n  Verifying task ${task.id}...\n`);
      console.log(`  Verify command: ${task.verifyCommand}`);
      console.log('  (TaskVerifier execution not yet wired — use from code)');
      console.log('');
      break;
    }
    case 'accept': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      ledger.recordDecision({
        id: `dec-${Date.now()}`,
        taskId: action.taskId,
        candidateId: action.candidateId,
        decision: 'accepted',
        rationale: 'Accepted via CLI',
        score: 0,
        decidedAt: new Date().toISOString(),
      });
      console.log(`Accepted candidate ${action.candidateId} for task ${action.taskId}`);
      break;
    }
    case 'reject': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      ledger.recordDecision({
        id: `dec-${Date.now()}`,
        taskId: action.taskId,
        candidateId: action.candidateId,
        decision: 'rejected',
        rationale: action.reason ?? 'Rejected via CLI',
        score: 0,
        decidedAt: new Date().toISOString(),
      });
      console.log(`Rejected candidate ${action.candidateId} for task ${action.taskId}`);
      break;
    }
    case 'load': {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const filePath = path.resolve(action.path);
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      let defs: unknown[];
      try {
        const parsed = JSON.parse(content);
        defs = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        console.error(`Invalid JSON in ${filePath}: ${(err as Error).message}`);
        process.exit(1);
      }
      let loaded = 0;
      for (const def of defs) {
        try {
          ledger.createTask(def as Omit<TaskManifest, 'status' | 'attemptCount' | 'createdAt' | 'updatedAt'>);
          loaded++;
        } catch (err) {
          console.error(`Failed to load task ${(def as Record<string, unknown>).id}: ${(err as Error).message}`);
        }
      }
      console.log(`Loaded ${loaded} task(s) from ${filePath}`);
      break;
    }
  }
}
