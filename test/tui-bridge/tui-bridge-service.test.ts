import { describe, expect, it } from 'vitest';
import {
  isGenerationRequest,
  isSelfImprovementRequest,
  TUI_SYSTEM_PROMPT,
  TuiBridgeService,
} from '../../src/tui-bridge/TuiBridgeService.js';

describe('TuiBridgeService', () => {
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
});
