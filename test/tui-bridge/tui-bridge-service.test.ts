import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import { Domain } from '../../src/types/domains.js';

describe('TuiBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
