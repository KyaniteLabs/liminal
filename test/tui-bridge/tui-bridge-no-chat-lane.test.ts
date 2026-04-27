import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Status } from '../../src/types/status.js';

const { executeTask } = vi.hoisted(() => ({
  executeTask: vi.fn(async (task: { id: string; title: string }) => {
    const { eventBus, EventTypes } = await import('../../src/core/EventBus.js');
    eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
      process: 'agent-task',
      current: 1,
      total: 20,
      stage: 'planned gitStatus',
      message: 'gitStatus: Inspect repository state',
    });
    eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
      process: 'agent-task',
      current: 1,
      total: 20,
      stage: 'executed gitStatus',
      message: 'gitStatus succeeded',
    });
    eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
      process: 'agent-task',
      current: 2,
      total: 20,
      stage: 'executed runBuild',
      message: 'runBuild succeeded',
    });
    eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
      process: 'agent-task',
      current: 3,
      total: 20,
      stage: 'planned complete',
      message: 'complete: done',
    });
    return {
      task,
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCall: {
            tool: 'gitStatus',
            thought: 'Inspect the repository status',
            params: {},
            expectedResult: 'Git status summary',
          },
        },
        {
          role: 'tool',
          content: '',
          toolResult: { success: true, data: { status: 'clean' } },
        },
      ],
      status: Status.SUCCESS,
      startTime: new Date(0).toISOString(),
      endTime: new Date(10).toISOString(),
      stepCount: 1,
      backups: [],
      successfulInspectionCalls: 1,
      modifiedExtensions: new Set<string>(),
      exploredPaths: new Set<string>(),
      mutatedFiles: new Set<string>(),
      activeFocusIndex: 0,
      focusInspectionBudgetRemaining: 0,
      focusStatus: 'rejected',
      focusAdjacentFileUsed: false,
    };
  }),
}));

const { ralphRun } = vi.hoisted(() => ({
  ralphRun: vi.fn(async (_prompt: string, options?: { onIteration?: (context: unknown) => void }) => {
    options?.onIteration?.({
      iteration: 1,
      prompt: _prompt,
      usedPrompt: _prompt,
      code: 'function setup() { createCanvas(100, 100); }',
      evaluation: { score: 0.82, issues: [] },
      timestamp: new Date(0).toISOString(),
      generatorThinking: 'I chose drifting shapes and aurora colors for the p5 scene.',
      evaluatorReasoning: 'The visual output matches the prompt and has coherent motion.',
    });
    return {
      code: 'function setup() { createCanvas(100, 100); }',
      iterations: 1,
      completed: true,
      reason: 'accepted',
      timestamp: new Date(0).toISOString(),
      duration: 10,
      finalScore: 0.82,
    };
  }),
}));

const { draftGenerate } = vi.hoisted(() => ({
  draftGenerate: vi.fn(async () => ({
    needsClarification: false,
    code: 'function setup() { createCanvas(120, 120); background(12); }',
    thinking: 'Drafted a fast p5 preview with immediate visible output.',
    model: 'qwen3.6-35b-a3b',
  })),
}));

vi.mock('../../src/harness/agent/index.js', () => ({
  createLLMModeAgent: () => ({ executeTask }),
}));

vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: { run: ralphRun },
}));

vi.mock('../../src/core/GenerationOrchestrator.js', () => ({
  GenerationOrchestrator: class {
    generate = draftGenerate;
  },
}));

const { TuiBridgeService } = await import('../../src/tui-bridge/TuiBridgeService.js');

function fakeLlm() {
  return {
    getConfig: () => ({ baseUrl: 'https://api.openai.com/v1', model: 'test-model' }),
    generate: vi.fn().mockResolvedValue({ code: 'Hello! How can I help?', explanation: '', success: true }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function expectLiveContext(description: string): void {
  expect(description).toContain('Live Bubble Tea session context:');
  expect(description).toContain('runtime.provider: openai');
  expect(description).toContain('runtime.model: test-model');
}

async function waitFor<T>(read: () => T | undefined): Promise<T> {
  for (let i = 0; i < 800; i++) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for event');
}

describe('Bubble Tea operator routing', () => {
  beforeEach(() => {
    executeTask.mockClear();
    ralphRun.mockClear();
    draftGenerate.mockClear();
  });

  it('routes ordinary text to direct chat without requiring review in assist mode', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'hello, check the current repository',
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(false);
    expect(executeTask).not.toHaveBeenCalled();

    const turn = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'session.turn'));

    expect(turn).toMatchObject({
      type: 'session.turn',
      intent: 'direct',
      delegatedTo: 'llm-chat',
    });
  });

  it('stores the full prompt and original route for creative review actions', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const prompt = 'generate a p5 sketch with a deliberately long description that must not be truncated before approval';

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: prompt,
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(true);
    expect(service.getStatus(session.sessionId).pendingAction).toMatchObject({
      prompt,
      route: 'creative',
    });
  });

  it('keeps creative routing when a prompt has only one operator-inspection phrase', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const prompt = 'read-only creative brief: create a p5 sketch with soft motion';

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: prompt,
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(true);
    expect(service.getStatus(session.sessionId).pendingAction).toMatchObject({
      prompt,
      route: 'creative',
    });
  });

  it('routes workbench creative prompts to generation without magic verbs or repo tools', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const prompt = 'icebergs dancing in the sky';

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: prompt,
        clientIntent: 'creative',
        maxIterations: 1,
        candidateCount: 1,
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(false);
    expect(executeTask).not.toHaveBeenCalled();

    const intent = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.intent_brief'));

    expect(intent).toMatchObject({
      type: 'generation.intent_brief',
      userRequest: prompt,
    });
    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));
    expect(draftGenerate).toHaveBeenCalledOnce();
    expect(service.getEvents(session.sessionId)
      .some(event => event.type === 'generation.clarification_needed')).toBe(false);
    expect(service.getEvents(session.sessionId)
      .some(event => event.type === 'tool.started' && ['gitStatus', 'listDir', 'readFile', 'searchCode', 'searchDocs'].includes(String((event as any).toolName)))).toBe(false);
  });

  it('drafts concrete one-object prompts instead of asking what the subject is', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'icebergs',
        clientIntent: 'creative',
        maxIterations: 1,
        candidateCount: 1,
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));

    expect(draftGenerate).toHaveBeenCalledOnce();
    expect(service.getEvents(session.sessionId)
      .some(event => event.type === 'generation.clarification_needed')).toBe(false);
  });

  it('defaults workbench creative runs to the draft lane without invoking RalphLoop', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'glass flowers orbiting inside a black hole',
        clientIntent: 'creative',
        maxIterations: 5,
        candidateCount: 1,
        timeoutMinutes: 3,
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(false);
    expect(ralphRun).not.toHaveBeenCalled();
    expect(draftGenerate).toHaveBeenCalledOnce();
    expect(draftGenerate).toHaveBeenCalledWith(expect.any(String), expect.any(String), true, expect.objectContaining({ aborted: false }));

    const completion = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));
    expect(completion).toMatchObject({
      type: 'generation.complete',
      reason: 'draft artifact ready (unscored)',
      qualityState: 'unscored',
      executionMode: 'draft',
    });
  });

  it('cancels an in-flight draft run before it can complete', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const pendingDraft = deferred<{
      needsClarification: false;
      code: string;
      thinking: string;
      model: string;
    }>();
    draftGenerate.mockImplementationOnce(() => pendingDraft.promise);

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'slow aurora cathedral',
        clientIntent: 'creative',
        executionMode: 'draft',
      },
      fakeLlm() as never,
    );

    service.cancelRun(session.sessionId);
    await waitFor(() => service.getEvents(session.sessionId)
      .find((event) => event.type === 'activity.updated' && String((event as any).message).includes('Generation stopped')));

    expect(service.getEvents(session.sessionId).some((event) => event.type === 'generation.complete')).toBe(false);
    expect(service.getEvents(session.sessionId).some((event) => event.type === 'activity.updated' && String((event as any).message).includes('Generation stopped'))).toBe(true);

    pendingDraft.resolve({
      needsClarification: false,
      code: 'function setup() { createCanvas(100, 100); }',
      thinking: 'late draft',
      model: 'qwen3.6-35b-a3b',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.getEvents(session.sessionId).some((event) => event.type === 'generation.complete')).toBe(false);
  });

  it('labels creative telemetry with generator and evaluator role models, not the harness model', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession({
      roles: {
        generator: {
          role: 'generator',
          provider: 'lmstudio',
          baseUrl: 'http://localhost:1234/v1',
          model: 'qwen3.6-35b-a3b',
          source: 'active-provider',
          multimodal: 'unknown',
          purpose: 'Writes the creative code candidates.',
        },
        harness: {
          role: 'harness',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5.4',
          source: 'role-env',
          multimodal: 'yes',
          purpose: 'Runs bridge orchestration.',
        },
        evaluator: {
          role: 'evaluator',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5.4-mini',
          source: 'role-env',
          multimodal: 'yes',
          purpose: 'Scores rendered evidence.',
        },
      },
    });

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'make a p5 animation of icebergs dancing in the sky with aurora colors, slow drifting motion, and a dark ocean horizon',
        clientIntent: 'creative',
        executionMode: 'prove',
        maxIterations: 1,
        candidateCount: 1,
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    const generationTrace = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.reasoning_trace' && event.phase === 'generation'));
    const generatorTrace = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.reasoning_trace' && event.source === 'generator'));
    const evaluatorTrace = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.reasoning_trace' && event.source === 'evaluator'));

    expect(generationTrace).toMatchObject({
      model: 'qwen3.6-35b-a3b',
      thought: expect.stringContaining('qwen3.6-35b-a3b'),
    });
    expect(generatorTrace).toMatchObject({ model: 'qwen3.6-35b-a3b' });
    expect(evaluatorTrace).toMatchObject({ model: 'gpt-5.4-mini' });
    expect(service.getEvents(session.sessionId)
      .filter(event => event.type === 'generation.reasoning_trace' && ['generation', 'generator-thinking', 'evaluation'].includes(event.phase))
      .some(event => event.model === 'gpt-5.4')).toBe(false);
  }, 15000);

  it('routes read-only dogfood checkpoint prompts to engineering even when they mention create files', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const prompt = [
      'Studio engineering dogfood checkpoint for marketing-readiness.',
      'Read-only. Do not modify files. Do not create files. Do not commit. Do not push.',
      'Use tool calls only.',
      'Collect telemetry-friendly evidence for repository state and provider/model truth.',
    ].join('\n\n');

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: prompt,
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(true);
    expect(executeTask).not.toHaveBeenCalled();
    expect(service.getStatus(session.sessionId).pendingAction).toMatchObject({
      prompt,
      route: 'engineering',
      kind: 'structured',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id, fakeLlm() as never);

    const turn = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'session.turn'));

    expect(executeTask).toHaveBeenCalledOnce();
    expect(turn).toMatchObject({
      type: 'session.turn',
      intent: 'engineering',
      delegatedTo: 'conveyor',
    });
  });

  it('routes ordinary text to direct chat even in autopilot mode', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: '/autonomy autopilot',
      clientIntent: 'command',
    });

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'hello, check the current repository',
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    const turn = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'session.turn'));

    expect(executeTask).not.toHaveBeenCalled();
    expect(turn).toMatchObject({
      type: 'session.turn',
      intent: 'direct',
      delegatedTo: 'llm-chat',
    });
  });
});
