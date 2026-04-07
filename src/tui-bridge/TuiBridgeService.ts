import { TuiEventStream } from './TuiEventStream.js';
import { TuiSessionStore } from './TuiSessionStore.js';
import type { TuiBridgeEvent, TuiInputRequest, TuiPendingAction, TuiSessionStatus } from './types.js';

export class TuiBridgeService {
  private sessions = new TuiSessionStore();
  private stream = new TuiEventStream();

  createSession(): TuiSessionStatus {
    const sessionId = `tui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.sessions.create({
      sessionId,
      mode: 'chat',
      trust: { level: 'untrusted', label: 'Generated code is untrusted by default' },
    });
  }

  getStatus(sessionId: string): TuiSessionStatus {
    const status = this.sessions.get(sessionId);
    if (!status) throw new Error(`Unknown TUI session: ${sessionId}`);
    return status;
  }

  getEvents(sessionId: string): TuiBridgeEvent[] {
    return this.stream.getEvents(sessionId);
  }

  subscribe(sessionId: string, listener: (event: TuiBridgeEvent) => void): () => void {
    return this.stream.subscribe(sessionId, listener);
  }

  async submitInput(sessionId: string, input: TuiInputRequest): Promise<{ reviewRequired: boolean }> {
    this.sessions.update(sessionId, { mode: input.mode });

    if (input.clientIntent === 'action' || input.mode === 'action') {
      const pendingAction: TuiPendingAction = {
        id: `action-${Date.now()}`,
        title: input.text.slice(0, 60),
        description: input.text,
        kind: 'llm',
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
      };
      const status = this.sessions.update(sessionId, {
        mode: 'action',
        trust: { level: 'review-required', label: 'Review required before mutation' },
        pendingAction,
      });
      this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
      this.emit(sessionId, { type: 'status.updated', sessionId, status });
      return { reviewRequired: true };
    }

    this.emit(sessionId, { type: 'response.started', sessionId });
    this.emit(sessionId, { type: 'response.delta', sessionId, delta: input.text });
    this.emit(sessionId, { type: 'response.completed', sessionId, content: input.text });
    this.emit(sessionId, { type: 'response.committed', sessionId, content: input.text });
    this.emit(sessionId, {
      type: 'status.updated',
      sessionId,
      status: this.sessions.update(sessionId, {
        mode: input.mode,
        activeTask: input.text.slice(0, 60),
      }),
    });

    return { reviewRequired: false };
  }

  async confirmAction(sessionId: string, actionId: string): Promise<void> {
    const status = this.getStatus(sessionId);
    if (!status.pendingAction || status.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    this.sessions.update(sessionId, {
      mode: 'confirm',
      pendingAction: undefined,
      trust: { level: 'confirmed', label: 'Operator confirmed mutation' },
    });
    this.emit(sessionId, { type: 'action.confirmed', sessionId, actionId });
  }

  cancelAction(sessionId: string, actionId: string): void {
    const status = this.getStatus(sessionId);
    if (!status.pendingAction || status.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    this.sessions.update(sessionId, {
      mode: 'chat',
      pendingAction: undefined,
      trust: { level: 'untrusted', label: 'Generated code is untrusted by default' },
    });
    this.emit(sessionId, { type: 'action.cancelled', sessionId, actionId });
  }

  private emit(sessionId: string, event: TuiBridgeEvent): void {
    this.stream.emit(sessionId, event);
  }
}
