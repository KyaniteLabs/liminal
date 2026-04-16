/**
 * DreamQueue — Phase 15
 *
 * Manages a queue of dream tasks for off-policy recombination.
 * Dreams run as a distinct loop type — not regular generation requests.
 * Each dream task specifies a strategy, source artifacts, and priority.
 */

export type DreamStrategy =
  | 'elite-x-elite'
  | 'elite-x-compost'
  | 'distant-niche-x-distant'
  | 'cross-modal';

export interface DreamTask {
  id: string;
  strategy: DreamStrategy;
  /** Source artifacts for recombination */
  sources: Array<{ id: string; descriptor: number[]; quality: number }>;
  priority: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: {
    candidateDescriptor: number[];
    parentIds: string[];
  };
  enqueuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface DreamQueueConfig {
  /** Maximum concurrent dream tasks (default: 3) */
  maxConcurrent?: number;
  /** Maximum queue size (default: 50) */
  maxQueueSize?: number;
}

const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_MAX_QUEUE = 50;

export class DreamQueue {
  private readonly queue: DreamTask[] = [];
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private runningCount = 0;
  private taskIdCounter = 0;

  constructor(config: DreamQueueConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE;
  }

  /**
   * Enqueue a dream task. Returns the task ID or undefined if queue is full.
   */
  enqueue(
    strategy: DreamStrategy,
    sources: DreamTask['sources'],
    priority: number,
  ): string | undefined {
    if (this.queue.length >= this.maxQueueSize) return undefined;

    const id = `dream-${++this.taskIdCounter}-${Date.now()}`;
    const task: DreamTask = {
      id,
      strategy,
      sources,
      priority,
      status: 'queued',
      enqueuedAt: new Date().toISOString(),
    };

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
    return id;
  }

  /**
   * Dequeue the next runnable task (highest priority that fits concurrency).
   */
  dequeue(): DreamTask | undefined {
    if (this.runningCount >= this.maxConcurrent) return undefined;

    const task = this.queue.find(t => t.status === 'queued');
    if (!task) return undefined;

    task.status = 'running';
    task.startedAt = new Date().toISOString();
    this.runningCount++;
    return task;
  }

  /**
   * Mark a task as completed with its result.
   */
  complete(taskId: string, result: DreamTask['result']): void {
    const task = this.queue.find(t => t.id === taskId);
    if (!task || task.status !== 'running') return;

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;
    this.runningCount--;
  }

  /**
   * Mark a task as failed.
   */
  fail(taskId: string): void {
    const task = this.queue.find(t => t.id === taskId);
    if (!task || task.status !== 'running') return;

    task.status = 'failed';
    task.completedAt = new Date().toISOString();
    this.runningCount--;
  }

  /**
   * Get current queue status.
   */
  getStatus(): {
    queued: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const counts = { queued: 0, running: 0, completed: 0, failed: 0 };
    for (const task of this.queue) counts[task.status]++;
    return counts;
  }

  /**
   * Get all tasks, optionally filtered by status.
   */
  getTasks(status?: DreamTask['status']): DreamTask[] {
    if (status) return this.queue.filter(t => t.status === status);
    return [...this.queue];
  }

  /**
   * Remove completed/failed tasks from the queue.
   */
  prune(): number {
    const before = this.queue.length;
    const prunable = this.queue.filter(t => t.status === 'completed' || t.status === 'failed');
    for (const t of prunable) {
      const idx = this.queue.indexOf(t);
      if (idx >= 0) this.queue.splice(idx, 1);
    }
    return before - this.queue.length;
  }
}
