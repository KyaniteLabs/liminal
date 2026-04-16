import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CortexPerceptionBus } from '../../../src/cortex/CortexPerceptionBus.js';
import { EventTypes } from '../../../src/core/EventBus.js';
import type { BusEvent } from '../../../src/core/EventBus.js';

describe('CortexPerceptionBus', () => {
  let handler: ((event: BusEvent) => void) | null = null;
  let bus: CortexPerceptionBus;

  const mockEventBus = {
    onEvent: vi.fn((h: (event: BusEvent) => void) => {
      handler = h;
    }),
    offEvent: vi.fn((h: (event: BusEvent) => void) => {
      if (handler === h) handler = null;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handler = null;
    bus = new CortexPerceptionBus(mockEventBus);
  });

  function emit(event: BusEvent): void {
    if (handler) handler(event);
  }

  function makeEvent(type: string, data: Record<string, unknown> = {}): BusEvent {
    return { type, source: 'test', data, timestamp: new Date().toISOString() };
  }

  it('starts with empty snapshot', () => {
    const snapshot = bus.getSnapshot();
    expect(snapshot.taskPipeline.pending).toBe(0);
    expect(snapshot.taskPipeline.completed).toBe(0);
    expect(snapshot.llmHealth.avgLatencyMs).toBe(0);
    expect(snapshot.scoreTrend.average).toBe(0);
    expect(snapshot.scoreTrend.count).toBe(0);
    expect(snapshot.activeProcesses).toHaveLength(0);
    expect(snapshot.eventsProcessed).toBe(0);
  });

  it('subscribes to EventBus on start', () => {
    bus.start();
    expect(mockEventBus.onEvent).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on stop', () => {
    bus.start();
    bus.stop();
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.8 }));
    expect(bus.getSnapshot().eventsProcessed).toBe(0);
  });

  it('does not double-subscribe on repeated start calls', () => {
    bus.start();
    bus.start();
    expect(mockEventBus.onEvent).toHaveBeenCalledTimes(1);
  });

  it('tracks process start/end with inProgress counter', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'ralph-loop' }));
    expect(bus.getSnapshot().activeProcesses).toHaveLength(1);
    expect(bus.getSnapshot().activeProcesses[0].name).toBe('ralph-loop');
    expect(bus.getSnapshot().taskPipeline.inProgress).toBe(1);
    emit(makeEvent(EventTypes.PROCESS_END, { process: 'ralph-loop', success: true }));
    expect(bus.getSnapshot().activeProcesses).toHaveLength(0);
    expect(bus.getSnapshot().taskPipeline.completed).toBe(1);
    expect(bus.getSnapshot().taskPipeline.inProgress).toBe(0);
  });

  it('tracks failed process end with failure breakdown', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'ralph-loop' }));
    emit(makeEvent(EventTypes.PROCESS_END, { process: 'ralph-loop', success: false, errorClass: 'timeout' }));
    expect(bus.getSnapshot().taskPipeline.failed).toBe(1);
    expect(bus.getSnapshot().taskPipeline.completed).toBe(0);
    expect(bus.getSnapshot().taskPipeline.inProgress).toBe(0);
    expect(bus.getSnapshot().taskPipeline.failureBreakdown.timeout).toBe(1);
  });

  it('computes acceptance rate', () => {
    bus.start();
    for (let i = 0; i < 3; i++) {
      emit(makeEvent(EventTypes.PROCESS_START, { process: 'ralph-loop' }));
      emit(makeEvent(EventTypes.PROCESS_END, { process: 'ralph-loop', success: true }));
    }
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'ralph-loop' }));
    emit(makeEvent(EventTypes.PROCESS_END, { process: 'ralph-loop', success: false }));
    const pipeline = bus.getSnapshot().taskPipeline;
    expect(pipeline.acceptanceRate).toBeCloseTo(0.75, 4);
  });

  it('tracks LLM latency', () => {
    bus.start();
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 100 }));
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 200 }));
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 300 }));
    expect(bus.getSnapshot().llmHealth.avgLatencyMs).toBe(200);
  });

  it('tracks LLM success rate', () => {
    bus.start();
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 100 }));
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: false, latencyMs: 50, error: 'timeout' }));
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 150 }));
    expect(bus.getSnapshot().llmHealth.successRate).toBeCloseTo(2 / 3, 4);
    expect(bus.getSnapshot().llmHealth.recentErrorCount).toBe(1);
    expect(bus.getSnapshot().llmHealth.lastError).toBe('timeout');
  });

  it('tracks active provider and model from LLM requests', () => {
    bus.start();
    emit(makeEvent(EventTypes.LLM_REQUEST, { provider: 'minimax', model: 'm2.7' }));
    expect(bus.getSnapshot().llmHealth.activeProvider).toBe('minimax');
    expect(bus.getSnapshot().llmHealth.activeModel).toBe('m2.7');
  });

  it('tracks score trend from loop iterations', () => {
    bus.start();
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.5, iteration: 1 }));
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.7, iteration: 2 }));
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.9, iteration: 3 }));
    const trend = bus.getSnapshot().scoreTrend;
    expect(trend.count).toBe(3);
    expect(trend.average).toBeCloseTo(0.7, 4);
    expect(trend.scores).toEqual([0.5, 0.7, 0.9]);
  });

  it('bounds score window to 20 entries', () => {
    bus.start();
    for (let i = 0; i < 25; i++) {
      emit(makeEvent(EventTypes.LOOP_ITERATION, { score: i * 0.04, iteration: i }));
    }
    expect(bus.getSnapshot().scoreTrend.count).toBe(20);
    expect(bus.getSnapshot().scoreTrend.scores[0]).toBeCloseTo(0.2, 2);
  });

  it('bounds latency window to 20 entries', () => {
    bus.start();
    for (let i = 0; i < 25; i++) {
      emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: i * 10 }));
    }
    expect(bus.getSnapshot().llmHealth.avgLatencyMs).toBeGreaterThan(0);
    expect(bus.getSnapshot().llmHealth.avgLatencyMs).toBe(145);
  });

  it('counts events processed', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'a' }));
    emit(makeEvent(EventTypes.LLM_REQUEST, {}));
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.5 }));
    emit(makeEvent('unknown:type', {}));
    expect(bus.getSnapshot().eventsProcessed).toBe(4);
  });

  it('reset clears all state', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'ralph-loop' }));
    emit(makeEvent(EventTypes.LLM_RESPONSE, { success: true, latencyMs: 100 }));
    emit(makeEvent(EventTypes.LOOP_ITERATION, { score: 0.8 }));
    bus.reset();
    const snapshot = bus.getSnapshot();
    expect(snapshot.taskPipeline.completed).toBe(0);
    expect(snapshot.llmHealth.avgLatencyMs).toBe(0);
    expect(snapshot.scoreTrend.count).toBe(0);
    expect(snapshot.activeProcesses).toHaveLength(0);
    expect(snapshot.eventsProcessed).toBe(0);
  });

  it('snapshot timestamp is recent', () => {
    const before = new Date().toISOString();
    const snapshot = bus.getSnapshot();
    const after = new Date().toISOString();
    expect(snapshot.timestamp >= before).toBe(true);
    expect(snapshot.timestamp <= after).toBe(true);
  });

  it('tracks all process outcomes, not just ralph-loop', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_START, { process: 'compost-soup' }));
    emit(makeEvent(EventTypes.PROCESS_END, { process: 'compost-soup', success: true }));
    expect(bus.getSnapshot().activeProcesses).toHaveLength(0);
    expect(bus.getSnapshot().taskPipeline.completed).toBe(1);
    expect(bus.getSnapshot().taskPipeline.inProgress).toBe(0);
  });

  it('inProgress never goes negative from late end events', () => {
    bus.start();
    emit(makeEvent(EventTypes.PROCESS_END, { process: 'ghost', success: true }));
    expect(bus.getSnapshot().taskPipeline.inProgress).toBe(0);
    expect(bus.getSnapshot().taskPipeline.completed).toBe(1);
  });
});
