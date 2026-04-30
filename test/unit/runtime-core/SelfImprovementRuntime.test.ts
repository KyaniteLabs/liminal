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
import { Status } from '../../../src/types/status.js';

describe('LLMModeSelfImprovementRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves bounded packet contracts across runtime-core and runstate preparations', () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;
    const cases = [
      {
        description: 'Tighten the bounded runtime-core self-improvement facade',
        expectedDomain: 'runtime-core',
      },
      {
        description: 'Resume checkpoint state after WORKSPACE fingerprint drift',
        expectedDomain: 'runstate',
      },
    ] as const;

    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_775_960_625_337)
      .mockReturnValueOnce(1_775_960_625_338)
      .mockReturnValueOnce(1_775_960_625_339);

    for (const testCase of cases) {
      const prepared = runtime.prepare({ llm, description: testCase.description });
      expect(prepared.task.fileHint).toBe(prepared.task.primaryFiles?.[0]);
      expect(prepared.task.workingSet).toEqual([
        ...(prepared.task.primaryFiles || []),
        ...(prepared.task.secondaryFiles || []),
      ]);
      expect(new Set(prepared.task.workingSet || []).size).toBe(prepared.task.workingSet?.length);
      expect(prepared.task.domain).toBe(testCase.expectedDomain);
      expect((prepared.task.secondaryFiles || []).length).toBeLessThanOrEqual(prepared.task.expansionBudget || 0);
      expect(prepared.task.expansionStatus).toBe(((prepared.task.deferredSecondaryFiles || []).length > 0) ? 'allowed' : 'exhausted');
      expect(prepared.task.verificationTargets?.length).toBeGreaterThan(0);
      expect(prepared.task.verificationTargets?.[0].priority).toBe(1);
      expect(prepared.task.description).toContain('## Deterministic Task Packet');
      expect(prepared.task.description).toContain(`Primary files:\n- ${(prepared.task.primaryFiles || []).join('\n- ')}`);
      expect(prepared.task.description).toContain(`Secondary files:\n- ${(prepared.task.secondaryFiles || []).join('\n- ')}`);
      expect(prepared.task.description).toContain(`Verification targets:\n- ${(prepared.task.verificationTargets || []).map((target) => `${target.tool}${target.pattern ? ` (${target.pattern})` : ''}: ${target.reason}`).join('\n- ')}`);
      expect(prepared.task.description).toContain(`Preferred verification targets after a mutation:\n- ${(prepared.task.verificationTargets || []).map((target) => `${target.tool}${target.pattern ? ` (${target.pattern})` : ''}: ${target.reason}`).join('\n- ')}`);
      expect(prepared.task.description).toContain(`Expansion budget: ${prepared.task.expansionBudget} additional files before broadening beyond this packet`);
      expect(prepared.task.description).toContain(`Expansion status: ${prepared.task.expansionStatus}`);
      expect(prepared.task.description).toContain(`Localization confidence: ${prepared.task.localizationConfidence}`);
      expect(prepared.task.description).toContain(`Domain: ${prepared.task.domain}`);
      expect(prepared.task.description).toContain(`Hint: ${prepared.task.fileHint}`);
      expect(prepared.task.description).toContain(`Current active focus file: ${prepared.task.fileHint}`);
      expect(prepared.task.description).toContain('Your first explicit tool call should stay on the current active focus file unless you are editing or verifying.');
      expect(prepared.task.description).toContain(`Do not jump to ${(prepared.task.primaryFiles || [])[1]} until you finish the current focus or explicitly reject it.`);
      expect(prepared.task.description).toContain('If readFile returns truncated=true with startLine/endLine, continue that file with offset=endLine rather than rereading from the top.');
      expect(prepared.task.description).toContain('If you need a specific method, symbol, or error location inside a large file, use search with the current file path before reading more pages.');
    }
  });

  it('runs self-improvement requests with the bounded runtime task policy', async () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = {
      getConfig: vi.fn(() => ({ model: 'glm-5.1' })),
    } as any;
    const session = {
      status: Status.SUCCESS,
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
      lifecycle: expect.objectContaining({
        status: Status.SUCCESS,
        category: 'succeeded',
        succeeded: true,
        resumable: false,
      }),
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

  it('prepares RepoIndexLite-first packets for localization-focused bounded-runtime work', async () => {
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
      description: 'Tighten RepoIndexLite task packet shaping and expansion budget determinism',
    });

    expect(mockExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
      fileHint: 'src/runtime-core/RepoIndexLite.ts',
      primaryFiles: [
        'src/runtime-core/RepoIndexLite.ts',
        'src/runtime-core/SelfImprovementRuntime.ts',
      ],
      secondaryFiles: [
        'test/unit/runtime-core/RepoIndexLite.test.ts',
        'test/unit/runtime-core/SelfImprovementRuntime.test.ts',
      ],
      deferredSecondaryFiles: [
        'src/harness/agent/LLMModeAgent.ts',
      ],
      expansionBudget: 2,
      expansionStatus: 'allowed',
      localizationConfidence: 'high',
      verificationTargets: [
        {
          tool: 'runFocusedTests',
          pattern: 'RepoIndexLite',
          reason: 'RepoIndexLite packet-shaping changes should hit focused runtime tests first',
          priority: 1,
        },
        {
          tool: 'runBuild',
          reason: 'Full TypeScript build after packet-shaping edits',
          priority: 2,
        },
      ],
      domain: 'runtime-core',
    }));
    const task = mockExecuteTask.mock.calls[0][0];
    expect(task.workingSet).toEqual([...task.primaryFiles, ...task.secondaryFiles]);
    expect(task.workingSet).not.toContain('src/harness/agent/LLMModeAgent.ts');
    expect(task.description).toContain('Deferred secondary files:');
    expect(task.description).toContain('Expansion status: allowed');
    expect(task.description).toContain('Localization confidence: high');
    expect(task.description).toContain('Expansion budget: 2 additional files before broadening beyond this packet');
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
    expect(firstTask.expansionBudget).toBe(firstTask.secondaryFiles.length);
    expect(secondTask.expansionBudget).toBe(secondTask.secondaryFiles.length);
    expect(firstTask.expansionStatus).toBe('exhausted');
    expect(secondTask.expansionStatus).toBe('exhausted');
    expect(firstTask.workingSet).toEqual([...firstTask.primaryFiles, ...firstTask.secondaryFiles]);
    expect(secondTask.workingSet).toEqual([...secondTask.primaryFiles, ...secondTask.secondaryFiles]);
    expect({ ...firstTask, id: 'stable-id' }).toEqual({ ...secondTask, id: 'stable-id' });
  });

  it('prepares repeatable bounded runtime-core task packets for the same description', () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;
    const description = 'Tighten the bounded runtime-core self-improvement facade';

    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_775_960_800_000)
      .mockReturnValueOnce(1_775_960_800_001);

    const first = runtime.prepare({ llm, description });
    const second = runtime.prepare({ llm, description });

    expect(first.task.domain).toBe('runtime-core');
    expect(second.task.domain).toBe('runtime-core');
    expect(first.task.id).not.toBe(second.task.id);
    expect(first.task.expansionBudget).toBe(2);
    expect(second.task.expansionBudget).toBe(2);
    expect(first.task.expansionStatus).toBe('exhausted');
    expect(second.task.expansionStatus).toBe('exhausted');
    expect(first.task.workingSet).toEqual([
      ...(first.task.primaryFiles || []),
      ...(first.task.secondaryFiles || []),
    ]);
    expect(second.task.workingSet).toEqual([
      ...(second.task.primaryFiles || []),
      ...(second.task.secondaryFiles || []),
    ]);
    expect({ ...first.task, id: 'stable-id' }).toEqual({ ...second.task, id: 'stable-id' });
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
        primaryFiles: [
          'src/harness/RunStateStore.ts',
          'src/harness/agent/LLMModeAgent.ts',
        ],
        secondaryFiles: [
          'test/unit/LLMModeAgent.test.ts',
          'test/harness/RunStateStore.test.ts',
        ],
        deferredSecondaryFiles: [],
        expansionBudget: 2,
        expansionStatus: 'exhausted',
        localizationConfidence: 'high',
        verificationTargets: [
          {
            tool: 'runTests',
            pattern: 'LLMModeAgent|RunStateStore',
            reason: 'Checkpoint/resume regressions should hit focused runtime tests first',
            priority: 1,
          },
          {
            tool: 'runBuild',
            reason: 'Full TypeScript build after resume/checkpoint changes',
            priority: 2,
          },
        ],
        domain: 'runstate',
        maxSteps: 7,
        approved: true,
        completionPolicy: 'stop_after_verification',
      }));
      expect(prepared.maxSteps).toBe(7);
      expect(prepared.task.description).toContain('Primary files:');
      expect(prepared.task.description).toContain('Secondary files:');
      expect(prepared.task.description).toContain('Verification targets:');
      expect(prepared.task.description).toContain('Preferred verification targets after a mutation:');
      expect(prepared.task.description).toContain('Expansion status: exhausted');
      expect(prepared.task.description).toContain('Expansion budget: 2 additional files before broadening beyond this packet');
      expect(prepared.task.description).toContain('Localization confidence: high');
      expect(prepared.task.description).toContain(`Hint: ${prepared.task.fileHint}`);
      expect(prepared.task.description).toContain(`Current active focus file: ${prepared.task.fileHint}`);
      expect(prepared.task.description).toContain('Your first explicit tool call should stay on the current active focus file unless you are editing or verifying.');
      expect(prepared.task.description).toContain('Preferred verification targets after a mutation:');

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

  it('falls back to the default max steps when the env override is invalid', () => {
    const runtime = new LLMModeSelfImprovementRuntime();
    const llm = { getConfig: vi.fn(() => ({ model: 'glm-5.1' })) } as any;

    const originalMaxSteps = process.env.LIMINAL_TUI_AGENT_MAX_STEPS;
    process.env.LIMINAL_TUI_AGENT_MAX_STEPS = 'not-a-number';

    try {
      const prepared = runtime.prepare({
        llm,
        description: 'Improve Bubble Tea self-improvement startup and convergence',
      });

      expect(prepared.maxSteps).toBe(20);
      expect(prepared.task.maxSteps).toBe(20);
    } finally {
      if (originalMaxSteps === undefined) {
        delete process.env.LIMINAL_TUI_AGENT_MAX_STEPS;
      } else {
        process.env.LIMINAL_TUI_AGENT_MAX_STEPS = originalMaxSteps;
      }
    }
  });
});
