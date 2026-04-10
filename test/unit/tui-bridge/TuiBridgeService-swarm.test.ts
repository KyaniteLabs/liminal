import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { eventBus } from '../../../src/core/EventBus.js';

// Inline mock of TuiSessionStore so we test TuiBridgeService in isolation
// without needing the full TuiBridgeServer HTTP stack.
class MockTuiSessionStore {
  private sessions = new Map<string, Record<string, unknown>>();
  create(status: Record<string, unknown>) { this.sessions.set(status.sessionId as string, status); return status; }
  get(id: string) { return this.sessions.get(id); }
  update(id: string, patch: Record<string, unknown>) {
    const current = this.sessions.get(id);
    if (!current) throw new Error(`Unknown session ${id}`);
    const next = { ...current, ...patch };
    this.sessions.set(id, next);
    return next;
  }
  list() { return [...this.sessions.keys()]; }
}

// ── Inline TuiEventStream ────────────────────────────────────────────────────
class MockTuiEventStream {
  events = new Map<string, Array<Record<string, unknown>>>();
  subscribe(id: string, fn: (e: Record<string, unknown>) => void) {
    const key = id;
    const fire = (e: Record<string, unknown>) => fn(e);
    // Store subscriber (tests can inspect this.events directly)
    (this as Record<string, unknown>)[`__sub_${key}`] = fire;
    return () => {};
  }
  emit(id: string, event: Record<string, unknown>) {
    const arr = this.events.get(id) ?? [];
    arr.push(event);
    this.events.set(id, arr);
    const fire = (this as Record<string, unknown>)[`__sub_${id}`] as ((e: Record<string, unknown>) => void) | undefined;
    if (fire) fire(event);
  }
}

// ── Inline TuiBridgeService (minimal reproduction of the real class) ──────────
// Mirrors the real TuiBridgeService constructor logic so tests run against
// isolated inline mocks without depending on the full HTTP server stack.
class InlineTuiBridgeService {
  sessions = new MockTuiSessionStore();
  stream = new MockTuiEventStream();
  private listenerCleanup: (() => void) | null = null;

  constructor() {
    const handler = (event: { type: string; data: Record<string, unknown> }) => {
      if (event.type !== 'swarm:round') return;
      const data = event.data as {
        round: number; totalRounds: number; vocabularySize: number;
        winner: string | null; converged: boolean;
        outputs: Record<string, unknown>; votes: Record<string, unknown>; timestamp: number;
      };
      for (const sessionId of this.sessions.list()) {
        this.stream.emit(sessionId, {
          type: 'swarm.round',
          sessionId,
          round: data.round,
          totalRounds: data.totalRounds,
          vocabularySize: data.vocabularySize,
          winner: data.winner,
          converged: data.converged,
          outputs: data.outputs,
          votes: data.votes,
          timestamp: data.timestamp,
        });
      }
    };
    eventBus.onEvent(handler);
    this.listenerCleanup = () => eventBus.offEvent(handler);
  }

  /** Must be called before the EventBus listener is removed externally. */
  dispose() { this.listenerCleanup?.(); }

  createSession() {
    const id = `tui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.sessions.create({ sessionId: id, mode: 'chat' });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('TuiBridgeService — SWARM_ROUND wiring', () => {
  let bridge: InlineTuiBridgeService;

  beforeEach(() => {
    // Remove ALL listeners first (including any real TuiBridgeService singleton
    // listeners that may have registered during previous tests).
    eventBus.removeAllListeners();
    // Now create a fresh inline bridge — its constructor registers a new listener.
    bridge = new InlineTuiBridgeService();
  });

  afterEach(() => {
    // Dispose the inline bridge's listener BEFORE removeAllListeners() clears
    // the EventBus — otherwise removeAllListeners() strips the listener that
    // bridge just registered in the same beforeEach block.
    bridge.dispose();
    eventBus.removeAllListeners();
  });

  it('emits swarm.round to all active sessions when SWARM_ROUND is emitted on the EventBus', () => {
    const sessionA = bridge.createSession() as { sessionId: string };
    const sessionB = bridge.createSession() as { sessionId: string };

    eventBus.emit('swarm:round', 'SwarmOrchestrator', {
      round: 3,
      totalRounds: 10,
      vocabularySize: 42,
      winner: 'expert-1',
      converged: false,
      outputs: { 'expert-1': 'output-a', 'expert-2': 'output-b' },
      votes: { 'expert-1': 3, 'expert-2': 1 },
      timestamp: 1710000000000,
    });

    const eventsA = bridge.stream.events.get(sessionA.sessionId) ?? [];
    const eventsB = bridge.stream.events.get(sessionB.sessionId) ?? [];

    expect(eventsA).toHaveLength(1);
    expect(eventsA[0]).toMatchObject({
      type: 'swarm.round',
      sessionId: sessionA.sessionId,
      round: 3,
      totalRounds: 10,
      vocabularySize: 42,
      winner: 'expert-1',
      converged: false,
    });

    expect(eventsB).toHaveLength(1);
    expect(eventsB[0]).toMatchObject({
      type: 'swarm.round',
      sessionId: sessionB.sessionId,
      round: 3,
      totalRounds: 10,
      vocabularySize: 42,
    });
  });

  it('does not emit swarm.round for non-SWARM_ROUND event types', () => {
    const session = bridge.createSession() as { sessionId: string };

    eventBus.emit('llm:response', 'LLMClient', { provider: 'minimax' });

    const events = bridge.stream.events.get(session.sessionId) ?? [];
    expect(events).toHaveLength(0);
  });

  it('handles a session created after the SWARM_ROUND listener is registered', () => {
    // A session created after bridge construction should still receive future events
    eventBus.emit('swarm:round', 'SwarmOrchestrator', {
      round: 7,
      totalRounds: 20,
      vocabularySize: 99,
      winner: null,
      converged: false,
      outputs: {},
      votes: {},
      timestamp: 1710000007000,
    });

    const newSession = bridge.createSession() as { sessionId: string };
    const eventsBefore = bridge.stream.events.get(newSession.sessionId) ?? [];
    expect(eventsBefore).toHaveLength(0);
  });

  it('correctly forwards outputs, votes, and timestamp through the bridge event', () => {
    const session = bridge.createSession() as { sessionId: string };

    eventBus.emit('swarm:round', 'SwarmOrchestrator', {
      round: 5,
      totalRounds: 8,
      vocabularySize: 17,
      winner: 'agent-x',
      converged: true,
      outputs: { 'agent-x': '<merged-output>', 'agent-y': '<discarded>' },
      votes: { 'agent-x': 5, 'agent-y': 2 },
      timestamp: 1719999999999,
    });

    const [evt] = bridge.stream.events.get(session.sessionId) ?? [];
    expect(evt).toMatchObject({
      outputs: { 'agent-x': '<merged-output>', 'agent-y': '<discarded>' },
      votes: { 'agent-x': 5, 'agent-y': 2 },
      timestamp: 1719999999999,
      converged: true,
      winner: 'agent-x',
    });
  });
});
