/**
 * Unit tests for DreamQueue — Phase 15
 *
 * Tests priority queue with concurrency control.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DreamQueue } from '../../../src/dreaming/DreamQueue.js';

describe('DreamQueue', () => {
  let queue: DreamQueue;

  beforeEach(() => {
    queue = new DreamQueue({ maxConcurrent: 2, maxQueueSize: 10 });
  });

  it('enqueues and dequeues tasks by priority', () => {
    queue.enqueue('elite-x-compost', [], 0.3);
    queue.enqueue('elite-x-elite', [], 0.9);
    queue.enqueue('cross-modal', [], 0.5);

    const first = queue.dequeue();
    expect(first).not.toBeUndefined();
    expect(first!.strategy).toBe('elite-x-elite');
    expect(first!.priority).toBe(0.9);
  });

  it('respects maxConcurrent limit', () => {
    queue.enqueue('elite-x-elite', [], 0.9);
    queue.enqueue('cross-modal', [], 0.7);
    queue.enqueue('elite-x-compost', [], 0.5);

    const d1 = queue.dequeue();
    const d2 = queue.dequeue();
    expect(d1).not.toBeUndefined();
    expect(d2).not.toBeUndefined();
    // Third dequeue should return undefined (maxConcurrent = 2)
    const d3 = queue.dequeue();
    expect(d3).toBeUndefined();
  });

  it('complete marks a task as completed with result', () => {
    const taskId = queue.enqueue('elite-x-elite', [], 0.9);
    const task = queue.dequeue();
    expect(task).not.toBeUndefined();

    queue.complete(taskId, { candidateDescriptor: [0.5, 0.3], parentIds: ['a', 'b'] });
    const status = queue.getStatus();
    expect(status.completed).toBe(1);
    expect(status.running).toBe(0);
  });

  it('fail marks a task as failed', () => {
    const taskId = queue.enqueue('elite-x-compost', [], 0.3);
    queue.dequeue();
    queue.fail(taskId);

    const status = queue.getStatus();
    expect(status.failed).toBe(1);
  });

  it('getStatus returns queue metrics', () => {
    queue.enqueue('elite-x-elite', [], 0.9);
    queue.enqueue('cross-modal', [], 0.5);

    const status = queue.getStatus();
    expect(status.queued).toBe(2);
  });

  it('getTasks filters by status', () => {
    const t1 = queue.enqueue('elite-x-elite', [], 0.9);
    queue.dequeue();
    queue.complete(t1!, { candidateDescriptor: [], parentIds: [] });

    const completed = queue.getTasks('completed');
    expect(completed).toHaveLength(1);
  });

  it('prune removes completed and failed tasks', () => {
    const t1 = queue.enqueue('elite-x-elite', [], 0.9);
    queue.dequeue();
    queue.complete(t1!, { candidateDescriptor: [], parentIds: [] });

    const removed = queue.prune();
    expect(removed).toBe(1);
    const completed = queue.getTasks('completed');
    expect(completed).toHaveLength(0);
  });

  it('respects maxQueueSize', () => {
    const smallQueue = new DreamQueue({ maxConcurrent: 5, maxQueueSize: 2 });
    const t1 = smallQueue.enqueue('elite-x-elite', [], 0.9);
    const t2 = smallQueue.enqueue('cross-modal', [], 0.7);
    const t3 = smallQueue.enqueue('elite-x-compost', [], 0.3);
    expect(t3).toBeUndefined();
  });
});
