import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSoulMock } = vi.hoisted(() => ({
  loadSoulMock: vi.fn(async () => 'safe soul'),
}));

vi.mock('../../src/tui/IntentRouter.js', () => ({
  loadSoul: loadSoulMock,
}));

import { NaturalInterface } from '../../src/tui/NaturalInterface.js';
import { commands } from '../../src/tui/commands.js';
import type { AgentTask } from '../../src/harness/index.js';

describe('confirm flow', () => {
  const onStatus = vi.fn();
  const onLog = vi.fn();
  const harnessExecuteTask = vi.fn();
  const llmExecuteTask = vi.fn();
  const llmComplete = vi.fn();

  const baseTask: AgentTask = {
    id: 'M1',
    title: 'Fix task',
    description: 'Apply a fix',
    targetFile: 'src/file.ts',
    approved: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    harnessExecuteTask.mockResolvedValue({ status: 'success' });
    llmExecuteTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
    llmComplete.mockResolvedValue({ success: true, text: 'PASS' });
  });

  it('queues natural-language agent requests instead of executing immediately', async () => {
    const ni = new NaturalInterface({
      harnessAgent: { executeTask: harnessExecuteTask } as any,
      llmAgent: { executeTask: llmExecuteTask } as any,
      llmClient: { complete: llmComplete, getConfig: () => ({ model: 'test-model' }) } as any,
      tasks: [],
      onStatus,
      onLog,
    });

    const result = await ni.processInput('Fix the validation logic');

    expect(result.response).toMatch(/awaiting approval/i);
    expect(result.response).toMatch(/\/confirm/i);
    expect(llmExecuteTask).not.toHaveBeenCalled();
    expect(ni.getPendingActions()).toHaveLength(1);
  });

  it('confirms a queued natural-language action and executes it with approval', async () => {
    const ni = new NaturalInterface({
      harnessAgent: { executeTask: harnessExecuteTask } as any,
      llmAgent: { executeTask: llmExecuteTask } as any,
      llmClient: { complete: llmComplete, getConfig: () => ({ model: 'test-model' }) } as any,
      tasks: [],
      onStatus,
      onLog,
    });

    await ni.processInput('Fix the validation logic');
    const [pending] = ni.getPendingActions();

    const result = await ni.processInput(`/confirm ${pending.id}`);

    expect(result.response).toMatch(/task success/i);
    expect(llmExecuteTask).toHaveBeenCalledWith(expect.objectContaining({ approved: true }));
    expect(ni.getPendingActions()).toHaveLength(0);
  });

  it('queues /run requests instead of executing structured tasks immediately', async () => {
    const ni = new NaturalInterface({
      harnessAgent: { executeTask: harnessExecuteTask } as any,
      llmAgent: { executeTask: llmExecuteTask } as any,
      llmClient: { complete: llmComplete, getConfig: () => ({ model: 'test-model' }) } as any,
      tasks: [baseTask],
      onStatus,
      onLog,
    });

    const result = await ni.processInput('/run M1');

    expect(result.response).toMatch(/awaiting approval/i);
    expect(harnessExecuteTask).not.toHaveBeenCalled();
    expect(ni.getPendingActions()).toHaveLength(1);
  });

  it('cancels a queued structured action without executing it', async () => {
    const ni = new NaturalInterface({
      harnessAgent: { executeTask: harnessExecuteTask } as any,
      llmAgent: { executeTask: llmExecuteTask } as any,
      llmClient: { complete: llmComplete, getConfig: () => ({ model: 'test-model' }) } as any,
      tasks: [baseTask],
      onStatus,
      onLog,
    });

    await ni.processInput('/run M1');
    const [pending] = ni.getPendingActions();

    const result = await ni.processInput(`/cancel ${pending.id}`);

    expect(result.response).toMatch(/cancelled/i);
    expect(harnessExecuteTask).not.toHaveBeenCalled();
    expect(ni.getPendingActions()).toHaveLength(0);
  });

  it('commands.run creates a pending action instead of executing immediately', async () => {
    const createPendingAction = vi.fn(() => ({ id: 'pending-1' }));

    const result = await commands.run.execute(['M1'], {
      agent: { executeTask: harnessExecuteTask } as any,
      tasks: [baseTask],
      logs: [],
      addLog: vi.fn(),
      setStatusMessage: vi.fn(),
      addOutput: vi.fn(),
      createPendingAction,
      confirmPendingAction: vi.fn(),
      cancelPendingAction: vi.fn(),
    } as any);

    expect(result).toMatch(/awaiting approval/i);
    expect(createPendingAction).toHaveBeenCalled();
    expect(harnessExecuteTask).not.toHaveBeenCalled();
  });

  it('commands.cancel cancels a pending action', async () => {
    const cancelPendingAction = vi.fn(() => true);

    const result = await commands.cancel.execute(['pending-1'], {
      agent: { executeTask: harnessExecuteTask } as any,
      tasks: [baseTask],
      logs: [],
      addLog: vi.fn(),
      setStatusMessage: vi.fn(),
      addOutput: vi.fn(),
      createPendingAction: vi.fn(),
      confirmPendingAction: vi.fn(),
      cancelPendingAction,
    } as any);

    expect(result).toMatch(/cancelled/i);
    expect(cancelPendingAction).toHaveBeenCalledWith('pending-1');
  });
});
