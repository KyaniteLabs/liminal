import { describe, it, expect, vi } from 'vitest';
import { MetabolicEntropyEngine } from '../../../src/entropy/MetabolicEntropyEngine.js';

describe('MetabolicEntropyEngine', () => {
  function makeEngine(opts?: { getRecentReturn?: unknown[] }) {
    return new MetabolicEntropyEngine({
      eventStore: { getRecent: vi.fn().mockReturnValue(opts?.getRecentReturn ?? []) },
      heap: { listFiles: vi.fn().mockResolvedValue([]) },
      telemetry: { getSummary: vi.fn().mockReturnValue({ successRate: 1, avgDurationMs: 10, totalTasks: 1, totalViolations: 0 }) },
      compressor: {
        compress: vi.fn().mockReturnValue({ seed: 12345, phrase: 'spark seed root branch', hashChain: ['a', 'b', 'c', 'd'] }),
      },
    });
  }

  it('harvest returns harvested quality when metabolic data is available', async () => {
    const engine = makeEngine({ getRecentReturn: [{ type: 'digest_end' }] });
    const result = await engine.harvest();
    expect(result.quality).toBe('harvested');
    expect(result.source).toBe('metabolic');
    expect(result.seed).toBe(12345);
  });

  it('nextFloat returns a number between 0 and 1', async () => {
    const engine = makeEngine();
    await engine.harvest();
    const v = engine.nextFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it('nextInt returns an integer in range', async () => {
    const engine = makeEngine();
    await engine.harvest();
    const v = engine.nextInt(100);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(100);
  });

  it('returns emergency fallback after 3 harvest crashes', async () => {
    const engine = new MetabolicEntropyEngine({
      eventStore: { getRecent: vi.fn().mockReturnValue([]) },
      heap: { listFiles: vi.fn().mockRejectedValue(new Error('boom')) },
      telemetry: { getSummary: vi.fn().mockReturnValue({ successRate: 1, avgDurationMs: 10, totalTasks: 1, totalViolations: 0 }) },
      compressor: { compress: vi.fn().mockImplementation(() => { throw new Error('compressor fail'); }) },
    });

    const r1 = await engine.harvest();
    const r2 = await engine.harvest();
    const r3 = await engine.harvest();
    const r4 = await engine.harvest();
    const r5 = await engine.harvest();

    expect(r3.quality).toBe('emergency');
    expect(r3.source).toBe('fallback');
  });

  it('nextFloat returns a fallback value before harvest is called', () => {
    const engine = makeEngine();
    const v = engine.nextFloat();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
