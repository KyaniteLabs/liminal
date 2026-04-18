import { describe, expect, it } from 'vitest';
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
  it('creates a session with default chat mode', () => {
    const service = new TuiBridgeService();
    const status = service.createSession();

    expect(status.sessionId).toBeDefined();
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
      expect(turnEvent).toBeDefined();
      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent.intent).toBe('direct');
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
      expect(turnEvent).toBeDefined();
      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent.intent).toBe('creative');
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
      expect(turnEvent).toBeDefined();
      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent.intent).toBe('engineering');
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
      expect(turnEvent).toBeDefined();
      if (turnEvent && turnEvent.type === 'session.turn') {
        expect(turnEvent.intent).toBe('hybrid');
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
  });
});
