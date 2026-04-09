import { TuiEventStream } from './TuiEventStream.js';
import { TuiSessionStore } from './TuiSessionStore.js';
import type { TuiBridgeEvent, TuiInputRequest, TuiPendingAction, TuiSessionStatus } from './types.js';

const SYSTEM_PROMPT = `You are Liminal, a creative coding partner. You help users generate p5.js sketches, Strudel music patterns, and other creative code. Be concise, helpful, and creative. When users describe what they want, respond with encouragement and relevant code or ideas.`;

export class TuiBridgeService {
  private sessions = new TuiSessionStore();
  private stream = new TuiEventStream();
  private activeStreams = new Map<string, AbortController>();

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

  async submitInput(sessionId: string, input: TuiInputRequest, llm?: { stream(systemPrompt: string, userPrompt: string, signal?: AbortSignal): AsyncGenerator<string> }): Promise<{ reviewRequired: boolean }> {
    // Cancel any in-flight stream for this session
    this.cancelStream(sessionId);

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

    // Chat mode — stream LLM response if available, otherwise echo
    this.emit(sessionId, { type: 'response.started', sessionId });

    if (llm) {
      // Fire-and-forget streaming — the SSE events carry the chunks
      this.streamLlmResponse(sessionId, input.text, llm).catch((err) => {
        this.emit(sessionId, {
          type: 'error',
          sessionId,
          message: err instanceof Error ? err.message : String(err),
        });
      });
      return { reviewRequired: false };
    }

    // Fallback: echo without LLM
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

  private async streamLlmResponse(sessionId: string, userText: string, llm: { stream(systemPrompt: string, userPrompt: string, signal?: AbortSignal): AsyncGenerator<string> }): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    let fullContent = '';
    try {
      for await (const chunk of llm.stream(SYSTEM_PROMPT, userText, controller.signal)) {
        fullContent += chunk;
        this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
      }

      this.emit(sessionId, { type: 'response.completed', sessionId, content: fullContent });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: fullContent });
      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: fullContent.slice(0, 60),
        }),
      });
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  private cancelStream(sessionId: string): void {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
    }
  }

  private emit(sessionId: string, event: TuiBridgeEvent): void {
    this.stream.emit(sessionId, event);
  }
}
