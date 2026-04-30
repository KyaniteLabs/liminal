import { describe, expect, it, vi } from 'vitest';
import {
  isGenerationRequest,
  TUI_SYSTEM_PROMPT,
  TuiBridgeService,
} from '../../src/tui-bridge/TuiBridgeService.js';
import type { LLMSession } from '../../src/harness/agent/index.js';

describe('TuiBridgeService', () => {
  it('uses a meta-harness system prompt instead of creative-only identity', () => {
    expect(TUI_SYSTEM_PROMPT).toContain('Meta-Harness');
    expect(TUI_SYSTEM_PROMPT).toContain('self-improvement');
    expect(TUI_SYSTEM_PROMPT).toContain('Do not refuse self-improvement work');
    expect(TUI_SYSTEM_PROMPT).not.toContain('only a creative assistant');
  });

  it('routes harness repair prompts away from creative Ralph generation', () => {
    const prompt = 'Fix the Bubble Tea TUI and improve the harness codebase';

    expect(isGenerationRequest(prompt)).toBe(false);
  });

  it('routes Bubble Tea panel cleanup prompts away from creative Ralph generation', () => {
    const prompt = 'make the Bubble Tea right-column panels less duplicative';

    expect(isGenerationRequest(prompt)).toBe(false);
  });

  it('still routes explicit creative prompts to generation', () => {
    expect(isGenerationRequest('create a p5 shader sketch')).toBe(true);
  });

  it('publishes optional creative preference guidance as an artist-facing bridge event', () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const emitted = (service as any).emitCreativePreferenceGuidance(
      session.sessionId,
      'create a slow blue p5 nebula with soft motion',
      'p5',
    );

    const guidance = service.getEvents(session.sessionId)
      .find((event): event is any => event.type === 'guidance.suggestion');
    const serialized = JSON.stringify(guidance);

    expect(emitted).toBe(true);
    expect(guidance).toMatchObject({
      type: 'guidance.suggestion',
      category: 'creative-preferences',
      title: 'Optional creative preferences',
      priority: 'low',
      optional: true,
    });
    expect(guidance.description).toContain('color/motion');
    expect(guidance.questions.length).toBeGreaterThan(0);
    expect(serialized).not.toMatch(/\b(guardrail|proof|harness)\b/i);
  });

  it('creates a session with default chat mode', () => {
    const service = new TuiBridgeService();
    const status = service.createSession();

    expect(status.sessionId).not.toBeNull();
    expect(status.mode).toBe('chat');
    expect(status.trust.level).toBe('untrusted');
  });

  it('creates a review-required action for action-like input', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const result = await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Delete the file',
      clientIntent: 'action',
    });

    expect(result.reviewRequired).toBe(true);
    expect(service.getStatus(session.sessionId).pendingAction?.title).toContain('Delete');
  });

  it('emits active response events without committing until completion', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'Hello bridge',
      clientIntent: 'chat',
    });

    const events = service.getEvents(session.sessionId);
    expect(events.map(e => e.type)).toContain('response.started');
    expect(events.map(e => e.type)).toContain('response.delta');
    expect(events.map(e => e.type)).toContain('response.completed');
    expect(events.map(e => e.type)).toContain('response.committed');
  });

  it('confirms a pending action and clears it', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Run risky change',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id);

    expect(service.getStatus(session.sessionId).pendingAction).toBeUndefined();
    expect(service.getEvents(session.sessionId).map(e => e.type)).toContain('action.confirmed');
    expect(service.getEvents(session.sessionId)
      .filter(e => e.type === 'status.updated')
      .at(-1)).toMatchObject({
      type: 'status.updated',
      status: {
        mode: 'confirm',
        pendingAction: undefined,
      },
    });
  });

  it('cancels a pending action and clears it', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Run risky change',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    service.cancelAction(session.sessionId, pending.id);

    expect(service.getStatus(session.sessionId).pendingAction).toBeUndefined();
    expect(service.getEvents(session.sessionId).map(e => e.type)).toContain('action.cancelled');
    expect(service.getEvents(session.sessionId)
      .filter(e => e.type === 'status.updated')
      .at(-1)).toMatchObject({
      type: 'status.updated',
      status: {
        mode: 'chat',
        pendingAction: undefined,
      },
    });
  });

  it('publishes an explicit cancellation event when the active run is stopped', () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    service.cancelRun(session.sessionId);

    expect(service.getEvents(session.sessionId)).toContainEqual(expect.objectContaining({
      type: 'generation.cancelled',
      reason: 'operator-stop',
    }));
    expect(service.getEvents(session.sessionId)
      .filter(e => e.type === 'status.updated')
      .at(-1)).toMatchObject({
      type: 'status.updated',
      status: {
        mode: 'chat',
        activeTask: 'Generation stopped',
      },
    });
  });

  it('rejects confirmation when no pending action exists', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await expect(service.confirmAction(session.sessionId, 'missing-action')).rejects.toThrow('not found');
    expect(service.getEvents(session.sessionId).map(e => e.type)).not.toContain('action.confirmed');
  });

  // ── StudioAgent Routing ──

  describe('engineering response formatting', () => {
    const makeSession = (overrides: Partial<LLMSession> = {}): LLMSession => ({
      task: {
        id: 'task-1',
        title: 'Fix TUI formatting',
        description: 'Make the final response answer-first',
        approved: true,
      },
      messages: [
        {
          role: 'assistant',
          content: '{}',
          toolCall: {
            thought: 'Inspect formatter',
            tool: 'readFile',
            params: { path: 'src/tui-bridge/TuiBridgeService.ts' },
            expectedResult: 'See current formatting',
          },
        },
        {
          role: 'tool',
          content: '{}',
          toolResult: { success: true, data: { exists: true } },
        },
        {
          role: 'assistant',
          content: '{}',
          toolCall: {
            thought: 'Verify build',
            tool: 'runBuild',
            params: {},
            expectedResult: 'Build passes',
          },
        },
        {
          role: 'tool',
          content: '{}',
          toolResult: { success: true, data: { ok: true } },
        },
      ],
      status: 'success',
      startTime: '2024-01-01T00:00:00.000Z',
      endTime: '2024-01-01T00:00:02.000Z',
      stepCount: 4,
      backups: [],
      successfulInspectionCalls: 1,
      modifiedExtensions: new Set(['.ts']),
      exploredPaths: new Set(['src/tui-bridge/TuiBridgeService.ts']),
      mutatedFiles: new Set(['src/tui-bridge/TuiBridgeService.ts']),
      activeFocusIndex: 0,
      focusInspectionBudgetRemaining: 0,
      focusStatus: 'committed',
      focusAdjacentFileUsed: false,
      ...overrides,
    });

    it('formats completed engineering sessions answer-first with required sections', () => {
      const service = new TuiBridgeService();
      const content = service['formatAgentSession'](makeSession());

      expect(content.startsWith('Status: success')).toBe(true);
      expect(content).toContain('Verdict:');
      expect(content).toContain('Evidence:');
      expect(content).toContain('Files changed:');
      expect(content).toContain('Tests run:');
      expect(content).toContain('Other verification:');
      expect(content).toContain('Remaining risks:');
      expect(content).toContain('Recommended next action:');
      expect(content).toContain('Supporting tool trace:');
      expect(content).not.toContain('# Meta-Harness Tool Run');
      expect(content.indexOf('Supporting tool trace:')).toBeGreaterThan(content.indexOf('Recommended next action:'));
    });

    it('keeps metadata in evidence and separates changed files from build verification', () => {
      const service = new TuiBridgeService();
      const content = service['formatAgentSession'](makeSession());

      expect(content).toContain('- Steps: 4');
      expect(content).toContain('- Duration: 2000ms');
      expect(content).toContain('- Tools used: readFile, runBuild');
      expect(content).toContain('- src/tui-bridge/TuiBridgeService.ts');
      expect(content).toContain('Tests run:\n- none recorded');
      expect(content).toContain('Other verification:\n- runBuild');
      expect(content).toContain('- runBuild');
      expect(content).toContain('- readFile: Inspect formatter (ok)');
    });

    it('surfaces restored planning failure receipts in engineering summaries', () => {
      const service = new TuiBridgeService();
      const receipt = 'upstream rejected request | provider=openai | model=gpt-5.4-mini | endpoint=https://api.openai.com/v1/chat/completions | status=429 | retryable=true | body={"error":"quota exceeded"}';
      const content = service['formatAgentSession'](makeSession({
        status: 'failed',
        lastPlanError: receipt,
      }));

      expect(content).toContain('Last planning failure:');
      expect(content).toContain(receipt);
      expect(content.indexOf('Last planning failure:')).toBeLessThan(content.indexOf('Remaining risks:'));
    });

    it('lists runFocusedTests as verification evidence', () => {
      const service = new TuiBridgeService();
      const content = service['formatAgentSession'](makeSession({
        messages: [
          {
            role: 'assistant',
            content: '{}',
            toolCall: {
              thought: 'Run focused tests',
              tool: 'runFocusedTests',
              params: { path: 'test/tui-bridge/tui-bridge-service.test.ts' },
              expectedResult: 'Focused tests pass',
            },
          },
          {
            role: 'tool',
            content: '{}',
            toolResult: { success: true, data: { command: 'npx vitest run test/tui-bridge/tui-bridge-service.test.ts --coverage=false' } },
          },
        ],
      }));

      expect(content).toContain('Tests run:');
      expect(content).toContain('- runFocusedTests');
    });

    it('preserves rolled_back as a distinct status', () => {
      const service = new TuiBridgeService();
      const content = service['formatAgentSession'](makeSession({ status: 'rolled_back' }));

      expect(content.startsWith('Status: rolled_back')).toBe(true);
      expect(content).not.toContain('Status: failed');
    });

    it('does not report touched files as final changes after rollback', () => {
      const service = new TuiBridgeService();
      const content = service['formatAgentSession'](makeSession({ status: 'rolled_back' }));

      expect(content).toContain('Files changed:\n- none (rolled back 1 touched file)');
      expect(content).not.toContain('Files changed:\n- src/tui-bridge/TuiBridgeService.ts');
    });
  });

  describe('StudioAgent routing', () => {
    it('emits session.turn event for direct input (no LLM)', async () => {
      const service = new TuiBridgeService();
      const session = service.createSession();

      await service.submitInput(session.sessionId, {
        mode: 'chat',
        text: 'hello',
      });

      const events = service.getEvents(session.sessionId);
      const turnEvent = events.find(e => e.type === 'session.turn');

      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent?.intent).toBe('direct');
        expect(turnEvent.delegatedTo).toBe('echo');
        expect(turnEvent.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('emits session.turn with creative intent for generation input (no LLM)', async () => {
      const service = new TuiBridgeService();
      const session = service.createSession();

      await service.submitInput(session.sessionId, {
        mode: 'chat',
        text: 'generate a p5 sketch',
      });

      const events = service.getEvents(session.sessionId);
      const turnEvent = events.find(e => e.type === 'session.turn');

      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent?.intent).toBe('creative');
        expect(turnEvent.delegatedTo).toBe('echo');
      }
    });

    it('emits session.turn with engineering intent for fix input (no LLM)', async () => {
      const service = new TuiBridgeService();
      const session = service.createSession();

      await service.submitInput(session.sessionId, {
        mode: 'chat',
        text: 'fix the test coverage',
      });

      const events = service.getEvents(session.sessionId);
      const turnEvent = events.find(e => e.type === 'session.turn');

      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent?.intent).toBe('engineering');
        expect(turnEvent.delegatedTo).toBe('echo');
      }
    });

    it('emits session.turn with hybrid intent for mixed input (no LLM)', async () => {
      const service = new TuiBridgeService();
      const session = service.createSession();

      await service.submitInput(session.sessionId, {
        mode: 'chat',
        text: 'improve the art quality',
      });

      const events = service.getEvents(session.sessionId);
      const turnEvent = events.find(e => e.type === 'session.turn');

      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent?.intent).toBe('hybrid');
        expect(turnEvent.delegatedTo).toBe('echo');
      }
    });

    it('includes turnId in session.turn events', async () => {
      const service = new TuiBridgeService();
      const session = service.createSession();

      await service.submitInput(session.sessionId, {
        mode: 'chat',
        text: 'hello',
      });

      const events = service.getEvents(session.sessionId);
      const turnEvent = events.find(e => e.type === 'session.turn');
      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent.turnId).toMatch(/^turn-\d+$/);
      }
    });

    describe('direct chat streaming', () => {
      function mockLlm(response: { code?: string; explanation?: string } = {}) {
        return {
          getConfig: () => ({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4' }),
          generate: vi.fn().mockResolvedValue({
            code: response.code ?? 'Hello! How can I help?',
            explanation: response.explanation ?? '',
            success: true,
          }),
        };
      }

      it('streams direct chat response with delta events', async () => {
        const service = new TuiBridgeService();
        const session = service.createSession();
        const llm = mockLlm({ code: 'This is a long response that will be chunked into multiple delta events for streaming' });

        await service.submitInput(session.sessionId, {
          mode: 'chat',
          text: 'hello',
          clientIntent: 'chat',
        }, llm as never);

        // Wait for async streamDirectChat to complete
        await new Promise(r => setTimeout(r, 100));

        const events = service.getEvents(session.sessionId);
        const types = events.map(e => e.type);
        expect(types).toContain('response.started');
        expect(types).toContain('response.delta');
        expect(types).toContain('response.completed');
        expect(types).toContain('response.committed');
        expect(types).toContain('response.metadata');

        const completed = events.find(e => e.type === 'response.completed');
        expect(completed?.type === 'response.completed' && completed.content).toContain('chunked');
      });

      it('emits error event and no session.turn when LLM returns empty response', async () => {
        const service = new TuiBridgeService();
        const session = service.createSession();
        const llm = mockLlm({ code: '', explanation: '' });

        await service.submitInput(session.sessionId, {
          mode: 'chat',
          text: 'hello',
          clientIntent: 'chat',
        }, llm as never);

        await new Promise(r => setTimeout(r, 50));

        const events = service.getEvents(session.sessionId);
        const errorEvent = events.find(e => e.type === 'error');
        expect(errorEvent).toMatchObject({ type: 'error', message: 'Empty response from LLM' });
        // P1 fix: empty response must NOT emit a successful session.turn
        const turnEvent = events.find(e => e.type === 'session.turn');
        expect(turnEvent).toBeUndefined();
      });

      it('emits session.turn with llm-chat delegation', async () => {
        const service = new TuiBridgeService();
        const session = service.createSession();
        const llm = mockLlm();

        await service.submitInput(session.sessionId, {
          mode: 'chat',
          text: 'hello',
          clientIntent: 'chat',
        }, llm as never);

        // Wait for async streamDirectChat to complete
        await new Promise(r => setTimeout(r, 50));

        const turnEvent = service.getEvents(session.sessionId).find(e => e.type === 'session.turn');
        expect(turnEvent).toMatchObject({
          type: 'session.turn',
          intent: 'direct',
          delegatedTo: 'llm-chat',
        });
      });

      it('includes conversation history in LLM prompt for multi-turn context', async () => {
        const service = new TuiBridgeService();
        const session = service.createSession();
        const llm = mockLlm({ code: 'Second response' });

        // First turn
        await service.submitInput(session.sessionId, {
          mode: 'chat',
          text: 'first message',
          clientIntent: 'chat',
        }, llm as never);
        await new Promise(r => setTimeout(r, 50));

        // Second turn — should include first turn in context
        await service.submitInput(session.sessionId, {
          mode: 'chat',
          text: 'second message',
          clientIntent: 'chat',
        }, llm as never);
        await new Promise(r => setTimeout(r, 50));

        // The generate call for the second turn should have received context
        const generateCalls = llm.generate.mock.calls;
        expect(generateCalls.length).toBe(2);
        const secondCallPrompt = generateCalls[1][1] as string;
        expect(secondCallPrompt).toContain('first message');
        expect(secondCallPrompt).toContain('user: second message');
      });
    });
  });
});
