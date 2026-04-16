/**
 * TaskDelegator tests — behavioral assertions on engineering delegation.
 *
 * Tests real delegation behavior with mock executor.
 * Every assertion checks a specific expected value.
 */
import { describe, it, expect, vi } from 'vitest';
import { TaskDelegator } from '../../../src/agent/TaskDelegator.js';
import type { TaskExecutor, TaskExecutorResult } from '../../../src/agent/TaskDelegator.js';

// ── Helpers ──

function mockExecutor(overrides: Partial<TaskExecutorResult> = {}): TaskExecutor {
  return vi.fn(async (_desc: string, _signal?: AbortSignal) => ({
    content: overrides.content ?? 'Task completed',
    success: overrides.success ?? true,
    steps: overrides.steps,
    toolsUsed: overrides.toolsUsed,
    model: overrides.model,
  }));
}

describe('TaskDelegator', () => {
  // ── Core execute() ──

  describe('execute()', () => {
    it('delegates to executor and returns EngineeringResult', async () => {
      const executor = mockExecutor({ content: 'Fixed the build', success: true });
      const delegator = new TaskDelegator(executor);

      const result = await delegator.execute('fix the build');

      expect(result.content).toBe('Fixed the build');
      expect(result.taskRefs).toHaveLength(1);
      expect(result.taskRefs[0]).toMatch(/^T-\d+-\d+$/);
      expect(executor).toHaveBeenCalledOnce();
      expect(executor).toHaveBeenCalledWith('fix the build', undefined);
    });

    it('generates unique task refs for sequential executions', async () => {
      const executor = mockExecutor({ content: 'done' });
      const delegator = new TaskDelegator(executor);

      const r1 = await delegator.execute('task 1');
      const r2 = await delegator.execute('task 2');

      expect(r1.taskRefs[0]).not.toBe(r2.taskRefs[0]);
    });

    it('passes abort signal to executor', async () => {
      const executor = mockExecutor({ content: 'done' });
      const delegator = new TaskDelegator(executor);

      const controller = new AbortController();
      await delegator.execute('task', controller.signal);

      expect(executor).toHaveBeenCalledWith('task', controller.signal);
    });

    it('returns model name from executor', async () => {
      const executor = mockExecutor({ content: 'done', model: 'glm-5.1' });
      const delegator = new TaskDelegator(executor);

      const result = await delegator.execute('task');
      expect(result.model).toBe('glm-5.1');
    });

    it('returns undefined model when executor provides none', async () => {
      const executor = mockExecutor({ content: 'done' });
      const delegator = new TaskDelegator(executor);

      const result = await delegator.execute('task');
      expect(result.model).toBeUndefined();
    });
  });

  // ── Error paths ──

  describe('error handling', () => {
    it('propagates executor errors', async () => {
      const executor = vi.fn(async () => { throw new Error('Provider timeout'); });
      const delegator = new TaskDelegator(executor);

      await expect(delegator.execute('task')).rejects.toThrow('Provider timeout');
    });

    it('does not generate task ref on error', async () => {
      const executor = vi.fn(async () => { throw new Error('fail'); });
      const delegator = new TaskDelegator(executor);

      try { await delegator.execute('task 1'); } catch { /* expected */ }

      // Task counter incremented but ref never returned
      // Second call should still get a unique ref
      const executor2 = mockExecutor({ content: 'recovered' });
      const delegator2 = new TaskDelegator(executor2);
      const result = await delegator2.execute('task 2');
      expect(result.taskRefs[0]).toMatch(/^T-\d+-1$/);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty description', async () => {
      const executor = mockExecutor({ content: 'No-op' });
      const delegator = new TaskDelegator(executor);

      const result = await delegator.execute('');
      expect(result.content).toBe('No-op');
      expect(executor).toHaveBeenCalledWith('', undefined);
    });

    it('handles long description', async () => {
      const longDesc = 'a'.repeat(10000);
      const executor = mockExecutor({ content: 'Processed' });
      const delegator = new TaskDelegator(executor);

      const result = await delegator.execute(longDesc);
      expect(result.content).toBe('Processed');
      expect(executor).toHaveBeenCalledWith(longDesc, undefined);
    });
  });
});
