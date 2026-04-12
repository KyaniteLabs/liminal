import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRalphRun } = vi.hoisted(() => ({
  mockRalphRun: vi.fn(async () => ({
    code: 'generated output',
    iterations: 1,
    finalScore: 0.9,
    duration: 100,
    reason: 'ok',
    model: 'test-model',
  })),
}));

vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: mockRalphRun,
  },
}));

import {
  isGenerationRequest,
  isSelfImprovementRequest,
  TUI_SYSTEM_PROMPT,
  TuiBridgeService,
} from '../../src/tui-bridge/TuiBridgeService.js';
import { Domain } from '../../src/types/domains.js';

describe('TuiBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a meta-harness system prompt instead of creative-only identity', () => {
    expect(TUI_SYSTEM_PROMPT).toContain('Meta-Harness');
    expect(TUI_SYSTEM_PROMPT).toContain('self-improvement');
    expect(TUI_SYSTEM_PROMPT).toContain('Do not refuse self-improvement work');
    expect(TUI_SYSTEM_PROMPT).not.toContain('only a creative assistant');
  });

  it('routes harness repair prompts away from creative Ralph generation', () => {
    const prompt = 'Fix the Bubble Tea TUI and improve the harness codebase';

    expect(isSelfImprovementRequest(prompt)).toBe(true);
    expect(isGenerationRequest(prompt)).toBe(false);
  });

  it('routes ordinary non-creative Bubble Tea input into the tool-using harness by default', async () => {
    const mockRuntime = {
      prepare: vi.fn(() => ({
        task: { id: 'tui-self-1', maxSteps: 3 },
        taskId: 'tui-self-1',
        modelName: 'glm-5.1',
        maxSteps: 3,
        execute: vi.fn(async () => ({
          status: 'success',
          startTime: '2026-04-12T00:00:00.000Z',
          endTime: '2026-04-12T00:00:01.000Z',
          stepCount: 1,
          messages: [],
          task: { id: 'tui-self-1', title: 'Task', description: 'desc', approved: true },
          backups: [],
          modifiedExtensions: new Set(),
          exploredPaths: new Set(),
          mutatedFiles: new Set(),
          successfulInspectionCalls: 0,
          activeFocusIndex: 0,
          focusInspectionBudgetRemaining: 0,
          focusStatus: 'rejected',
          focusAdjacentFileUsed: false,
        })),
      })),
    } as any;

    const service = new TuiBridgeService({ selfImprovementRuntime: mockRuntime });
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'Hello there',
      clientIntent: 'chat',
    }, llm);

    expect(mockRuntime.prepare).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Hello there',
      llm,
    }));
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

  it('chunks streamed reports on natural boundaries when possible', () => {
    const service = new TuiBridgeService() as any;
    const chunks = service.chunkString(
      'Line one wraps neatly here.\nLine two also wraps neatly here.\nFinal bit.',
      30,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].endsWith('\n') || chunks[0].endsWith(' ')).toBe(true);
    expect(chunks.join('')).toBe('Line one wraps neatly here.\nLine two also wraps neatly here.\nFinal bit.');
  });

  it('routes three.js generation requests with three domain instead of p5', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'create a three.js particle scene',
      clientIntent: 'chat',
    }, llm);

    expect(mockRalphRun).toHaveBeenCalledWith(
      'create a three.js particle scene',
      expect.objectContaining({ collabDomain: Domain.THREE }),
    );
  });

  it('routes shader generation requests with shader domain instead of p5', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'generate a glsl shader with plasma noise',
      clientIntent: 'chat',
    }, llm);

    expect(mockRalphRun).toHaveBeenCalledWith(
      'generate a glsl shader with plasma noise',
      expect.objectContaining({ collabDomain: Domain.SHADER }),
    );
  });
});
