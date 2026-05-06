import type { TuiBridgeEvent } from './types.js';

export interface StoredEvent {
  id: number;
  event: TuiBridgeEvent;
}

export interface TuiEventStreamOptions {
  maxStoredEventsPerSession?: number;
}

export interface TuiRunEventReplay {
  replayAfter(sessionId: string, lastEventId: number): StoredEvent[];
  subscribeStored(sessionId: string, listener: (stored: StoredEvent) => void): () => void;
}

// Preserve enough state for reconnecting Studio clients to rebuild a run after
// high-frequency content chunks have rolled out of the replay tail.
const REPLAY_ANCHOR_EVENT_TYPES: ReadonlySet<TuiBridgeEvent['type']> = new Set([
  'run.lifecycle',
  'response.completed',
  'response.committed',
  'response.metadata',
  'status.updated',
  'trust.updated',
  'preview.completed',
  'preview.verified',
  'preview.missing',
  'generation.domain_truth',
  'generation.route.selected',
  'generation.domain_plan',
  'generation.attempt.failed',
  'generation.complete',
  'generation.cancelled',
  'generation.cognitive_receipt',
  'verification.completed',
  'session.turn',
  'task.completed',
  'video:render:complete',
  'video:render:error',
  'error',
]);

function isReplayAnchorEvent(event: TuiBridgeEvent): boolean {
  return REPLAY_ANCHOR_EVENT_TYPES.has(event.type);
}

export class TuiEventStream {
  private events = new Map<string, StoredEvent[]>();
  private nextIds = new Map<string, number>();
  private listeners = new Map<string, Set<(event: TuiBridgeEvent) => void>>();
  private idListeners = new Map<string, Set<(stored: StoredEvent) => void>>();
  private readonly maxStoredEventsPerSession: number;

  constructor(options: TuiEventStreamOptions = {}) {
    this.maxStoredEventsPerSession = Math.max(1, options.maxStoredEventsPerSession ?? 500);
  }

  publish(sessionId: string, event: TuiBridgeEvent): void {
    const current = this.events.get(sessionId) ?? [];
    const nextId = (this.nextIds.get(sessionId) ?? 0) + 1;
    this.nextIds.set(sessionId, nextId);
    const stored = { id: nextId, event };
    current.push(stored);
    this.events.set(sessionId, this.trimStoredEvents(current));
    for (const listener of this.listeners.get(sessionId) ?? []) {
      listener(event);
    }
    for (const listener of this.idListeners.get(sessionId) ?? []) {
      listener(stored);
    }
  }

  emit(sessionId: string, event: TuiBridgeEvent): void {
    this.publish(sessionId, event);
  }

  /**
   * Emit an ephemeral event — delivered to live listeners but NOT persisted
   * in the event log. Use for high-frequency status updates (e.g. cortex.snapshot)
   * that would grow the per-session array unbounded if stored every 5 seconds.
   */
  publishEphemeral(sessionId: string, event: TuiBridgeEvent): void {
    for (const listener of this.listeners.get(sessionId) ?? []) {
      listener(event);
    }
  }

  emitEphemeral(sessionId: string, event: TuiBridgeEvent): void {
    this.publishEphemeral(sessionId, event);
  }

  history(sessionId: string): TuiBridgeEvent[] {
    return (this.events.get(sessionId) ?? []).map((stored) => stored.event);
  }

  getEvents(sessionId: string): TuiBridgeEvent[] {
    return this.history(sessionId);
  }

  replayAfter(sessionId: string, lastEventId: number): StoredEvent[] {
    return (this.events.get(sessionId) ?? []).filter((stored) => stored.id > lastEventId);
  }

  getEventsSince(sessionId: string, lastEventId: number): StoredEvent[] {
    return this.replayAfter(sessionId, lastEventId);
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

  subscribeStored(sessionId: string, listener: (stored: StoredEvent) => void): () => void {
    const current = this.idListeners.get(sessionId) ?? new Set();
    current.add(listener);
    this.idListeners.set(sessionId, current);
    return () => {
      current.delete(listener);
      if (current.size === 0) this.idListeners.delete(sessionId);
    };
  }

  subscribeWithId(sessionId: string, listener: (stored: StoredEvent) => void): () => void {
    return this.subscribeStored(sessionId, listener);
  }

  private trimStoredEvents(events: StoredEvent[]): StoredEvent[] {
    if (events.length <= this.maxStoredEventsPerSession) {
      return events;
    }

    const tailStart = Math.max(0, events.length - this.maxStoredEventsPerSession);
    return events.filter((stored, index) => index >= tailStart || isReplayAnchorEvent(stored.event));
  }
}
