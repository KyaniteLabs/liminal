import { describe, it, expect, beforeEach } from 'vitest';
import { TelemetryAggregator, type GenerationTelemetry } from '../../src/core/TelemetryAggregator.js';

describe('TelemetryAggregator.getTrends', () => {
  let aggregator: TelemetryAggregator;

  beforeEach(() => {
    aggregator = new TelemetryAggregator();
  });

  it('returns daily buckets with correct success rates across 3 days', () => {
    const generations: GenerationTelemetry[] = [
      // Day 1: 3 total, 2 successful
      { id: '1', timestamp: '2026-04-01T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p1', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '2', timestamp: '2026-04-01T12:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p2', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '3', timestamp: '2026-04-01T14:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p3', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: false, validationErrors: ['err'], success: false },
      // Day 2: 4 total, 3 successful
      { id: '4', timestamp: '2026-04-02T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p4', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '5', timestamp: '2026-04-02T11:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p5', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '6', timestamp: '2026-04-02T12:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p6', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '7', timestamp: '2026-04-02T13:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p7', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: false, validationErrors: ['err'], success: false },
      // Day 3: 3 total, 1 successful
      { id: '8', timestamp: '2026-04-03T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p8', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '9', timestamp: '2026-04-03T11:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p9', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: false, validationErrors: ['err'], success: false },
      { id: '10', timestamp: '2026-04-03T12:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p10', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: false, validationErrors: ['err'], success: false },
    ];

    aggregator.loadData({ generations });
    const result = aggregator.getTrends();

    expect(result.buckets).toHaveLength(3);
    expect(result.buckets[0]).toEqual({ date: '2026-04-01', total: 3, successful: 2, successRate: 2 / 3 });
    expect(result.buckets[1]).toEqual({ date: '2026-04-02', total: 4, successful: 3, successRate: 3 / 4 });
    expect(result.buckets[2]).toEqual({ date: '2026-04-03', total: 3, successful: 1, successRate: 1 / 3 });
  });

  it('filters by model when model option is provided', () => {
    const generations: GenerationTelemetry[] = [
      { id: '1', timestamp: '2026-04-01T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p1', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '2', timestamp: '2026-04-01T12:00:00Z', domain: 'p5', modelId: 'model-b', provider: 'lm', prompt: 'p2', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: false },
      { id: '3', timestamp: '2026-04-02T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p3', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
    ];

    aggregator.loadData({ generations });
    const result = aggregator.getTrends({ model: 'model-a' });

    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0]).toEqual({ date: '2026-04-01', total: 1, successful: 1, successRate: 1 });
    expect(result.buckets[1]).toEqual({ date: '2026-04-02', total: 1, successful: 1, successRate: 1 });
  });

  it('filters by domain when domain option is provided', () => {
    const generations: GenerationTelemetry[] = [
      { id: '1', timestamp: '2026-04-01T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p1', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '2', timestamp: '2026-04-01T12:00:00Z', domain: 'glsl', modelId: 'model-a', provider: 'lm', prompt: 'p2', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: false },
      { id: '3', timestamp: '2026-04-02T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p3', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
    ];

    aggregator.loadData({ generations });
    const result = aggregator.getTrends({ domain: 'p5' });

    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0]).toEqual({ date: '2026-04-01', total: 1, successful: 1, successRate: 1 });
    expect(result.buckets[1]).toEqual({ date: '2026-04-02', total: 1, successful: 1, successRate: 1 });
  });

  it('returns empty buckets array when no data exists', () => {
    const result = aggregator.getTrends();
    expect(result.buckets).toEqual([]);
  });

  it('filters by date range when startDate and endDate are provided', () => {
    const generations: GenerationTelemetry[] = [
      { id: '1', timestamp: '2026-04-01T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p1', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '2', timestamp: '2026-04-02T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p2', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '3', timestamp: '2026-04-03T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p3', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
    ];

    aggregator.loadData({ generations });
    const result = aggregator.getTrends({ startDate: '2026-04-02', endDate: '2026-04-02' });

    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]).toEqual({ date: '2026-04-02', total: 1, successful: 1, successRate: 1 });
  });

  it('groups by week when granularity is week', () => {
    const generations: GenerationTelemetry[] = [
      // Week 14 (Mar 30 - Apr 5, 2026)
      { id: '1', timestamp: '2026-03-30T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p1', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      { id: '2', timestamp: '2026-04-01T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p2', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: true },
      // Week 15 (Apr 6 - Apr 12, 2026)
      { id: '3', timestamp: '2026-04-06T10:00:00Z', domain: 'p5', modelId: 'model-a', provider: 'lm', prompt: 'p3', generationTimeMs: 1000, outputSizeBytes: 500, validationPassed: true, validationErrors: [], success: false },
    ];

    aggregator.loadData({ generations });
    const result = aggregator.getTrends({ granularity: 'week' });

    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0]).toEqual({ date: '2026-W14', total: 2, successful: 2, successRate: 1 });
    expect(result.buckets[1]).toEqual({ date: '2026-W15', total: 1, successful: 0, successRate: 0 });
  });
});
