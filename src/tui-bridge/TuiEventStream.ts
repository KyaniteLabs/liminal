import type { TuiBridgeEvent } from './types.js';

export class TuiEventStream {
  private events = new Map<string, TuiBridgeEvent[]>();
  private listeners = new Map<string, Set<(event: TuiBridgeEvent) => void>>();

  emit(sessionId: string, event: TuiBridgeEvent): void {
    const current = this.events.get(sessionId) ?? [];
    current.push(event);
    this.events.set(sessionId, current);
    for (const listener of this.listeners.get(sessionId) ?? []) {
      listener(event);
    }
  }

  getEvents(sessionId: string): TuiBridgeEvent[] {
    return this.events.get(sessionId) ?? [];
  }

  subscribe(sessionId: string, listener: (event: TuiBridgeEvent) => void): () => void {
    const current = this.listeners.get(sessionId) ?? new Set();
    current.add(listener);
    this.listeners.set(sessionId, current);
    return () => {
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(sessionId);
    };
  }
}
