import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted; must NOT reference outer-scope variables.
vi.mock('../../src/core/TelemetryAggregator.js', () => ({
  globalTelemetry: { record: vi.fn() },
}));

const mockOnEvent = vi.fn();
vi.mock('../../src/core/EventBus.js', () => ({
  eventBus: { onEvent: (...args: any[]) => mockOnEvent(...args) },
  EventTypes: { LLM_RESPONSE: 'llm_response' },
}));

import { startTelemetryBridge, isTelemetryBridgeActive, recordThinkingTelemetry } from '../../src/core/TelemetryBridge.js';
import { globalTelemetry } from '../../src/core/TelemetryAggregator.js';

// Capture the callback from the first startTelemetryBridge() call.
// bridgeActive is module-level state — once set, subsequent calls are no-ops.
let capturedCallback: (event: any) => void | undefined;

describe('TelemetryBridge', () => {
  beforeEach(() => {
    (globalTelemetry.record as ReturnType<typeof vi.fn>).mockClear();
  });

  // ── These must run first to capture the callback ──
  it('registers event listener on first start', () => {
    startTelemetryBridge();
    expect(mockOnEvent).toHaveBeenCalled();
    capturedCallback = mockOnEvent.mock.calls[0][0];
    expect(typeof capturedCallback).toBe('function');
  });

  it('reports bridge active after start', () => {
    expect(isTelemetryBridgeActive()).toBe(true);
  });

  it('does not register listener again on second start (idempotent)', () => {
    const callsBefore = mockOnEvent.mock.calls.length;
    startTelemetryBridge();
    expect(mockOnEvent.mock.calls.length).toBe(callsBefore);
  });

  it('records telemetry when callback receives LLM_RESPONSE', () => {
    capturedCallback!({
      type: 'llm_response',
      timestamp: Date.now(),
      data: {
        domain: 'hydra',
        model: 'glm-4',
        provider: 'zhipuai',
        latencyMs: 1200,
        success: true,
        error: undefined,
        reasoningTraceId: 'trace-abc',
        thinkingSource: 'extended',
        reasoningQuality: 0.85,
        reasoningLength: 500,
        detectedPatterns: ['chain-of-thought', 'verification'],
        recoveredFromThinking: false,
      },
    });

    expect(globalTelemetry.record).toHaveBeenCalledTimes(1);
    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.domain).toBe('hydra');
    expect(recorded.modelId).toBe('glm-4');
    expect(recorded.provider).toBe('zhipuai');
    expect(recorded.generationTimeMs).toBe(1200);
    expect(recorded.validationPassed).toBe(true);
    expect(recorded.validationErrors).toEqual([]);
    expect(recorded.reasoningTraceId).toBe('trace-abc');
    expect(recorded.reasoningQuality).toBe(0.85);
  });

  it('includes error in validationErrors when success is false', () => {
    (globalTelemetry.record as ReturnType<typeof vi.fn>).mockClear();
    capturedCallback!({
      type: 'llm_response',
      timestamp: Date.now(),
      data: {
        domain: 'p5',
        model: 'qwen',
        provider: 'minimax',
        latencyMs: 300,
        success: false,
        error: 'timeout exceeded',
      },
    });

    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.validationPassed).toBe(false);
    expect(recorded.validationErrors).toEqual(['timeout exceeded']);
  });

  it('defaults domain to unknown when not provided', () => {
    (globalTelemetry.record as ReturnType<typeof vi.fn>).mockClear();
    capturedCallback!({
      type: 'llm_response',
      timestamp: Date.now(),
      data: {
        model: 'qwen',
        provider: 'test',
        latencyMs: 100,
        success: true,
      },
    });

    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.domain).toBe('unknown');
  });

  it('ignores non-LLM_RESPONSE events', () => {
    (globalTelemetry.record as ReturnType<typeof vi.fn>).mockClear();
    capturedCallback!({
      type: 'some_other_event',
      timestamp: Date.now(),
      data: {},
    });

    expect(globalTelemetry.record).not.toHaveBeenCalled();
  });

  // ── recordThinkingTelemetry tests (no module state dependency) ──

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
    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.modelId).toBe('test-model');
    expect(recorded.success).toBe(true);
  });

  it('records thinking telemetry with validation errors', () => {
    recordThinkingTelemetry({
      model: 'test-model',
      provider: 'test',
      domain: 'unit-test',
      prompt: 'hello world',
      success: false,
      latencyMs: 50,
      outputSizeBytes: 100,
      traceId: 'trace-2',
      thinkingSource: 'none',
      reasoningQuality: 0,
      reasoningLength: 0,
      detectedPatterns: [],
      recoveredFromThinking: true,
      validationErrors: ['syntax error', 'missing return'],
    });

    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.success).toBe(false);
    expect(recorded.validationErrors).toEqual(['syntax error', 'missing return']);
    expect(recorded.recoveredFromThinking).toBe(true);
  });

  it('truncates long prompts in thinking telemetry', () => {
    const longPrompt = 'x'.repeat(600);
    recordThinkingTelemetry({
      model: 'm',
      provider: 'p',
      domain: 'd',
      prompt: longPrompt,
      success: true,
      latencyMs: 10,
      outputSizeBytes: 10,
      traceId: 't',
      thinkingSource: 's',
      reasoningQuality: 0.5,
      reasoningLength: 100,
      detectedPatterns: [],
      recoveredFromThinking: false,
    });

    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.prompt.length).toBe(500);
  });

  it('defaults validationErrors to empty array when not provided', () => {
    recordThinkingTelemetry({
      model: 'm',
      provider: 'p',
      domain: 'd',
      prompt: 'test',
      success: true,
      latencyMs: 10,
      outputSizeBytes: 10,
      traceId: 't',
      thinkingSource: 's',
      reasoningQuality: 0.5,
      reasoningLength: 100,
      detectedPatterns: [],
      recoveredFromThinking: false,
    });

    const recorded = (globalTelemetry.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recorded.validationErrors).toEqual([]);
  });
});
