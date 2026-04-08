import { describe, it, expect, vi, beforeEach } from 'vitest';
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
