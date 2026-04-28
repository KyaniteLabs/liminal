import { describe, it, expect, beforeEach } from 'vitest';
import {
  TelemetryAggregator,
  globalTelemetry,
  type GenerationTelemetry,
} from '../../../src/core/TelemetryAggregator.js';

function makeTelemetry(overrides: Partial<GenerationTelemetry> = {}): GenerationTelemetry {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date('2026-03-15T12:00:00Z'),
    domain: 'p5',
    modelId: 'model-a',
    provider: 'test',
    prompt: 'test prompt',
    generationTimeMs: 1000,
    outputSizeBytes: 1500,
    validationPassed: true,
    validationErrors: [],
    success: true,
    ...overrides,
  };
}

describe('TelemetryAggregator', () => {
  let agg: TelemetryAggregator;

  beforeEach(() => {
    agg = new TelemetryAggregator();
  });

  // ── record() ─────────────────────────────────────────────────────────

  describe('record()', () => {
    it('stores a single telemetry entry', () => {
      agg.record(makeTelemetry());
      const data = agg.exportData();
      expect(data.summary.totalGenerations).toBe(1);
    });

    it('trims history when exceeding maxHistorySize', () => {
      // TelemetryAggregator has maxHistorySize=10000, test by creating a small subclass
      const small = new (class extends TelemetryAggregator {
        constructor() {
          super();
          // Access private field via bracket notation
          (this as any).maxHistorySize = 5;
        }
      })();

      for (let i = 0; i < 8; i++) {
        small.record(makeTelemetry({ id: `t-${i}` }));
      }

      const data = small.exportData();
      expect(data.summary.totalGenerations).toBe(5);
      // The last 5 should be kept (ids 3 through 7)
      expect(data.generations[0].id).toBe('t-3');
      expect(data.generations[4].id).toBe('t-7');
    });
  });

  // ── getModelStats() ─────────────────────────────────────────────────

  describe('getModelStats()', () => {
    it('returns zeroed stats when no data exists for model+domain', () => {
      const stats = agg.getModelStats('no-model', 'no-domain');
      expect(stats.totalGenerations).toBe(0);
      expect(stats.successfulGenerations).toBe(0);
      expect(stats.failedGenerations).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgGenerationTimeSeconds).toBe(0);
      expect(stats.avgOutputSizeBytes).toBe(0);
      expect(stats.avgUserRating).toBeUndefined();
      expect(stats.commonErrors).toEqual([]);
      expect(stats.qualityScore).toBe(0);
    });

    it('computes correct stats for a single generation', () => {
      agg.record(makeTelemetry({
        modelId: 'm1', domain: 'p5', success: true,
        generationTimeMs: 2000, outputSizeBytes: 600,
        userRating: 4,
      }));
      const stats = agg.getModelStats('m1', 'p5');
      expect(stats.totalGenerations).toBe(1);
      expect(stats.successfulGenerations).toBe(1);
      expect(stats.failedGenerations).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.avgGenerationTimeSeconds).toBe(2);
      expect(stats.avgOutputSizeBytes).toBe(600);
      expect(stats.avgUserRating).toBe(4);
    });

    it('computes quality score correctly with mixed success/failure', () => {
      agg.record(makeTelemetry({ modelId: 'm1', domain: 'p5', success: true, generationTimeMs: 1000, outputSizeBytes: 1000 }));
      agg.record(makeTelemetry({ modelId: 'm1', domain: 'p5', success: false, generationTimeMs: 3000, outputSizeBytes: 100 }));
      const stats = agg.getModelStats('m1', 'p5');
      expect(stats.successRate).toBe(0.5);
      expect(stats.successfulGenerations).toBe(1);
      expect(stats.failedGenerations).toBe(1);
      // Quality is a composite: successRate*0.4 + sizeScore*0.3 + timeScore*0.2 + ratingScore*0.1
      // With no userRating, ratingScore = 0.5
      expect(stats.qualityScore).toBeGreaterThan(0);
      expect(stats.qualityScore).toBeLessThan(1);
    });

    it('aggregates validation and general errors into commonErrors', () => {
      agg.record(makeTelemetry({
        modelId: 'm1', domain: 'p5', success: false,
        validationErrors: ['syntax error', 'syntax error'],
        error: 'timeout',
      }));
      agg.record(makeTelemetry({
        modelId: 'm1', domain: 'p5', success: false,
        validationErrors: ['syntax error'],
      }));
      const stats = agg.getModelStats('m1', 'p5');
      expect(stats.commonErrors[0]).toBe('syntax error');
      expect(stats.commonErrors).toContain('timeout');
      expect(stats.commonErrors.length).toBeLessThanOrEqual(5);
    });

    it('uses default minSize for unknown domains', () => {
      agg.record(makeTelemetry({
        modelId: 'm1', domain: 'unknown-domain', success: true,
        outputSizeBytes: 200,
      }));
      const stats = agg.getModelStats('m1', 'unknown-domain');
      expect(stats.totalGenerations).toBe(1);
      expect(stats.qualityScore).toBeGreaterThan(0);
    });

    it('computes avgUserRating as undefined when no ratings present', () => {
      agg.record(makeTelemetry({ modelId: 'm1', domain: 'p5', success: true }));
      const stats = agg.getModelStats('m1', 'p5');
      expect(stats.avgUserRating).toBeUndefined();
    });

    it('computes avgUserRating across multiple rated generations', () => {
      agg.record(makeTelemetry({ modelId: 'm1', domain: 'p5', success: true, userRating: 3 }));
      agg.record(makeTelemetry({ modelId: 'm1', domain: 'p5', success: true, userRating: 5 }));
      const stats = agg.getModelStats('m1', 'p5');
      expect(stats.avgUserRating).toBe(4);
    });
  });

  // ── getDomainStats() ────────────────────────────────────────────────

  describe('getDomainStats()', () => {
    it('returns empty stats for domain with no data', () => {
      const stats = agg.getDomainStats('no-domain');
      expect(stats.totalGenerations).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      expect(stats.bestModel).toBe('');
      expect(stats.avoidModels).toEqual([]);
      expect(stats.modelRankings).toEqual([]);
    });

    it('ranks models by quality score and identifies best/avoid models', () => {
      // Good model
      agg.record(makeTelemetry({ modelId: 'good', domain: 'p5', success: true, outputSizeBytes: 2000, generationTimeMs: 500, userRating: 5 }));
      // Bad model
      agg.record(makeTelemetry({ modelId: 'bad', domain: 'p5', success: false, outputSizeBytes: 50, generationTimeMs: 200000, validationErrors: ['fail'] }));
      // Also bad: success rate 0 / quality < 0.3 triggers avoid
      agg.record(makeTelemetry({ modelId: 'bad', domain: 'p5', success: false, outputSizeBytes: 50, generationTimeMs: 200000 }));

      const stats = agg.getDomainStats('p5');
      expect(stats.totalGenerations).toBe(3);
      expect(stats.bestModel).toBe('good');
      expect(stats.avoidModels).toContain('bad');
      expect(stats.overallSuccessRate).toBeCloseTo(1 / 3, 2);
      // Rankings should be sorted by quality descending
      expect(stats.modelRankings[0].modelId).toBe('good');
    });
  });

  // ── checkForIssues() ────────────────────────────────────────────────

  describe('checkForIssues()', () => {
    it('returns empty array when no data exists', () => {
      expect(agg.checkForIssues()).toEqual([]);
    });

    it('detects low overall domain success rate as failure_spike', () => {
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: false }));
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: false }));
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: false }));
      const alerts = agg.checkForIssues();
      const domainAlert = alerts.find(a => a.type === 'failure_spike' && !a.modelId);

      expect(domainAlert!.severity).toBe('high');
      expect(domainAlert!.domain).toBe('p5');
    });

    it('detects per-model low success rate (<0.2 = critical, >=0.2 = high)', () => {
      agg.record(makeTelemetry({ domain: 'glsl', modelId: 'slow-model', success: false }));
      agg.record(makeTelemetry({ domain: 'glsl', modelId: 'slow-model', success: false }));
      agg.record(makeTelemetry({ domain: 'glsl', modelId: 'slow-model', success: false }));
      const alerts = agg.checkForIssues();
      const modelAlert = alerts.find(a => a.modelId === 'slow-model');

      expect(modelAlert!.severity).toBe('critical');
    });

    it('detects per-model low success rate between 0.2 and 0.5 as high severity', () => {
      agg.record(makeTelemetry({ domain: 'hydra', modelId: 'm1', success: false }));
      agg.record(makeTelemetry({ domain: 'hydra', modelId: 'm1', success: false }));
      agg.record(makeTelemetry({ domain: 'hydra', modelId: 'm1', success: true }));
      const alerts = agg.checkForIssues();
      const modelAlert = alerts.find(a => a.modelId === 'm1' && a.type === 'failure_spike');

      expect(modelAlert!.severity).toBe('high');
    });

    it('detects size_regression when avg output size is below minimum', () => {
      // p5 minimum is 500, so use small output with 3+ generations
      for (let i = 0; i < 3; i++) {
        agg.record(makeTelemetry({
          domain: 'p5', modelId: 'tiny-model', success: true, outputSizeBytes: 100,
        }));
      }
      const alerts = agg.checkForIssues();
      const sizeAlert = alerts.find(a => a.type === 'size_regression');

      expect(sizeAlert!.severity).toBe('medium');
      expect(sizeAlert!.message).toContain('tiny-model');
    });

    it('does NOT flag size_regression with fewer than 3 generations', () => {
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: true, outputSizeBytes: 50 }));
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: true, outputSizeBytes: 50 }));
      const alerts = agg.checkForIssues();
      expect(alerts.find(a => a.type === 'size_regression')).toBeUndefined();
    });

    it('detects slow_generation when avg time exceeds threshold', () => {
      agg.record(makeTelemetry({
        domain: 'p5', modelId: 'slow', success: true,
        generationTimeMs: 150_000, // 150s > 120s threshold
      }));
      const alerts = agg.checkForIssues();
      const slowAlert = alerts.find(a => a.type === 'slow_generation');

      expect(slowAlert!.severity).toBe('low');
    });

    it('does not generate alerts for healthy generation data', () => {
      agg.record(makeTelemetry({
        domain: 'p5', modelId: 'good', success: true,
        generationTimeMs: 1000, outputSizeBytes: 2000, userRating: 5,
      }));
      agg.record(makeTelemetry({
        domain: 'p5', modelId: 'good', success: true,
        generationTimeMs: 800, outputSizeBytes: 1800, userRating: 4,
      }));
      const alerts = agg.checkForIssues();
      expect(alerts).toEqual([]);
    });
  });

  // ── exportData() ────────────────────────────────────────────────────

  describe('exportData()', () => {
    it('returns empty summary with no data', () => {
      const data = agg.exportData();
      expect(data.summary.totalGenerations).toBe(0);
      expect(data.summary.totalSuccessful).toBe(0);
      expect(data.summary.overallSuccessRate).toBe(0);
      expect(data.summary.domains).toEqual([]);
      expect(data.summary.models).toEqual([]);
    });

    it('returns full summary with data', () => {
      agg.record(makeTelemetry({ domain: 'p5', modelId: 'm1', success: true }));
      agg.record(makeTelemetry({ domain: 'glsl', modelId: 'm2', success: false }));
      const data = agg.exportData();
      expect(data.summary.totalGenerations).toBe(2);
      expect(data.summary.totalSuccessful).toBe(1);
      expect(data.summary.overallSuccessRate).toBe(0.5);
      expect(data.summary.domains).toEqual(expect.arrayContaining(['p5', 'glsl']));
      expect(data.summary.models).toEqual(expect.arrayContaining(['m1', 'm2']));
    });
  });

  // ── loadData() ──────────────────────────────────────────────────────

  describe('loadData()', () => {
    it('loads historical data and converts timestamps to Date objects', () => {
      agg.loadData({
        generations: [
          { ...makeTelemetry({ id: 'loaded-1' }), timestamp: '2026-01-01T00:00:00Z' } as any,
          { ...makeTelemetry({ id: 'loaded-2' }), timestamp: '2026-01-02T00:00:00Z' } as any,
        ],
      });
      const data = agg.exportData();
      expect(data.summary.totalGenerations).toBe(2);
      expect(data.generations[0].timestamp).toBeInstanceOf(Date);
    });
  });

  // ── clear() ─────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all stored telemetry', () => {
      agg.record(makeTelemetry());
      agg.record(makeTelemetry());
      agg.clear();
      expect(agg.exportData().summary.totalGenerations).toBe(0);
    });
  });

  // ── getTrends() ─────────────────────────────────────────────────────

  describe('getTrends()', () => {
    it('returns empty buckets when no data', () => {
      const trends = agg.getTrends();
      expect(trends.buckets).toEqual([]);
      expect(trends.reasoning).toBeUndefined();
    });

    it('returns daily buckets by default', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T14:00:00Z'), success: false }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-11T09:00:00Z'), success: true }));
      const trends = agg.getTrends();
      expect(trends.buckets.length).toBe(2);
      expect(trends.buckets[0].date).toBe('2026-03-10');
      expect(trends.buckets[0].total).toBe(2);
      expect(trends.buckets[0].successful).toBe(1);
      expect(trends.buckets[0].successRate).toBe(0.5);
      expect(trends.buckets[1].date).toBe('2026-03-11');
      expect(trends.buckets[1].total).toBe(1);
      expect(trends.buckets[1].successRate).toBe(1);
    });

    it('filters by model', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), modelId: 'm1', success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), modelId: 'm2', success: true }));
      const trends = agg.getTrends({ model: 'm1' });
      expect(trends.buckets.length).toBe(1);
      expect(trends.buckets[0].total).toBe(1);
    });

    it('filters by domain', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), domain: 'p5', success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), domain: 'glsl', success: true }));
      const trends = agg.getTrends({ domain: 'glsl' });
      expect(trends.buckets.length).toBe(1);
      expect(trends.buckets[0].total).toBe(1);
    });

    it('filters by date range', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-09T10:00:00Z'), success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-12T10:00:00Z'), success: true }));
      const trends = agg.getTrends({ startDate: '2026-03-10', endDate: '2026-03-11' });
      expect(trends.buckets.length).toBe(1);
      expect(trends.buckets[0].date).toBe('2026-03-10');
    });

    it('returns weekly buckets when granularity is "week"', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-09T10:00:00Z'), success: true }));
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-12T10:00:00Z'), success: true }));
      const trends = agg.getTrends({ granularity: 'week' });
      // Both dates fall in the same ISO week (2026-W10)
      expect(trends.buckets.length).toBe(1);
      expect(trends.buckets[0].date).toMatch(/2026-W\d{2}/);
      expect(trends.buckets[0].total).toBe(2);
    });

    it('computes reasoning trends when reasoning data present', () => {
      agg.record(makeTelemetry({
        timestamp: new Date('2026-03-10T10:00:00Z'),
        success: true,
        reasoningQuality: 0.8,
        reasoningLength: 500,
        detectedPatterns: ['chain-of-thought', 'planning'],
        recoveredFromThinking: true,
      }));
      agg.record(makeTelemetry({
        timestamp: new Date('2026-03-10T12:00:00Z'),
        success: true,
        reasoningQuality: 0.6,
        reasoningLength: 300,
        detectedPatterns: ['chain-of-thought'],
        recoveredFromThinking: false,
      }));
      const trends = agg.getTrends();

      expect(trends.reasoning!.length).toBe(1);
      const r = trends.reasoning![0];
      expect(r.total).toBe(2);
      expect(r.avgQuality).toBe(0.7);
      expect(r.avgReasoningLength).toBe(400);
      expect(r.recoveryRate).toBe(0.5);
      expect(r.patternCounts['chain-of-thought']).toBe(2);
      expect(r.patternCounts['planning']).toBe(1);
    });

    it('does not return reasoning trends when no reasoning data present', () => {
      agg.record(makeTelemetry({ timestamp: new Date('2026-03-10T10:00:00Z'), success: true }));
      const trends = agg.getTrends();
      expect(trends.reasoning).toBeUndefined();
    });
  });
});

describe('globalTelemetry', () => {
  it('is a TelemetryAggregator instance', () => {
    expect(globalTelemetry).toBeInstanceOf(TelemetryAggregator);
  });
});
