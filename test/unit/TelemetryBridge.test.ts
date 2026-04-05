import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted; must NOT reference outer-scope variables.
vi.mock('../../src/core/TelemetryAggregator.js', () => ({
  globalTelemetry: { record: vi.fn() },
}));
vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: { onEvent: vi.fn() },
  EventTypes: { LLM_RESPONSE: 'llm_response' },
}));

import { startTelemetryBridge, isTelemetryBridgeActive, recordThinkingTelemetry } from '../../src/core/TelemetryBridge.js';
import { globalTelemetry } from '../../src/core/TelemetryAggregator.js';

describe('TelemetryBridge', () => {
  beforeEach(() => {
    (globalTelemetry.record as ReturnType<typeof vi.fn>).mockClear();
  });

  it('records a thinking telemetry entry', () => {
    recordThinkingTelemetry({
      model: 'test-model',
      provider: 'test',
      domain: 'unit-test',
      prompt: 'hello',
      success: true,
      latencyMs: 50,
      outputSizeBytes: 100,
      traceId: 'trace-1',
      thinkingSource: 'extended',
      reasoningQuality: 0.9,
      reasoningLength: 200,
      detectedPatterns: ['chain-of-thought'],
      recoveredFromThinking: false,
    });
    expect(globalTelemetry.record).toHaveBeenCalledTimes(1);
    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.modelId).toBe('test-model');
    expect(recorded.success).toBe(true);
  });

  it('reports bridge active after start', () => {
    startTelemetryBridge();
    expect(isTelemetryBridgeActive()).toBe(true);
  });
});
