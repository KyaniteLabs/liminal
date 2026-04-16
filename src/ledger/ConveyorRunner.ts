/**
 * Phase 10 Lane 10-2: ConveyorRunner — Batch execution with retry budgets.
 *
 * Processes tasks from the ledger in priority order:
 *   1. Sort pending tasks by class (leaf → wiring → harness-quality → orchestrator)
 *   2. Execute each task via TaskRunner
 *   3. Verify and score each candidate via TaskVerifier
 *   4. Apply retry budget per task (default: 3 attempts)
 *   5. Classify failures for retry recommendations
 */

import type { TaskLedger } from './TaskLedger.js';
import type { TaskManifest, TaskClass, FailureClass, ConveyorTaskResult, ConveyorBatchResult } from './types.js';
import { TaskRunner } from './TaskRunner.js';
import { TaskVerifier } from './TaskVerifier.js';

/** Options for batch execution */
export interface ConveyorRunnerOptions {
  /** Maximum number of tasks to process in this batch */
  maxTasks?: number;
  /** Maximum retry attempts per task (default: 3) */
  maxRetries?: number;
  /** Only process tasks of these classes */
  classFilter?: TaskClass[];
}

/** Acceptance threshold */
const ACCEPT_SCORE = 0.6;

/** Class priority order for processing */
const CLASS_ORDER: Record<TaskClass, number> = {
  leaf: 0,
  wiring: 1,
  'harness-quality': 2,
  orchestrator: 3,
};

export class ConveyorRunner {
  private runner: TaskRunner;
  private verifier: TaskVerifier;

  constructor(private ledger: TaskLedger) {
    this.runner = new TaskRunner(ledger);
    this.verifier = new TaskVerifier(ledger);
  }

  /** Run a batch of pending tasks through the conveyor. */
  async runBatch(options?: ConveyorRunnerOptions): Promise<ConveyorBatchResult> {
    const maxRetries = options?.maxRetries ?? 3;
    const startedAt = new Date().toISOString();

    // Get and sort pending tasks
    let tasks = this.ledger.listTasks({ status: 'pending' });
    tasks = tasks
      .filter(t => !options?.classFilter || options.classFilter.includes(t.taskClass))
      .sort((a, b) => {
        const classDiff = CLASS_ORDER[a.taskClass] - CLASS_ORDER[b.taskClass];
        if (classDiff !== 0) return classDiff;
        return a.lane - b.lane;
      });

    if (options?.maxTasks) {
      tasks = tasks.slice(0, options.maxTasks);
    }

    const results: ConveyorTaskResult[] = [];
    const failureBreakdown: Record<FailureClass, number> = {
      'generator-weakness': 0,
      'verifier-opacity': 0,
      'harness-issue': 0,
      'task-spec-issue': 0,
      'provider-issue': 0,
    };

    for (const task of tasks) {
      const result = await this.processTask(task, maxRetries);
      results.push(result);

      if (result.failureClass) {
        failureBreakdown[result.failureClass]++;
      }
    }

    const completedAt = new Date().toISOString();
    const tasksAccepted = results.filter(r => r.status === 'accepted').length;
    const tasksFailed = results.filter(r => r.status === 'failed').length;
    const tasksEscalated = results.filter(r => r.status === 'escalated').length;

    return {
      batchId: `batch-${Date.now()}`,
      startedAt,
      completedAt,
      tasksAttempted: results.length,
      tasksAccepted,
      tasksFailed,
      tasksEscalated,
      acceptanceRate: results.length > 0 ? tasksAccepted / results.length : 0,
      coverageBefore: { statements: 0, branches: 0, functions: 0, lines: 0 },
      coverageAfter: { statements: 0, branches: 0, functions: 0, lines: 0 },
      failureBreakdown,
      results,
    };
  }

  /** Process a single task with retry budget. */
  private async processTask(task: TaskManifest, maxRetries: number): Promise<ConveyorTaskResult> {
    const startTime = Date.now();
    let lastScore = 0;
    let lastTestPassed = false;
    let lastReason = '';
    let attempts = 0;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      attempts++;
      try {
        const attemptResult = await this.runner.runTask(task);
        lastReason = attemptResult.reason;
        lastScore = attemptResult.finalScore;

        // Try to verify if there's an artifact
        if (attemptResult.artifactRef) {
          const code = this.ledger.getFs().readArtifact(attemptResult.artifactRef)?.toString('utf-8');
          if (code) {
            const candidate = await this.verifier.verify(task, attemptResult, code);
            lastScore = candidate.semanticScore;
            lastTestPassed = candidate.testPassed;

            if (lastScore >= ACCEPT_SCORE && lastTestPassed) {
              // Accept this candidate
              this.ledger.recordDecision({
                id: `dec-${Date.now()}`,
                taskId: task.id,
                candidateId: candidate.id,
                decision: 'accepted',
                rationale: `Score ${lastScore.toFixed(3)} ≥ ${ACCEPT_SCORE}, tests passed`,
                score: lastScore,
                decidedAt: new Date().toISOString(),
              });

              return {
                taskId: task.id,
                status: 'accepted',
                attempts,
                finalScore: lastScore,
                testPassed: lastTestPassed,
                durationMs: Date.now() - startTime,
              };
            }
          }
        }
      } catch (err) {
        const message = (err as Error).message;
        lastReason = message;
        const failureClass = this.classifyFromError(message);
        if (failureClass === 'provider-issue') {
          // Provider issues get one immediate retry
          continue;
        }
      }
    }

    // All retries exhausted
    const failureClass = this.classifyFailure(lastReason, lastScore, lastTestPassed, attempts);

    if (attempts >= maxRetries) {
      this.ledger.updateTaskStatus(task.id, 'failed');
    }

    return {
      taskId: task.id,
      status: lastScore >= 0.4 ? 'escalated' : 'failed',
      attempts,
      finalScore: lastScore,
      testPassed: lastTestPassed,
      durationMs: Date.now() - startTime,
      failureClass,
    };
  }

  /** Classify failure based on observed signals. */
  private classifyFailure(reason: string, score: number, testPassed: boolean, attempt: number): FailureClass {
    if (reason.includes('timeout') || reason.includes('rate')) return 'provider-issue';
    if (score < 0.2 && attempt > 1) return 'generator-weakness';
    if (score >= 0.5 && !testPassed) return 'task-spec-issue';
    if (reason.includes('harness') || reason.includes('verify')) return 'harness-issue';
    if (score < 0.4) return 'verifier-opacity';
    return 'generator-weakness';
  }

  /** Classify from error message alone. */
  private classifyFromError(message: string): FailureClass {
    if (message.includes('timeout') || message.includes('rate') || message.includes('429') || message.includes('503')) {
      return 'provider-issue';
    }
    if (message.includes('harness') || message.includes('verify')) {
      return 'harness-issue';
    }
    return 'generator-weakness';
  }
}
