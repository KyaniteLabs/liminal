/**
 * Integration test: MetabolicEntropyEngine genesis fallback.
 *
 * Verifies that when the primary harvester fails (e.g., eventStore throws),
 * the engine falls back to genesis mode using git/package metadata without
 * throwing, and returns a degraded-quality result.
 */

import { describe, it, expect } from 'vitest';
import { MetabolicEntropyEngine } from '../../src/entropy/MetabolicEntropyEngine.js';

describe('MetabolicEntropyEngine genesis fallback', () => {
  it('falls back to genesis when eventStore throws', async () => {
    const entropy = new MetabolicEntropyEngine({
      eventStore: {
        getRecent: () => {
          throw new Error('event store unreachable');
        },
      },
      heap: { listFiles: async () => [] },
      telemetry: {
        getSummary: () => ({
          successRate: 0,
          avgDurationMs: 0,
          totalTasks: 0,
          totalViolations: 0,
        }),
      },
    });

    const result = await entropy.harvest();

    expect(result.quality).toBe('degraded');
    expect(result.source).toBe('genesis');
    expect(typeof result.seed).toBe('number');
    expect(typeof result.phrase).toBe('string');
    expect(Array.isArray(result.hashChain)).toBe(true);
  });

  it('returns a usable float after genesis fallback', async () => {
    const entropy = new MetabolicEntropyEngine({
      eventStore: {
        getRecent: () => {
          throw new Error('event store unreachable');
        },
      },
      heap: { listFiles: async () => [] },
      telemetry: {
        getSummary: () => ({
          successRate: 0,
          avgDurationMs: 0,
          totalTasks: 0,
          totalViolations: 0,
        }),
      },
    });

    await entropy.harvest();
    const floatValue = entropy.nextFloat();

    expect(floatValue).toBeGreaterThanOrEqual(0);
    expect(floatValue).toBeLessThan(1);
  });

  it('returns a usable int after genesis fallback', async () => {
    const entropy = new MetabolicEntropyEngine({
      eventStore: {
        getRecent: () => {
          throw new Error('event store unreachable');
        },
      },
      heap: { listFiles: async () => [] },
      telemetry: {
        getSummary: () => ({
          successRate: 0,
          avgDurationMs: 0,
          totalTasks: 0,
          totalViolations: 0,
        }),
      },
    });

    await entropy.harvest();
    const intValue = entropy.nextInt(100);

    expect(Number.isInteger(intValue)).toBe(true);
    expect(intValue).toBeGreaterThanOrEqual(0);
    expect(intValue).toBeLessThan(100);
  });
});
