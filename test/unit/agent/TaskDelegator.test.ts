import { describe, it, expect, vi } from 'vitest';
import { TaskDelegator } from '../../../src/agent/TaskDelegator.js';

describe('TaskDelegator', () => {
  const mockExecutor: TaskExecutor = async (description, _signal) => ({
    content: `Result for: ${description}`,
    success: true,
    steps: 3,
    toolsUsed: ['runFocusedTests'],
    model: 'test-model',
  });

  it('executes a task and returns an EngineeringResult', async () => {
    const delegator = new TaskDelegator(mockExecutor);
    const result = await delegator.execute('fix the auth bug');
    expect(result.content).toBe('Result for: fix the auth bug');
    expect(result.model).toBe('test-model');
  });

  it('includes a task reference in the result', async () => {
    const delegator = new TaskDelegator(mockExecutor);
    const result = await delegator.execute('do something');
    expect(result.taskRefs).toHaveLength(1);
    expect(result.taskRefs[0]).toMatch(/^T-\d+-1$/);
  });

  it('increments task IDs across multiple executions', async () => {
    const delegator = new TaskDelegator(mockExecutor);
    const r1 = await delegator.execute('task a');
    const r2 = await delegator.execute('task b');
    expect(r1.taskRefs[0]).toMatch(/-1$/);
    expect(r2.taskRefs[0]).toMatch(/-2$/);
  });

  it('passes the description to the executor', async () => {
    const executor = vi.fn().mockResolvedValue({ content: 'done', success: true });
    const delegator = new TaskDelegator(executor as any);
    await delegator.execute('build the module');
    expect(executor).toHaveBeenCalledWith('build the module', undefined);
  });

  it('passes an abort signal to the executor', async () => {
    const executor = vi.fn().mockResolvedValue({ content: 'done', success: true });
    const delegator = new TaskDelegator(executor as any);
    const controller = new AbortController();
    await delegator.execute('task', controller.signal);
    expect(executor).toHaveBeenCalledWith('task', controller.signal);
  });

  it('propagates executor failures', async () => {
    const failingExecutor: TaskExecutor = async () => {
      throw new Error('executor crashed');
    };
    const delegator = new TaskDelegator(failingExecutor);
    await expect(delegator.execute('boom')).rejects.toThrow('executor crashed');
  });

  it('returns empty model when executor does not provide one', async () => {
    const noModelExecutor: TaskExecutor = async (desc) => ({
      content: desc,
      success: true,
    });
    const delegator = new TaskDelegator(noModelExecutor);
    const result = await delegator.execute('task');
    expect(result.model).toBeUndefined();
  });
});
