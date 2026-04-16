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
import { TaskRunner } from './TaskRunner.js';
import { TaskVerifier } from './TaskVerifier.js';
// @architecture Phase 10 conveyor imports
import { TaskIntake } from './TaskIntake.js';
import { ConveyorRunner } from './ConveyorRunner.js';
import { ConveyorMonitor } from './ConveyorMonitor.js';

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
  if (argv[0] === 'intake') {
    const coverageIdx = argv.indexOf('--coverage');
    const outputIdx = argv.indexOf('--output');
    const minIdx = argv.indexOf('--min');
    return {
      command: 'intake',
      coveragePath: coverageIdx !== -1 ? argv[coverageIdx + 1] : undefined,
      outputPath: outputIdx !== -1 ? argv[outputIdx + 1] : undefined,
      minTasks: minIdx !== -1 ? parseInt(argv[minIdx + 1], 10) : undefined,
    };
  }
  if (argv[0] === 'batch') {
    const maxIdx = argv.indexOf('--max-tasks');
    const maxTasks = maxIdx !== -1 ? parseInt(argv[maxIdx + 1], 10) : undefined;
    return { command: 'batch', maxTasks: !isNaN(maxTasks as number) ? maxTasks : undefined, dryRun: argv.includes('--dry-run') };
  }
  if (argv[0] === 'dashboard') {
    const fmtIdx = argv.indexOf('--format');
    return { command: 'dashboard', format: fmtIdx !== -1 ? (argv[fmtIdx + 1] as 'text' | 'json') : undefined };
  }
  return { command: 'status', verbose: argv.includes('--verbose') };
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
      if (action.verbose && tasks.length > 0) {
        console.log(`\n  Per-task breakdown:\n`);
        for (const task of tasks) {
          const attempts = ledger.loadAttempts(task.id).length;
          const candidates = ledger.loadCandidates(task.id);
          const latestScore = candidates.length > 0
            ? candidates[candidates.length - 1].semanticScore.toFixed(3)
            : '—';
          console.log(`  ${task.id.padEnd(6)} ${task.status.padEnd(12)} attempts:${String(attempts).padEnd(3)} candidates:${String(candidates.length).padEnd(3)} latest:${latestScore}  ${task.title}`);
        }
      }
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
      const runner = new TaskRunner(ledger);
      const attempt = await runner.runTask(task);
      console.log(`  Attempt:     ${attempt.id}`);
      console.log(`  Iterations:  ${attempt.iterations}`);
      console.log(`  Score:       ${attempt.finalScore.toFixed(3)}`);
      console.log(`  Completed:   ${attempt.completed}`);
      console.log(`  Reason:      ${attempt.reason}`);
      console.log(`  Duration:    ${attempt.duration}ms`);
      console.log('');
      break;
    }
    case 'verify': {
      const task = ledger.loadTask(action.taskId);
      if (!task) {
        console.error(`Task not found: ${action.taskId}`);
        process.exit(1);
      }
      // Find latest attempt with code
      const attempts = ledger.loadAttempts(action.taskId);
      const latestAttempt = attempts[attempts.length - 1];
      if (!latestAttempt || !latestAttempt.artifactRef) {
        console.error('No attempt with generated code found. Run the task first.');
        process.exit(1);
      }
      const code = ledger.getFs().readArtifact(latestAttempt.artifactRef)?.toString('utf-8');
      if (!code) {
        console.error('Could not read artifact code.');
        process.exit(1);
      }

      console.log(`\n  Verifying task ${task.id}...\n`);
      console.log(`  Attempt:     ${latestAttempt.id}`);
      console.log(`  Verify cmd:  ${task.verifyCommand}`);
      console.log(`  Code length: ${code.length} chars`);

      const verifier = new TaskVerifier(ledger);
      const candidate = await verifier.verify(task, latestAttempt, code);
      console.log(`  Candidate:   ${candidate.id}`);
      console.log(`  Score:       ${candidate.semanticScore.toFixed(3)}`);
      console.log(`  Tests pass:  ${candidate.testPassed}`);
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
    case 'intake': {
      const intake = new TaskIntake({
        coveragePath: action.coveragePath,
        minTasks: action.minTasks,
      });
      const specs = intake.run();
      if (specs.length === 0) {
        console.log('No candidate tasks found. Ensure coverage data is available.');
        break;
      }
      // Load specs into ledger (skip tasks that already exist to preserve progress)
      let loaded = 0;
      let skipped = 0;
      for (const spec of specs) {
        if (ledger.loadTask(spec.id)) {
          skipped++;
          continue;
        }
        try {
          ledger.createTask(spec as Omit<TaskManifest, 'status' | 'attemptCount' | 'createdAt' | 'updatedAt'>);
          loaded++;
        } catch {
          // Other write error — skip
        }
      }
      console.log(`\n  Task Intake\n`);
      console.log(`  Candidates:  ${specs.length}`);
      console.log(`  Loaded:       ${loaded}`);
      if (skipped > 0) console.log(`  Skipped:      ${skipped} (already exist)`);
      // Summary by class
      const byClass: Record<string, number> = {};
      for (const s of specs) {
        byClass[s.taskClass] = (byClass[s.taskClass] ?? 0) + 1;
      }
      console.log(`  By class:     ${Object.entries(byClass).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      // Optionally write to file
      if (action.outputPath) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const outputPath = path.resolve(action.outputPath);
        fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2));
        console.log(`  Output:       ${outputPath}`);
      }
      console.log('');
      break;
    }
    case 'batch': {
      console.log(`\n  Conveyor Batch\n`);
      const pendingTasks = ledger.listTasks().filter(t => t.status === 'pending');
      if (action.dryRun) {
        console.log(`  [DRY RUN] Would process ${pendingTasks.length} pending task(s)${action.maxTasks ? ` (max ${action.maxTasks})` : ''}`);
        for (const task of pendingTasks.slice(0, action.maxTasks ?? pendingTasks.length)) {
          console.log(`    ${task.id.padEnd(6)} ${task.taskClass.padEnd(18)} ${task.title}`);
        }
        break;
      }
      const runner = new ConveyorRunner(ledger);
      const result = await runner.runBatch({ maxTasks: action.maxTasks });
      const monitor = new ConveyorMonitor(ledger);
      const dashboard = monitor.generateDashboard(result);
      console.log(monitor.formatText(dashboard));
      break;
    }
    case 'dashboard': {
      // Dashboard shows latest batch result from ledger state
      const tasks = ledger.listTasks();
      const completed = tasks.filter(t => t.status === 'completed');
      const failed = tasks.filter(t => t.status === 'failed');
      const pending = tasks.filter(t => t.status === 'pending');
      const inProgress = tasks.filter(t => t.status === 'in-progress');
      console.log(`\n  Ledger Dashboard\n`);
      console.log(`  Total:       ${tasks.length}`);
      console.log(`  Pending:     ${pending.length}`);
      console.log(`  In Progress: ${inProgress.length}`);
      console.log(`  Completed:   ${completed.length}`);
      console.log(`  Failed:      ${failed.length}`);
      if (completed.length > 0) {
        console.log(`\n  Acceptance rate: ${(completed.length / tasks.length * 100).toFixed(1)}%`);
      }
      if (action.format === 'json') {
        console.log('\n' + JSON.stringify({ total: tasks.length, pending: pending.length, inProgress: inProgress.length, completed: completed.length, failed: failed.length }, null, 2));
      }
      console.log('');
      break;
    }
  }
}
