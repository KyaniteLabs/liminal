import { describe, it, expect, vi } from 'vitest';
import { EntropyHarvester } from '../../../src/entropy/EntropyHarvester.js';

describe('EntropyHarvester', () => {
  it('gathers metabolic input from all sources', async () => {
    const eventStore = { getRecent: vi.fn().mockReturnValue([{ type: 'digest_end', id: 1 }]) };
    const heap = { listFiles: vi.fn().mockResolvedValue(['a.js', 'b.js']) };
    const telemetry = { getSummary: vi.fn().mockReturnValue({ successRate: 0.8, avgDurationMs: 100, totalTasks: 5, totalViolations: 0 }) };
    const getTopSeeds = vi.fn().mockResolvedValue([{ id: 's1', content: 'seed one', score: 9.5 }]);

    const harvester = new EntropyHarvester({ eventStore, heap, telemetry, getTopSeeds });
    const result = await harvester.gather();

    expect(result).toContain('[EVENTS]');
    expect(result).toContain('[FRAGMENTS]');
    expect(result).toContain('[TELEMETRY]');
    expect(result).toContain('a.js');
    expect(result).toContain('s1');
    expect(result).toContain('0.8');
  });

  it('survives when getTopSeeds is omitted', async () => {
    const eventStore = { getRecent: vi.fn().mockReturnValue([]) };
    const heap = { listFiles: vi.fn().mockResolvedValue([]) };
    const telemetry = { getSummary: vi.fn().mockReturnValue({ successRate: 0, avgDurationMs: 0, totalTasks: 0, totalViolations: 0 }) };

    const harvester = new EntropyHarvester({ eventStore, heap, telemetry });
    const result = await harvester.gather();

    expect(result).toContain('[EVENTS]');
    expect(result).toContain('[FRAGMENTS]');
    expect(result).toContain('[TELEMETRY]');
  });
});
