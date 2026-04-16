/**
 * TaskLedger — Core persistence layer for the Self-Hosting Task Ledger.
 *
 * Manages the full lifecycle of task manifests, attempts, candidates,
 * and decisions via LiminalFS manifests, refs, and artifacts.
 *
 * Storage layout:
 *   .liminal/manifests/task/<id>/manifest.json          — task manifest
 *   .liminal/manifests/task/<id>/attempt/<attempt-id>.json — attempt record
 *   .liminal/refs/task/<id>/attempt/<attempt-id>.json    — attempt ref
 *   .liminal/refs/task/<id>/candidate/<cand-id>.json     — candidate ref
 *   .liminal/manifests/task/<id>/decision/<dec-id>.json  — decision record
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { LiminalFS } from '../fs/LiminalFS.js';
import type {
  TaskManifest,
  TaskAttempt,
  TaskCandidate,
  TaskDecision,
  TaskStatus,
} from './types.js';

const TASK_PREFIX = 'task';

export class TaskLedger {
  constructor(private fs: LiminalFS) {}

  // ─── Task CRUD ─────────────────────────────────────────────────

  /**
   * Create a new task from a partial definition.
   * Auto-fills status, attemptCount, and timestamps.
   */
  createTask(def: Omit<TaskManifest, 'attemptCount' | 'createdAt' | 'updatedAt' | 'status'>): TaskManifest {
    const now = new Date().toISOString();
    const task: TaskManifest = {
      ...def,
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.fs.writeManifest(`${TASK_PREFIX}/${task.id}/manifest`, task as unknown as Record<string, unknown>);
    return task;
  }

  /** Load a task manifest by ID. Returns null if not found. */
  loadTask(taskId: string): TaskManifest | null {
    const data = this.fs.readManifest(`${TASK_PREFIX}/${taskId}/manifest`);
    return data as unknown as TaskManifest | null;
  }

  /** List all tasks, optionally filtered by lane or status. */
  listTasks(filter?: { lane?: number; status?: TaskStatus }): TaskManifest[] {
    const manifestsDir = join(this.fs.getProjectRoot(), '.liminal', 'manifests', TASK_PREFIX);
    if (!existsSync(manifestsDir)) {
      return [];
    }

    const entries = readdirSync(manifestsDir, { withFileTypes: true });
    const tasks: TaskManifest[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const data = this.fs.readManifest(`${TASK_PREFIX}/${entry.name}/manifest`);
      if (!data) continue;

      const task = data as unknown as TaskManifest;

      if (filter?.lane !== undefined && task.lane !== filter.lane) continue;
      if (filter?.status !== undefined && task.status !== filter.status) continue;

      tasks.push(task);
    }

    return tasks;
  }

  /** Update a task's status. Reads, mutates, and writes back. */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.loadTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.fs.writeManifest(`${TASK_PREFIX}/${taskId}/manifest`, task as unknown as Record<string, unknown>);
  }

  // ─── Attempt Recording ─────────────────────────────────────────

  /** Record an attempt. Stores both a manifest and a ref. */
  recordAttempt(attempt: TaskAttempt): void {
    // Write the attempt data as a manifest
    this.fs.writeManifest(
      `${TASK_PREFIX}/${attempt.taskId}/attempt/${attempt.id}`,
      attempt as unknown as Record<string, unknown>,
    );

    // Write a ref pointing to the attempt (for discoverability)
    this.fs.writeRef(`${TASK_PREFIX}/${attempt.taskId}/attempt/${attempt.id}`, {
      uri: `liminal://task/${attempt.taskId}/attempt/${attempt.id}`,
      kind: 'run',
    });

    // Increment attempt count on the task
    const task = this.loadTask(attempt.taskId);
    if (task) {
      task.attemptCount += 1;
      task.updatedAt = new Date().toISOString();
      if (task.status === 'pending') {
        task.status = 'in-progress';
      }
      this.fs.writeManifest(`${TASK_PREFIX}/${attempt.taskId}/manifest`, task as unknown as Record<string, unknown>);
    }
  }

  /** Load all attempts for a task, ordered by start time. */
  loadAttempts(taskId: string): TaskAttempt[] {
    const attemptsDir = join(this.fs.getProjectRoot(), '.liminal', 'manifests', TASK_PREFIX, taskId, 'attempt');
    if (!existsSync(attemptsDir)) {
      return [];
    }

    const entries = readdirSync(attemptsDir)
      .filter(f => f.endsWith('.json'));

    const attempts: TaskAttempt[] = [];
    for (const entry of entries) {
      const attemptId = entry.replace('.json', '');
      const data = this.fs.readManifest(`${TASK_PREFIX}/${taskId}/attempt/${attemptId}`);
      if (data) {
        attempts.push(data as unknown as TaskAttempt);
      }
    }

    return attempts.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  // ─── Candidate Recording ───────────────────────────────────────

  /** Record a candidate. Stores code as an artifact, metadata as a manifest, and a ref for discoverability. */
  recordCandidate(candidate: TaskCandidate): void {
    // Store the candidate code as an artifact
    const artifactRef = this.fs.writeArtifact({
      kind: 'task-candidate',
      content: candidate.code,
      filename: `candidate-${candidate.id}.txt`,
      metadata: {
        taskId: candidate.taskId,
        attemptId: candidate.attemptId,
      },
    });

    // Store candidate metadata as a manifest (scores, test result)
    this.fs.writeManifest(
      `${TASK_PREFIX}/${candidate.taskId}/candidate/${candidate.id}`,
      {
        ...candidate,
        artifactUri: artifactRef.uri,
        artifactHash: artifactRef.hash,
      },
    );

    // Write a ref for discoverability
    this.fs.writeRef(`${TASK_PREFIX}/${candidate.taskId}/candidate/${candidate.id}`, artifactRef);
  }

  /** Load all candidates for a task. Reads from manifests (which contain metadata). */
  loadCandidates(taskId: string): TaskCandidate[] {
    const candidatesDir = join(this.fs.getProjectRoot(), '.liminal', 'manifests', TASK_PREFIX, taskId, 'candidate');
    if (!existsSync(candidatesDir)) {
      return [];
    }

    const entries = readdirSync(candidatesDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    const candidates: TaskCandidate[] = [];
    for (const entry of entries) {
      const candidateId = entry.replace('.json', '');
      const data = this.fs.readManifest(`${TASK_PREFIX}/${taskId}/candidate/${candidateId}`);
      if (data) {
        const d = data as Record<string, unknown>;
        candidates.push({
          id: (d.id as string) ?? candidateId,
          taskId: (d.taskId as string) ?? taskId,
          attemptId: (d.attemptId as string) ?? '',
          code: (d.code as string) ?? '',
          semanticScore: (d.semanticScore as number) ?? 0,
          testPassed: (d.testPassed as boolean) ?? false,
          evaluatedAt: (d.evaluatedAt as string) ?? '',
        });
      }
    }

    return candidates;
  }

  // ─── Decision Recording ────────────────────────────────────────

  /** Record an acceptance or rejection decision. */
  recordDecision(decision: TaskDecision): void {
    this.fs.writeManifest(
      `${TASK_PREFIX}/${decision.taskId}/decision/${decision.id}`,
      decision as unknown as Record<string, unknown>,
    );

    // Update task status based on decision
    if (decision.decision === 'accepted') {
      this.updateTaskStatus(decision.taskId, 'completed');
    }
  }

  /** Load the latest decision for a task. */
  loadLatestDecision(taskId: string): TaskDecision | null {
    const decisionsDir = join(this.fs.getProjectRoot(), '.liminal', 'manifests', TASK_PREFIX, taskId, 'decision');
    if (!existsSync(decisionsDir)) {
      return null;
    }

    const entries = readdirSync(decisionsDir)
      .filter(f => f.endsWith('.json'));

    if (entries.length === 0) return null;

    // Sort by decidedAt timestamp, not filename
    const decisions: TaskDecision[] = [];
    for (const entry of entries) {
      const decisionId = entry.replace('.json', '');
      const data = this.fs.readManifest(`${TASK_PREFIX}/${taskId}/decision/${decisionId}`);
      if (data) {
        decisions.push(data as unknown as TaskDecision);
      }
    }

    if (decisions.length === 0) return null;

    decisions.sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
    return decisions[decisions.length - 1];
  }
}
