/**
 * Unit tests for StagnationDetector — Phase 15
 *
 * Tests stagnation detection from garden health metric history.
 */

import { describe, it, expect } from 'vitest';
import { StagnationDetector } from '../../../src/autonomy/StagnationDetector.js';
import type { GardenHealthMetrics } from '../../../src/autonomy/GardenHealthMonitor.js';

function makeMetrics(overrides: Partial<GardenHealthMetrics> = {}): GardenHealthMetrics {
  return {
    archiveSize: 5,
    nicheOccupancy: 0.5,
    avgLineageDepth: 1,
    fertilityYield: 0.4,
    tasteAlignment: 0.5,
    healthScore: 0.5,
    healthLevel: 'healthy',
    measuredAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('StagnationDetector', () => {
  it('returns not stagnant for insufficient history', () => {
    const detector = new StagnationDetector();
    const result = detector.detect([]);
    expect(result.isStagnant).toBe(false);
    expect(result.severity).toBe(0);
  });

  it('returns not stagnant for single measurement', () => {
    const detector = new StagnationDetector();
    const result = detector.detect([makeMetrics()]);
    expect(result.isStagnant).toBe(false);
  });

  it('detects fertility plateau', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ fertilityYield: 0.4 }),
      makeMetrics({ fertilityYield: 0.4 }),
      makeMetrics({ fertilityYield: 0.4 }),
    ];
    const result = detector.detect(history);
    const fertilitySignal = result.signals.find(s => s.metric === 'fertility');
    expect(fertilitySignal).toBeDefined();
  });

  it('detects niche occupancy plateau', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ nicheOccupancy: 0.3 }),
      makeMetrics({ nicheOccupancy: 0.3 }),
    ];
    const result = detector.detect(history);
    const nicheSignal = result.signals.find(s => s.metric === 'nicheOccupancy');
    expect(nicheSignal).toBeDefined();
  });

  it('detects declining health', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ healthScore: 0.7 }),
      makeMetrics({ healthScore: 0.5 }),
      makeMetrics({ healthScore: 0.3 }),
    ];
    const result = detector.detect(history);
    const healthSignal = result.signals.find(s => s.metric === 'healthScore');
    expect(healthSignal).toBeDefined();
  });

  it('detects taste alignment drop', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ tasteAlignment: 0.7 }),
      makeMetrics({ tasteAlignment: 0.2 }),
    ];
    const result = detector.detect(history);
    const tasteSignal = result.signals.find(s => s.metric === 'tasteAlignment');
    expect(tasteSignal).toBeDefined();
  });

  it('detects archive size stagnation', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ archiveSize: 5 }),
      makeMetrics({ archiveSize: 5 }),
    ];
    const result = detector.detect(history);
    const archiveSignal = result.signals.find(s => s.metric === 'archiveSize');
    expect(archiveSignal).toBeDefined();
  });

  it('declares stagnant when 2+ signals fire', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ fertilityYield: 0.4, nicheOccupancy: 0.3, archiveSize: 5 }),
      makeMetrics({ fertilityYield: 0.4, nicheOccupancy: 0.3, archiveSize: 5 }),
      makeMetrics({ fertilityYield: 0.4, nicheOccupancy: 0.3, archiveSize: 5 }),
    ];
    const result = detector.detect(history);
    expect(result.isStagnant).toBe(true);
    expect(result.severity).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it('returns not stagnant for improving metrics', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ fertilityYield: 0.3, nicheOccupancy: 0.2, archiveSize: 3 }),
      makeMetrics({ fertilityYield: 0.5, nicheOccupancy: 0.4, archiveSize: 5 }),
      makeMetrics({ fertilityYield: 0.7, nicheOccupancy: 0.6, archiveSize: 8 }),
    ];
    const result = detector.detect(history);
    expect(result.isStagnant).toBe(false);
  });

  it('includes recommendations for detected signals', () => {
    const detector = new StagnationDetector();
    const history = [
      makeMetrics({ fertilityYield: 0.4, nicheOccupancy: 0.3, archiveSize: 5 }),
      makeMetrics({ fertilityYield: 0.4, nicheOccupancy: 0.3, archiveSize: 5 }),
    ];
    const result = detector.detect(history);
    for (const rec of result.recommendations) {
      expect(typeof rec).toBe('string');
      expect(rec.length).toBeGreaterThan(10);
    }
  });
});
