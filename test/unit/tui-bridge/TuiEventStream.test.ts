import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TuiEventStream } from '../../../src/tui-bridge/TuiEventStream.js';
import type { TuiBridgeEvent } from '../../../src/tui-bridge/types.js';

describe('TuiEventStream', () => {
  let stream: TuiEventStream;

  const makeEvent = (type: string): TuiBridgeEvent =>
    ({ type, sessionId: 's1' } as TuiBridgeEvent);

  beforeEach(() => {
    stream = new TuiEventStream();
  });

  it('retains only the configured replay window while keeping event IDs monotonic', () => {
    stream = new TuiEventStream({ maxStoredEventsPerSession: 2 });
    stream.emit('s1', makeEvent('a'));
    stream.emit('s1', makeEvent('b'));
    stream.emit('s1', makeEvent('c'));

    expect(stream.getEvents('s1').map((event) => event.type)).toEqual(['b', 'c']);
    expect(stream.getEventsSince('s1', 0).map((stored) => stored.id)).toEqual([2, 3]);
    expect(stream.getEventsSince('s1', 2).map((stored) => stored.id)).toEqual([3]);
  });

  it('retains replay-critical lifecycle, provenance, terminal status, and errors across long content streams', () => {
    stream = new TuiEventStream({ maxStoredEventsPerSession: 5 });

    stream.emit('s1', {
      type: 'run.lifecycle',
      sessionId: 's1',
      run: {
        runId: 'run-1',
        kind: 'creative',
        phase: 'generating',
        label: 'Generate p5 sketch',
        startedAt: '2026-05-06T00:00:00.000Z',
        updatedAt: '2026-05-06T00:00:00.000Z',
        executor: 'ralph-loop',
        provider: 'test-provider',
        model: 'test-model',
      },
    });
    stream.emit('s1', {
      type: 'generation.route.selected',
      sessionId: 's1',
      domain: 'p5',
      domains: ['p5'],
      requestedDomain: 'p5',
      selectedDomain: 'p5',
      promptDomainLocked: true,
      source: 'prompt',
    });
    stream.emit('s1', {
      type: 'response.metadata',
      sessionId: 's1',
      model: 'test-model',
      duration: 120,
      tokenCount: 42,
    });

    for (let i = 0; i < 20; i++) {
      stream.emit('s1', { type: 'response.delta', sessionId: 's1', delta: `chunk-${i}` });
    }

    stream.emit('s1', {
      type: 'error',
      sessionId: 's1',
      message: 'provider timed out',
      provider: 'test-provider',
      model: 'test-model',
      endpoint: 'https://example.invalid/v1/chat/completions',
      errorSource: 'provider',
    });
    stream.emit('s1', {
      type: 'run.lifecycle',
      sessionId: 's1',
      run: {
        runId: 'run-1',
        kind: 'creative',
        phase: 'failed',
        label: 'Generate p5 sketch',
        startedAt: '2026-05-06T00:00:00.000Z',
        updatedAt: '2026-05-06T00:00:05.000Z',
        failedAt: '2026-05-06T00:00:05.000Z',
        outcome: 'failed',
        executor: 'ralph-loop',
        provider: 'test-provider',
        model: 'test-model',
        error: 'provider timed out',
      },
    });

    const replay = stream.replayAfter('s1', 0);
    const replayedTypes = replay.map((stored) => stored.event.type);

    expect(replayedTypes).toContain('generation.route.selected');
    expect(replayedTypes).toContain('response.metadata');
    expect(replayedTypes).toContain('error');
    expect(replayedTypes.filter((type) => type === 'run.lifecycle')).toHaveLength(2);
    expect(replayedTypes.filter((type) => type === 'response.delta')).toHaveLength(3);
    expect(replay.map((stored) => stored.id)).toEqual([...replay].map((stored) => stored.id).sort((a, b) => a - b));
  });

  it('emit stores event and notifies listener', () => {
    const listener = vi.fn();
    stream.subscribe('s1', listener);
    const event = makeEvent('response.delta');
    stream.emit('s1', event);
    expect(listener).toHaveBeenCalledWith(event);
    expect(stream.getEvents('s1')).toHaveLength(1);
  });

  it('emit does not notify listeners of other sessions', () => {
    const listener = vi.fn();
    stream.subscribe('s2', listener);
    stream.emit('s1', makeEvent('response.delta'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('emitEphemeral notifies listener but does NOT store event', () => {
    const listener = vi.fn();
    stream.subscribe('s1', listener);
    const event = makeEvent('cortex.snapshot');
    stream.emitEphemeral('s1', event);
    expect(listener).toHaveBeenCalledWith(event);
    expect(stream.getEvents('s1')).toHaveLength(0);
  });

  it('emitEphemeral does not grow event log after many calls', () => {
    const listener = vi.fn();
    stream.subscribe('s1', listener);
    for (let i = 0; i < 100; i++) {
      stream.emitEphemeral('s1', makeEvent('cortex.snapshot'));
    }
    expect(listener).toHaveBeenCalledTimes(100);
    expect(stream.getEvents('s1')).toHaveLength(0);
  });

  it('getEventsSince respects event IDs', () => {
    stream.emit('s1', makeEvent('a'));
    stream.emit('s1', makeEvent('b'));
    stream.emit('s1', makeEvent('c'));
    const since = stream.getEventsSince('s1', 1);
    expect(since).toHaveLength(2);
    expect(since[0].id).toBe(2);
    expect(since[1].id).toBe(3);
  });

  it('subscribeWithId receives stored events with IDs', () => {
    const idListener = vi.fn();
    stream.subscribeWithId('s1', idListener);
    stream.emit('s1', makeEvent('a'));
    expect(idListener).toHaveBeenCalledTimes(1);
    expect(idListener.mock.calls[0][0].id).toBe(1);
  });

  it('exposes a small publish and replay interface for transport adapters', () => {
    const storedListener = vi.fn();
    stream.subscribeStored('s1', storedListener);
    stream.publish('s1', makeEvent('a'));
    stream.publish('s1', makeEvent('b'));

    expect(stream.history('s1').map((event) => event.type)).toEqual(['a', 'b']);
    expect(stream.replayAfter('s1', 1).map((stored) => stored.event.type)).toEqual(['b']);
    expect(storedListener.mock.calls.map(([stored]) => stored.id)).toEqual([1, 2]);
  });

  it('unsubscribe removes listener', () => {
    const listener = vi.fn();
    const unsub = stream.subscribe('s1', listener);
    unsub();
    stream.emit('s1', makeEvent('a'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe cleans up empty listener set', () => {
    const listener = vi.fn();
    const unsub = stream.subscribe('s1', listener);
    unsub();
    // Re-subscribe should still work (verifies the Set was deleted, not corrupted)
    const listener2 = vi.fn();
    stream.subscribe('s1', listener2);
    stream.emit('s1', makeEvent('x'));
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe cleans up empty idListener set', () => {
    const idListener = vi.fn();
    const unsub = stream.subscribeWithId('s1', idListener);
    unsub();
    // Re-subscribe should still work
    const idListener2 = vi.fn();
    stream.subscribeWithId('s1', idListener2);
    stream.emit('s1', makeEvent('y'));
    expect(idListener2).toHaveBeenCalledTimes(1);
  });

  it('getEventsSince returns empty for unknown session', () => {
    const result = stream.getEventsSince('nonexistent', 0);
    expect(result).toEqual([]);
  });
});
