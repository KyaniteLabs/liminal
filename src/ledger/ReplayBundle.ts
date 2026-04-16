/**
 * Phase 10 Lane 10-4: ReplayBundle — Evidence packaging and retry classification.
 *
 * Packages the complete lineage of a task (manifest, attempts, candidates, decision)
 * into a portable JSON bundle for offline analysis, retry planning, and audit.
 *
 * Also provides retry recommendations based on failure classification:
 *   - generator-weakness → retry with different temperature/model
 *   - verifier-opacity → retry with clearer scoring criteria
 *   - task-spec-issue → re-spec the task
 *   - harness-issue → fix the harness first
 *   - provider-issue → retry with fallback provider
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskLedger } from './TaskLedger.js';
import type { FailureClass } from './types.js';

/** The complete replay bundle for a task */
export interface ReplayBundleData {
  taskId: string;
  exportedAt: string;
  manifest: {
    id: string;
    title: string;
    taskClass: string;
    status: string;
    files: { allowlist: string[]; denylist: string[] };
    verifyCommand: string;
    scoringCriteria: string[];
    lane: number;
    maxAttempts: number;
  };
  attempts: Array<{
    id: string;
    startedAt: string;
    completedAt: string;
    duration: number;
    iterations: number;
    completed: boolean;
    reason: string;
    finalScore: number;
    hasCode: boolean;
  }>;
  candidates: Array<{
    id: string;
    attemptId: string;
    semanticScore: number;
    testPassed: boolean;
    code: string;
    verifyStdout?: string;
    verifyStderr?: string;
    evaluatedAt: string;
  }>;
  decision: {
    id: string;
    decision: string;
    rationale: string;
    score: number;
    decidedAt: string;
  } | null;
}

/** Retry recommendation for a failed task */
export interface RetryRecommendation {
  taskId: string;
  failureClass: FailureClass;
  action: 'retry-same' | 'retry-different-temp' | 'respec' | 'fix-harness' | 'fallback-provider';
  rationale: string;
  suggestedChanges: string[];
}

export class ReplayBundle {
  constructor(private ledger: TaskLedger) {}

  /** Export a complete replay bundle for a task. */
  export(taskId: string): ReplayBundleData {
    const task = this.ledger.loadTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const attempts = this.ledger.loadAttempts(taskId);
    const candidates = this.ledger.loadCandidates(taskId);
    const decision = this.ledger.loadLatestDecision(taskId);

    return {
      taskId,
      exportedAt: new Date().toISOString(),
      manifest: {
        id: task.id,
        title: task.title,
        taskClass: task.taskClass,
        status: task.status,
        files: task.files,
        verifyCommand: task.verifyCommand,
        scoringCriteria: task.scoringCriteria,
        lane: task.lane,
        maxAttempts: task.maxAttempts,
      },
      attempts: attempts.map(a => ({
        id: a.id,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        duration: a.duration,
        iterations: a.iterations,
        completed: a.completed,
        reason: a.reason,
        finalScore: a.finalScore,
        hasCode: a.artifactRef !== null,
      })),
      candidates: candidates.map(c => ({
        id: c.id,
        attemptId: c.attemptId,
        semanticScore: c.semanticScore,
        testPassed: c.testPassed,
        code: c.code,
        verifyStdout: c.verifyStdout,
        verifyStderr: c.verifyStderr,
        evaluatedAt: c.evaluatedAt,
      })),
      decision: decision ? {
        id: decision.id,
        decision: decision.decision,
        rationale: decision.rationale,
        score: decision.score,
        decidedAt: decision.decidedAt,
      } : null,
    };
  }

  /** Export bundle to a JSON file. */
  exportToFile(taskId: string, outputDir: string): string {
    const bundle = this.export(taskId);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    const filePath = join(outputDir, `${taskId}-replay.json`);
    writeFileSync(filePath, JSON.stringify(bundle, null, 2));
    return filePath;
  }

  /** Export replay bundles for all accepted (completed) tasks. */
  exportAllAccepted(outputDir: string): string[] {
    const tasks = this.ledger.listTasks({ status: 'completed' });
    const paths: string[] = [];
    for (const task of tasks) {
      try {
        const filePath = this.exportToFile(task.id, outputDir);
        paths.push(filePath);
      } catch {
        // Skip tasks that can't be exported
      }
    }
    return paths;
  }

  /** Recommend a retry strategy for a failed task. */
  recommendRetry(taskId: string): RetryRecommendation {
    const bundle = this.export(taskId);
    const lastAttempt = bundle.attempts[bundle.attempts.length - 1];
    const lastCandidate = bundle.candidates[bundle.candidates.length - 1];

    // Determine failure class from signals
    const failureClass = this.inferFailureClass(bundle, lastAttempt, lastCandidate);

    switch (failureClass) {
      case 'generator-weakness':
        return {
          taskId,
          failureClass,
          action: 'retry-different-temp',
          rationale: `Low score (${lastAttempt?.finalScore ?? 0}) suggests weak LLM output.`,
          suggestedChanges: [
            'Increase temperature by 0.2',
            'Switch to a higher-capability model for this task class',
            'Add more specific examples in the task description',
          ],
        };
      case 'verifier-opacity':
        return {
          taskId,
          failureClass,
          action: 'respec',
          rationale: 'Scoring criteria may be too vague for the verifier to distinguish good from bad output.',
          suggestedChanges: [
            'Add concrete expected values to scoring criteria',
            'Include example inputs and outputs in the description',
            'Reduce the scope of the task to something more testable',
          ],
        };
      case 'task-spec-issue':
        return {
          taskId,
          failureClass,
          action: 'respec',
          rationale: `Score was reasonable (${lastCandidate?.semanticScore ?? 0}) but tests failed — task spec may be misaligned.`,
          suggestedChanges: [
            'Review the verify command for correctness',
            'Check if the file allowlist covers all needed files',
            'Clarify the expected behavior in the description',
          ],
        };
      case 'harness-issue':
        return {
          taskId,
          failureClass,
          action: 'fix-harness',
          rationale: 'The harness (TaskRunner/TaskVerifier) encountered an error.',
          suggestedChanges: [
            'Check TaskRunner and TaskVerifier logs for errors',
            'Verify the verify command is valid',
            'Ensure the task file paths exist',
          ],
        };
      case 'provider-issue':
        return {
          taskId,
          failureClass,
          action: 'fallback-provider',
          rationale: 'LLM provider timeout or rate limit.',
          suggestedChanges: [
            'Retry with a different provider',
            'Add exponential backoff between retries',
            'Reduce the task complexity to fit within token limits',
          ],
        };
    }
  }

  /** Infer failure class from the bundle evidence. */
  private inferFailureClass(
    bundle: ReplayBundleData,
    lastAttempt: ReplayBundleData['attempts'][number] | undefined,
    lastCandidate: ReplayBundleData['candidates'][number] | undefined,
  ): FailureClass {
    if (!lastAttempt) return 'harness-issue';

    // Provider issues
    if (lastAttempt.reason.includes('timeout') || lastAttempt.reason.includes('rate') || lastAttempt.reason.includes('429')) {
      return 'provider-issue';
    }

    // Harness issues
    if (lastAttempt.reason.includes('harness') || lastAttempt.reason.includes('verify')) {
      return 'harness-issue';
    }

    // Task spec issues — reasonable score but tests fail
    if (lastCandidate && lastCandidate.semanticScore >= 0.5 && !lastCandidate.testPassed) {
      return 'task-spec-issue';
    }

    // Generator weakness — low score after multiple attempts
    if (lastAttempt.finalScore < 0.3 && bundle.attempts.length > 1) {
      return 'generator-weakness';
    }

    // Verifier opacity — can't tell good from bad
    return 'verifier-opacity';
  }
}
