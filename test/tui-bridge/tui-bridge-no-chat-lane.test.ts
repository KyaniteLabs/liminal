import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const { LLMGenerationError } = await import('../../src/errors/LLMGenerationError.js');
const { latestRunReceipt } = await import('../../gui/src/gui/workbenchTelemetry');

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
    vi.spyOn(TuiBridgeService.prototype as any, 'emitPreviewArtifacts').mockImplementation(async function (
      this: InstanceType<typeof TuiBridgeService>,
      sessionId: string,
      _code: string,
      domain: string,
    ) {
      this.publishEvent(sessionId, {
        type: 'artifact.found',
        artifactLabel: `${domain} HTML preview`,
        artifactPath: `.omx/proof/live-previews/${sessionId}.html`,
      });
      this.publishEvent(sessionId, {
        type: 'preview.completed',
        previewType: 'html',
        content: '<html></html>',
        artifactPath: `.omx/proof/live-previews/${sessionId}.html`,
      });
      this.publishEvent(sessionId, {
        type: 'preview.verified',
        previewType: 'html',
        artifactPath: `.omx/proof/live-previews/${sessionId}.html`,
        checks: ['mock preview rendered'],
      });
      this.publishEvent(sessionId, {
        type: 'generation.domain_truth',
        requestedDomain: domain,
        selectedDomain: domain,
        domains: [domain],
        promptDomainLocked: true,
        source: 'prompt',
        generatedDomain: domain,
        previewDomain: domain,
        artifactPath: `.omx/proof/live-previews/${sessionId}.html`,
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(service.getEvents(session.sessionId)
      .filter((event) => event.type === 'run.lifecycle')
      .map((event) => event.run.phase)).toEqual(['queued', 'generating', 'completed']);
    expect(service.getStatus(session.sessionId).run).toMatchObject({
      kind: 'chat',
      phase: 'completed',
      outcome: 'completed',
      model: 'test-model',
      provider: 'openai',
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

  it('exercises the Studio p5 prompt-to-preview route and derives a run receipt', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession({
      provider: 'openai',
      model: 'test-model',
      roles: {
        generator: {
          role: 'generator',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'qwen3.6-35b-a3b',
          source: 'active-provider',
          multimodal: 'unknown',
          purpose: 'Writes the creative code candidates.',
        },
      } as never,
    });

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'p5 sketch of fireflies orbiting a moonlit willow tree',
        clientIntent: 'creative',
        executionMode: 'draft',
        maxIterations: 1,
        candidateCount: 1,
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'preview.completed'));
    const events = service.getEvents(session.sessionId);
    const receipt = latestRunReceipt(events as never, service.getStatus(session.sessionId) as never);

    expect(receipt).toMatchObject({
      heading: 'Run receipt',
      phase: 'complete',
      creativeDomain: 'p5',
      provider: 'openai',
      model: 'qwen3.6-35b-a3b',
      artifact: {
        label: 'p5 HTML preview',
        path: `.omx/proof/live-previews/${session.sessionId}.html`,
      },
      preview: {
        type: 'html',
        inline: true,
        path: `.omx/proof/live-previews/${session.sessionId}.html`,
      },
    });
    expect(events.map(event => event.type)).toEqual(expect.arrayContaining([
      'generation.intent_brief',
      'generation.route.selected',
      'generation.attempt.started',
      'generation.complete',
      'artifact.found',
      'preview.completed',
    ]));
  });

  it('links revision and polish runs to the prior Studio receipt through bridge events', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'Polish this p5 sketch with slower fireflies',
        clientIntent: 'creative',
        executionMode: 'draft',
        creativePreferences: {
          revisionKind: 'polish',
          priorRunReceipt: {
            phase: 'complete',
            creativeDomain: 'p5',
            artifact: {
              label: 'p5 HTML preview',
              path: '.omx/proof/live-previews/original.html',
            },
            preview: { type: 'html' },
          },
        },
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'preview.completed'));
    const link = service.getEvents(session.sessionId).find(event => event.type === 'generation.receipt.linked');
    const receipt = latestRunReceipt(service.getEvents(session.sessionId) as never, service.getStatus(session.sessionId) as never);

    expect(link).toMatchObject({
      type: 'generation.receipt.linked',
      revisionKind: 'polish',
      priorPhase: 'complete',
      priorDomain: 'p5',
      priorArtifactPath: '.omx/proof/live-previews/original.html',
      priorPreviewType: 'html',
    });
    expect(receipt).toMatchObject({
      outcome: 'completed',
      prior: {
        revisionKind: 'polish',
        creativeDomain: 'p5',
        artifact: { path: '.omx/proof/live-previews/original.html' },
      },
    });
  });

  it('emits an explicit route-selected event before model attempts for workbench generation', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'p5 sketch of fireflies orbiting a moonlit willow tree',
        clientIntent: 'creative',
        executionMode: 'draft',
        maxIterations: 1,
        candidateCount: 1,
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));
    const events = service.getEvents(session.sessionId);
    const routeIndex = events.findIndex(event => event.type === 'generation.route.selected');
    const attemptIndex = events.findIndex(event => event.type === 'generation.attempt.started');

    expect(routeIndex).toBeGreaterThanOrEqual(0);
    expect(attemptIndex).toBeGreaterThan(routeIndex);
    expect(events[routeIndex]).toMatchObject({
      type: 'generation.route.selected',
      domain: expect.any(String),
      domains: expect.arrayContaining([expect.any(String)]),
      executionMode: 'draft',
      candidateCount: 1,
      timeoutMinutes: 1,
    });
    expect((events[routeIndex] as any).domains[0]).toBe((events[routeIndex] as any).domain);
  });

  it('records prompt-domain truth when prompt overrides a stale mode hint', async () => {
    draftGenerate.mockImplementationOnce(async () => ({
      needsClarification: false,
      code: 'osc(10).kaleid(4).out()',
      thinking: 'Drafted a Hydra video synth because the user prompt explicitly requested Hydra.',
      model: 'qwen3.6-35b-a3b',
    }));
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'Create a Tone.js Web Audio sketch.\n\nUser prompt: make a hydra visual of icebergs dancing in the sky',
        clientIntent: 'creative',
        executionMode: 'draft',
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    const truth = await waitFor(() => service.getEvents(session.sessionId)
      .filter((event) => event.type === 'generation.domain_truth')
      .find((event) => 'artifactPath' in event));

    const route = service.getEvents(session.sessionId)
      .find((event) => event.type === 'generation.route.selected');

    expect(route).toMatchObject({
      domain: 'hydra',
      requestedDomain: 'hydra',
      selectedDomain: 'hydra',
      domains: ['hydra'],
      promptDomainLocked: true,
      source: 'prompt',
    });
    expect(truth).toMatchObject({
      requestedDomain: 'hydra',
      selectedDomain: 'hydra',
      generatedDomain: 'hydra',
      previewDomain: 'hydra',
      artifactPath: expect.stringContaining('.html'),
    });
  }, 15000);


  it('surfaces real provider provenance on creative generation failures', async () => {
    draftGenerate.mockImplementationOnce(async () => {
      throw new LLMGenerationError('LLM generation failed: OpenAI API error 429: rate limited', {
        provider: 'openai',
        model: 'gpt-5.4-mini',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        statusCode: 429,
        retryable: true,
        responseBody: '{"error":"rate limited"}',
      });
    });
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'make a hydra visual of storm clouds',
        clientIntent: 'creative',
        executionMode: 'draft',
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    const failed = await waitFor(() => service.getEvents(session.sessionId)
      .find((event) => event.type === 'generation.attempt.failed'));
    const error = await waitFor(() => service.getEvents(session.sessionId)
      .find((event) => event.type === 'error'));

    expect(failed).toMatchObject({
      type: 'generation.attempt.failed',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      statusCode: 429,
      retryable: true,
      responseBody: '{"error":"rate limited"}',
    });
    expect(error).toMatchObject({
      type: 'error',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      statusCode: 429,
    });
    const receipt = latestRunReceipt(service.getEvents(session.sessionId) as never, service.getStatus(session.sessionId) as never);
    expect(receipt).toMatchObject({
      outcome: 'failed',
      failure: {
        provider: 'openai',
        model: 'gpt-5.4-mini',
        statusCode: 429,
        retryable: true,
      },
    });
    expect(receipt?.artifact).toBeUndefined();
    expect(service.getEvents(session.sessionId).some((event) => event.type === 'artifact.found')).toBe(false);
  });

  it('keeps a canonical draft run lifecycle through render before completion', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'p5 sketch of fireflies orbiting a moonlit willow tree',
        clientIntent: 'creative',
        executionMode: 'draft',
        timeoutMinutes: 1,
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));
    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'run.lifecycle' && event.run.phase === 'completed'));

    const lifecycle = service.getEvents(session.sessionId)
      .filter((event): event is Extract<typeof event, { type: 'run.lifecycle' }> => event.type === 'run.lifecycle');
    const phases = lifecycle.map((event) => event.run.phase);
    expect(phases).toEqual(expect.arrayContaining(['queued', 'planning', 'generating', 'rendering', 'completed']));
    expect(phases.lastIndexOf('rendering')).toBeLessThan(phases.lastIndexOf('completed'));
    expect(service.getStatus(session.sessionId).run).toMatchObject({
      kind: 'creative',
      executionMode: 'draft',
      phase: 'completed',
      outcome: 'completed',
      model: 'qwen3.6-35b-a3b',
    });
    expect(service.getEvents(session.sessionId)
      .filter((event) => event.type === 'preview.completed')
      .every((event) => Boolean((event as any).artifactPath || (event as any).imageUrl))).toBe(true);
  }, 15000);

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
      reason: 'generated artifact ready (unscored)',
      qualityState: 'unscored',
      executionMode: 'draft',
    });
  });

  it('threads Studio creative preference answers into draft generation prompts without UI coupling language', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'p5 sketch of a quiet moon garden with drifting flowers',
        clientIntent: 'creative',
        executionMode: 'draft',
        creativePreferences: {
          color: 'muted cool colors with gentle low contrast',
          motion: 'slow breathing motion',
        },
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));

    const prompt = String(draftGenerate.mock.calls[0]?.[0] ?? '');
    expect(prompt).toContain('Creative preferences');
    expect(prompt).toContain('Favor muted saturation.');
    expect(prompt).toContain('Use gentle low contrast as a creative preference.');
    expect(prompt).toContain('Favor a cool color temperature.');
    expect(prompt).toContain('Prefer slow motion pacing.');
    expect(prompt).not.toMatch(/\b(guardrail|proof|harness)\b/i);
  });

  it('threads guidance answer aliases into prove generation prompts', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

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
        guidanceAnswers: {
          saturation: 'vivid',
          contrast: 'high contrast',
          motion: 'slow drifting motion',
        },
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));

    const prompt = String(ralphRun.mock.calls[0]?.[0] ?? '');
    expect(prompt).toContain('Creative preferences');
    expect(prompt).toContain('Favor vivid saturation.');
    expect(prompt).toContain('Use high contrast as a creative preference.');
    expect(prompt).toContain('Prefer slow motion pacing.');
    expect(prompt).not.toMatch(/\b(guardrail|proof|harness)\b/i);
  }, 15000);

  it('keeps Kinetic Studio mode out of the p5-only generation instruction path', async () => {
    draftGenerate.mockImplementationOnce(async () => ({
      needsClarification: false,
      code: '<!doctype html><html><style>@keyframes orbit{to{transform:rotate(360deg)}}</style><body><span class="letter">threshold</span></body></html>',
      thinking: 'Drafted CSS kinetic typography as HTML.',
      model: 'qwen3.6-35b-a3b',
    }));
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'Create CSS kinetic typography as a complete animated HTML artifact.\n\nUser prompt: moving words orbiting a threshold',
        clientIntent: 'creative',
        executionMode: 'draft',
      },
      fakeLlm() as never,
    );

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'generation.complete'));

    const prompt = String(draftGenerate.mock.calls[0]?.[0] ?? '');
    expect(prompt).toContain('Target creative domain: kinetic.');
    expect(prompt).not.toContain('Return raw p5.js sketch code only');
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
    expect(service.getStatus(session.sessionId).run).toMatchObject({
      phase: 'failed',
      outcome: 'cancelled',
      error: 'Generation stopped by operator.',
    });
    const stoppedReceipt = latestRunReceipt(service.getEvents(session.sessionId) as never, service.getStatus(session.sessionId) as never);
    expect(stoppedReceipt).toMatchObject({ outcome: 'stopped', phase: 'stopped' });
    expect(stoppedReceipt?.artifact).toBeUndefined();

    pendingDraft.resolve({
      needsClarification: false,
      code: 'function setup() { createCanvas(100, 100); }',
      thinking: 'late draft',
      model: 'qwen3.6-35b-a3b',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.getEvents(session.sessionId).some((event) => event.type === 'generation.complete')).toBe(false);
  });

  it('aborts the underlying draft generation signal when a draft attempt times out', async () => {
    vi.useFakeTimers();
    try {
      const service = new TuiBridgeService();
      const session = service.createSession();
      const pendingDraft = deferred<{
        needsClarification: false;
        code: string;
        thinking: string;
        model: string;
      }>();
      const observedSignals: AbortSignal[] = [];
      draftGenerate.mockImplementationOnce((_prompt, _rawPrompt, _draft, signal) => {
        observedSignals.push(signal as AbortSignal);
        return pendingDraft.promise;
      });

      await service.submitInput(
        session.sessionId,
        {
          mode: 'chat',
          text: 'slow timeout garden',
          clientIntent: 'creative',
          executionMode: 'draft',
          timeoutMinutes: 1,
        },
        fakeLlm() as never,
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(observedSignals).toHaveLength(1);
      expect(observedSignals[0].aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(60_000);
      await Promise.resolve();
      await Promise.resolve();

      expect(observedSignals[0].aborted).toBe(true);
      expect(service.getStatus(session.sessionId).run).toMatchObject({
        phase: 'failed',
        outcome: 'failed',
        error: 'Generation timed out after 1 minute',
      });
      expect(service.getEvents(session.sessionId).some((event) => event.type === 'generation.complete')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
      delegatedTo: 'engineering-agent',
      executor: 'llm-mode-agent',
    });
    expect(service.getEvents(session.sessionId)
      .find(event => event.type === 'run.lifecycle' && event.run.kind === 'engineering'))
      .toMatchObject({
        type: 'run.lifecycle',
        run: {
          kind: 'engineering',
          executor: 'llm-mode-agent',
        },
      });
  });

  it('shows persisted planning failure receipts in engineering run status', async () => {
    const receipt = 'upstream rejected request | provider=openai | model=gpt-5.4-mini | endpoint=https://api.openai.com/v1/chat/completions | status=429 | retryable=true | body={"error":"quota exceeded"}';
    executeTask.mockImplementationOnce(async (task: { id: string; title: string }) => ({
      task,
      messages: [],
      status: Status.FAILED,
      startTime: new Date(0).toISOString(),
      endTime: new Date(10).toISOString(),
      stepCount: 1,
      backups: [],
      successfulInspectionCalls: 0,
      modifiedExtensions: new Set<string>(),
      exploredPaths: new Set<string>(),
      mutatedFiles: new Set<string>(),
      successfulMutatedFiles: new Set<string>(),
      activeFocusIndex: 0,
      focusInspectionBudgetRemaining: 0,
      focusStatus: 'rejected',
      focusAdjacentFileUsed: false,
      lastPlanError: receipt,
    }));

    const service = new TuiBridgeService();
    const session = service.createSession();
    const prompt = 'Fix the Bubble Tea TUI provider failure receipt display.';

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: prompt,
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id, fakeLlm() as never);

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'response.completed' && String(event.content).includes('Last planning failure:')));
    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'run.lifecycle' && event.run.phase === 'failed'));

    expect(service.getStatus(session.sessionId).run).toMatchObject({
      kind: 'engineering',
      phase: 'failed',
      outcome: 'failed',
      error: receipt,
      lastPlanError: receipt,
      agentStatus: Status.FAILED,
      resumable: false,
      retryable: true,
      nextAction: expect.objectContaining({ action: 'retry_provider' }),
    });
  });

  it('keeps suspended engineering runs resumable instead of flattening them to failed', async () => {
    const receipt = 'MiniMax API error 529 | retryable=true';
    executeTask.mockImplementationOnce(async (task: { id: string; title: string }) => ({
      task,
      messages: [],
      status: Status.SUSPENDED,
      startTime: new Date(0).toISOString(),
      endTime: new Date(10).toISOString(),
      stepCount: 2,
      backups: [],
      successfulInspectionCalls: 0,
      modifiedExtensions: new Set<string>(),
      exploredPaths: new Set<string>(),
      mutatedFiles: new Set<string>(['src/foo.ts']),
      successfulMutatedFiles: new Set<string>(['src/foo.ts']),
      activeFocusIndex: 0,
      focusInspectionBudgetRemaining: 0,
      focusStatus: 'committed',
      focusAdjacentFileUsed: false,
      lastPlanError: receipt,
    }));

    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'Fix the Bubble Tea resumable lifecycle display.',
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id, fakeLlm() as never);

    await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'run.lifecycle' && event.run.phase === 'suspended'));

    expect(service.getStatus(session.sessionId).run).toMatchObject({
      kind: 'engineering',
      phase: 'suspended',
      outcome: 'suspended',
      error: receipt,
      lastPlanError: receipt,
      agentStatus: Status.SUSPENDED,
      resumable: true,
      retryable: true,
      nextAction: expect.objectContaining({ action: 'resume_checkpoint' }),
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
