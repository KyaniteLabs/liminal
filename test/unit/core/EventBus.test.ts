import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import eventBus, { EventTypes, type BusEvent } from '../../../src/core/EventBus.js';

describe('EventBus', () => {
  let listener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listener = vi.fn();
    // Clean up any previous listeners
    eventBus.offEvent(listener);
    eventBus.removeAllListeners();
    eventBus.onEvent(listener);
  });

  describe('emit (string overload)', () => {
    it('emits event with type, source, data', () => {
      eventBus.emit('test:event', 'TestSource', { key: 'value' });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as BusEvent;
      expect(event.type).toBe('test:event');
      expect(event.source).toBe('TestSource');
      expect(event.data).toEqual({ key: 'value' });
      expect(event.timestamp).toBeTruthy();
    });

    it('defaults source to "unknown" when not provided', () => {
      eventBus.emit('test:event', undefined as any, {});

      const event = listener.mock.calls[0][0] as BusEvent;
      expect(event.source).toBe('unknown');
    });

    it('defaults data to empty object', () => {
      eventBus.emit('test:event', 'src');

      const event = listener.mock.calls[0][0] as BusEvent;
      expect(event.data).toEqual({});
    });

    it('generates ISO timestamp', () => {
      const before = new Date().toISOString();
      eventBus.emit('test', 'src', {});
      const after = new Date().toISOString();

      const event = listener.mock.calls[0][0] as BusEvent;
      expect(event.timestamp >= before).toBe(true);
      expect(event.timestamp <= after).toBe(true);
    });
  });

  describe('emit (object overload)', () => {
    it('emits a pre-built BusEvent', () => {
      const busEvent: BusEvent = {
        type: 'custom:event',
        source: 'CustomSource',
        data: { foo: 'bar' },
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      eventBus.emit(busEvent);

      expect(listener).toHaveBeenCalledTimes(1);
      const received = listener.mock.calls[0][0] as BusEvent;
      expect(received.type).toBe('custom:event');
      expect(received.source).toBe('CustomSource');
    });
  });

  describe('onEvent / offEvent', () => {
    it('receives multiple events', () => {
      eventBus.emit('event1', 'src', {});
      eventBus.emit('event2', 'src', {});

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('stops receiving after offEvent', () => {
      eventBus.emit('first', 'src', {});
      expect(listener).toHaveBeenCalledTimes(1);

      eventBus.offEvent(listener);
      eventBus.emit('second', 'src', {});
      expect(listener).toHaveBeenCalledTimes(1); // Still 1
    });

    it('supports multiple listeners', () => {
      const listener2 = vi.fn();
      eventBus.onEvent(listener2);

      eventBus.emit('event', 'src', {});

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      eventBus.offEvent(listener2);
    });
  });

  describe('getRecentEvents', () => {
    it('returns events that were emitted', () => {
      eventBus.emit('event1', 'src', { a: 1 });
      eventBus.emit('event2', 'src', { b: 2 });

      const recent = eventBus.getRecentEvents();
      // May include events from other tests since this is a singleton
      const types = recent.map((e: BusEvent) => e.type);
      expect(types).toContain('event1');
      expect(types).toContain('event2');
    });

    it('returns a copy', () => {
      eventBus.emit('test_copy', 'src', {});
      const copy = eventBus.getRecentEvents();
      const lenBefore = copy.length;
      copy.push({ type: 'fake', source: 'x', data: {}, timestamp: '' });
      expect(eventBus.getRecentEvents()).toHaveLength(lenBefore);
    });
  });

  describe('EventTypes constants', () => {
    it('has correct event type strings', () => {
      expect(EventTypes.PROCESS_START).toBe('process:start');
      expect(EventTypes.PROCESS_END).toBe('process:end');
      expect(EventTypes.PROCESS_PROGRESS).toBe('process:progress');
      expect(EventTypes.LLM_REQUEST).toBe('llm:request');
      expect(EventTypes.LLM_RESPONSE).toBe('llm:response');
      expect(EventTypes.COMPOST_STAGE).toBe('compost:stage');
      expect(EventTypes.COMPOST_COLLISION).toBe('compost:collision');
      expect(EventTypes.COMPOST_SCORE).toBe('compost:score');
      expect(EventTypes.COMPOST_SEED).toBe('compost:seed');
      expect(EventTypes.LOOP_ITERATION).toBe('loop:iteration');
      expect(EventTypes.LOOP_EVALUATION).toBe('loop:evaluation');
      expect(EventTypes.SWARM_ROUND).toBe('swarm:round');
      expect(EventTypes.RENDER_SCREENSHOT).toBe('render:screenshot');
      expect(EventTypes.EXPORT_PROGRESS).toBe('export:progress');
    });

    it('has all expected keys', () => {
      const keys = Object.keys(EventTypes);
      expect(keys.length).toBeGreaterThanOrEqual(13);
    });
  });

  describe('TUI mode', () => {
    afterEach(() => {
      eventBus.disableTuiMode();
    });

    it('enables TUI mode', () => {
      eventBus.enableTuiMode();
      expect(eventBus.isTuiMode()).toBe(true);
    });

    it('disables TUI mode', () => {
      eventBus.enableTuiMode();
      expect(eventBus.isTuiMode()).toBe(true);
      eventBus.disableTuiMode();
      expect(eventBus.isTuiMode()).toBe(false);
    });

    it('toggles TUI mode multiple times without deadlock', () => {
      for (let i = 0; i < 10; i++) {
        eventBus.enableTuiMode();
        eventBus.disableTuiMode();
      }
      expect(eventBus.isTuiMode()).toBe(false);
    });
  });

  describe('null/invalid listener handling', () => {
    it('onEvent with null does not register', () => {
      const result = eventBus.onEvent(null as any);
      expect(result).toBe(eventBus);
    });

    it('onEvent with undefined does not register', () => {
      const result = eventBus.onEvent(undefined as any);
      expect(result).toBe(eventBus);
    });

    it('offEvent with null returns safely', () => {
      const result = eventBus.offEvent(null as any);
      expect(result).toBe(eventBus);
    });
  });

  describe('listener error handling', () => {
    it('catches listener errors without crashing', () => {
      const badListener = vi.fn(() => {
        throw new Error('listener exploded');
      });
      eventBus.onEvent(badListener);

      // Should not throw — error is caught internally
      expect(() => eventBus.emit('test:error', 'src', {})).not.toThrow();
      expect(badListener).toHaveBeenCalled();

      eventBus.offEvent(badListener);
    });
  });

  describe('circular buffer overflow', () => {
    it('handles more events than MAX_RECENT by overwriting oldest', () => {
      // Use the existing singleton — emit enough to fill the ring buffer
      for (let i = 0; i < 250; i++) {
        eventBus.emit('overflow:test', 'src', { index: i });
      }
      const recent = eventBus.getRecentEvents();
      // Ring buffer caps at 200
      expect(recent.length).toBeLessThanOrEqual(200);
      // Latest events should be present
      const indices = recent
        .filter((e: BusEvent) => e.type === 'overflow:test')
        .map((e: BusEvent) => (e.data as { index: number }).index);
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[indices.length - 1]).toBe(249);
    });
  });

  describe('offEvent fallback path', () => {
    it('removes a listener that was not registered via onEvent', () => {
      // Register directly on the underlying emitter
      const rawListener = vi.fn();
      (eventBus as any).on('event', rawListener);

      // offEvent should fall through to the fallback super.off path
      eventBus.offEvent(rawListener);

      eventBus.emit('fallback:test', 'src', {});
      expect(rawListener).not.toHaveBeenCalled();
    });
  });

  describe('real event emission patterns', () => {
    it('emits PROCESS_START and PROCESS_END', () => {
      eventBus.emit(EventTypes.PROCESS_START, 'RalphLoop', { process: 'evolution' });
      eventBus.emit(EventTypes.PROCESS_END, 'RalphLoop', { process: 'evolution', success: true });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('emits LLM_RESPONSE events', () => {
      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: 'ollama',
        model: 'llama3.2',
        success: true,
        latencyMs: 60,
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as BusEvent;
      expect(event.data.provider).toBe('ollama');
    });

    it('emits COMPOST_STAGE events', () => {
      eventBus.emit(EventTypes.COMPOST_STAGE, 'CompostMill', { stage: 'extract', message: 'Extracting files' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits LOOP_ITERATION events', () => {
      eventBus.emit(EventTypes.LOOP_ITERATION, 'RalphLoop', { iteration: 1, score: 0.85 });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
