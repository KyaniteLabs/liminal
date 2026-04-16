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

  it('unsubscribe removes listener', () => {
    const listener = vi.fn();
    const unsub = stream.subscribe('s1', listener);
    unsub();
    stream.emit('s1', makeEvent('a'));
    expect(listener).not.toHaveBeenCalled();
  });
});
