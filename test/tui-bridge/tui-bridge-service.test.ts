import { describe, expect, it } from 'vitest';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';

describe('TuiBridgeService', () => {
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
});
