/**
 * TaskRunner — Wraps RalphLoop.run() for ledger-tracked task execution.
 *
 * Does NOT subclass or extract RalphLoop. Composes it via a thin wrapper
 * that builds a structured prompt from the task manifest and records
 * every attempt in the TaskLedger.
 */

import { RalphLoop } from '../core/RalphLoop.js';
import type { TaskLedger } from './TaskLedger.js';
import type { TaskManifest, TaskAttempt } from './types.js';

export interface TaskRunnerOptions {
  maxIterations?: number;
  signal?: AbortSignal;
}

export class TaskRunner {
  constructor(
    private ledger: TaskLedger,
  ) {}

  async runTask(task: TaskManifest, options?: TaskRunnerOptions): Promise<TaskAttempt> {
    const attemptId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prompt = this.buildPrompt(task);
    const startTime = Date.now();

    const result = await RalphLoop.run(prompt, {
      maxIterations: options?.maxIterations ?? 3,
      evaluationCriteria: task.scoringCriteria,
      signal: options?.signal,
    });

    const attempt: TaskAttempt = {
      id: attemptId,
      taskId: task.id,
      prompt,
      runId: result.timestamp,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      iterations: result.iterations,
      completed: result.completed,
      reason: result.reason,
      finalScore: result.finalScore,
      artifactRef: null,
    };

    this.ledger.recordAttempt(attempt);
    return attempt;
  }

  private buildPrompt(task: TaskManifest): string {
    return [
      `Task: ${task.title}`,
      '',
      task.description,
      '',
      '## File Boundaries',
      `ALLOWED files: ${task.files.allowlist.join(', ')}`,
      `FORBIDDEN files: ${task.files.denylist.join(', ')}`,
      '',
      '## Verification',
      `After making changes, verify with: ${task.verifyCommand}`,
    ].join('\n');
  }
}
