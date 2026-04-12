import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecuteTask, mockCreateLLMModeAgent } = vi.hoisted(() => {
  const executeTask = vi.fn();
  return {
    mockExecuteTask: executeTask,
    mockCreateLLMModeAgent: vi.fn(() => ({ executeTask })),
  };
});

vi.mock('../../../src/harness/agent/index.js', () => ({
  createLLMModeAgent: mockCreateLLMModeAgent,
}));

import { LLMModeSelfImprovementRuntime } from '../../../src/runtime-core/SelfImprovementRuntime.js';

describe('LLMModeSelfImprovementRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs self-improvement requests with the bounded runtime task policy', async () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = {
      getConfig: vi.fn(() => ({ model: 'glm-5.1' })),
    } as any;
    const session = {
      status: 'success',
      startTime: '2026-04-11T18:00:00.000Z',
      endTime: '2026-04-11T18:00:01.000Z',
      stepCount: 2,
    } as any;

    mockExecuteTask.mockResolvedValue(session);

    const result = await runtime.run({
      llm,
      description: 'Fix the Bubble Tea runtime lane',
    });

    expect(mockCreateLLMModeAgent).toHaveBeenCalledWith(llm);
    expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^tui-self-/),
      title: 'Bubble Tea TUI self-improvement request',
      description: expect.stringContaining('Fix the Bubble Tea runtime lane'),
      fileHint: 'src/runtime-core/SelfImprovementRuntime.ts',
      workingSet: [
        'src/runtime-core/SelfImprovementRuntime.ts',
        'src/harness/agent/LLMModeAgent.ts',
        'src/harness/RunStateStore.ts',
        'test/unit/LLMModeAgent.test.ts',
      ],
      domain: 'runtime-core',
      maxSteps: 20,
      approved: true,
      completionPolicy: 'stop_after_verification',
    }));
    expect(result).toEqual({
      modelName: 'glm-5.1',
      maxSteps: 20,
      session,
      taskId: expect.stringMatching(/^tui-self-/),
    });
    expect(mockExecuteTask).toHaveBeenCalledWith(result.session ? expect.objectContaining({
      id: result.taskId,
      maxSteps: result.maxSteps,
    }) : expect.anything());
  });

  it('preloads checkpoint/resume runs with a deterministic working set', async () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;
    const session = {
      status: 'success',
      startTime: '2026-04-11T18:00:00.000Z',
      endTime: '2026-04-11T18:00:01.000Z',
      stepCount: 1,
    } as any;
    mockExecuteTask.mockResolvedValue(session);

    await runtime.run({
      llm,
      description: 'Add a checkpoint resume proof for workspace fingerprint drift',
    });

    expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
      fileHint: 'src/harness/RunStateStore.ts',
      workingSet: [
        'src/harness/RunStateStore.ts',
        'src/harness/agent/LLMModeAgent.ts',
        'test/unit/LLMModeAgent.test.ts',
        'test/harness/RunStateStore.test.ts',
      ],
      domain: 'runstate',
      description: expect.stringContaining('Deterministic Task Packet'),
    }));
    const task = mockExecuteTask.mock.calls[0][0];
    expect(task.description).toContain('src/harness/agent/LLMModeAgent.ts');
    expect(task.description).toContain('test/harness/RunStateStore.test.ts');
  });

  it('prepares repeatable bounded checkpoint-resume task packets for the same description', async () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;
    const session = {
      status: 'success',
      startTime: '2026-04-11T18:00:00.000Z',
      endTime: '2026-04-11T18:00:01.000Z',
      stepCount: 1,
    } as any;
    mockExecuteTask.mockResolvedValue(session);

    const description = 'Resume checkpoint state after workspace fingerprint drift';
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_775_960_625_337)
      .mockReturnValueOnce(1_775_960_625_338);
    const first = runtime.prepare({ llm, description });
    const second = runtime.prepare({ llm, description });

    expect(mockCreateLLMModeAgent).not.toHaveBeenCalled();

    await first.execute();
    await second.execute();

    const firstTask = mockExecuteTask.mock.calls[0][0];
    const secondTask = mockExecuteTask.mock.calls[1][0];

    expect(firstTask.id).not.toBe(secondTask.id);
    expect(firstTask).toEqual(expect.objectContaining({
      fileHint: 'src/harness/RunStateStore.ts',
      maxSteps: 20,
      approved: true,
      completionPolicy: 'stop_after_verification',
    }));
    expect(secondTask).toEqual(expect.objectContaining({
      fileHint: 'src/harness/RunStateStore.ts',
      maxSteps: 20,
      approved: true,
      completionPolicy: 'stop_after_verification',
    }));
    expect({ ...firstTask, id: 'stable-id' }).toEqual({ ...secondTask, id: 'stable-id' });
  });

  it('prepares a concrete bounded runtime task packet once and reuses it for execution', async () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;
    const session = {
      status: 'success',
      startTime: '2026-04-11T18:00:00.000Z',
      endTime: '2026-04-11T18:00:01.000Z',
      stepCount: 1,
    } as any;
    mockExecuteTask.mockResolvedValue(session);

    const originalMaxSteps = process.env.LIMINAL_TUI_AGENT_MAX_STEPS;
    process.env.LIMINAL_TUI_AGENT_MAX_STEPS = '7';
    vi.spyOn(Date, 'now').mockReturnValue(1_775_960_700_000);

    try {
      const prepared = runtime.prepare({
        llm,
        description: 'Fix checkpoint resume handoff behavior',
      });

      expect(prepared.task).toEqual(expect.objectContaining({
        id: 'tui-self-1775960700000',
        title: 'Bubble Tea TUI self-improvement request',
        description: expect.stringContaining('Fix checkpoint resume handoff behavior'),
        fileHint: 'src/harness/RunStateStore.ts',
        workingSet: [
          'src/harness/RunStateStore.ts',
          'src/harness/agent/LLMModeAgent.ts',
          'test/unit/LLMModeAgent.test.ts',
          'test/harness/RunStateStore.test.ts',
        ],
        domain: 'runstate',
        maxSteps: 7,
        approved: true,
        completionPolicy: 'stop_after_verification',
      }));
      expect(prepared.maxSteps).toBe(7);

      process.env.LIMINAL_TUI_AGENT_MAX_STEPS = '99';
      await prepared.execute();

      expect(mockExecuteTask).toHaveBeenCalledWith(prepared.task);
      expect(prepared.task.maxSteps).toBe(7);
    } finally {
      if (originalMaxSteps === undefined) {
        delete process.env.LIMINAL_TUI_AGENT_MAX_STEPS;
      } else {
        process.env.LIMINAL_TUI_AGENT_MAX_STEPS = originalMaxSteps;
      }
    }
  });
});
