import { describe, it, expect, vi } from 'vitest';
import { ContextCompactor } from '../../src/llm/ContextCompactor.js';

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('ContextCompactor', () => {
  it('returns messages unchanged when under maxMessages', async () => {
    const compactor = new ContextCompactor({ maxMessages: 20 });
    const msgs = [
      { role: 'system' as const, content: 'you are helpful' },
      { role: 'user' as const, content: 'hello' },
    ];
    const result = await compactor.compact(msgs);
    expect(result).toEqual(msgs);
  });

  it('needsCompaction returns true when over threshold', () => {
    const compactor = new ContextCompactor({ maxMessages: 5 });
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const, content: `msg ${i}`,
    }));
    expect(compactor.needsCompaction(msgs)).toBe(true);
  });

  it('getStats reports correct reduction', () => {
    const compactor = new ContextCompactor();
    const original = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const, content: `msg ${i}`,
    }));
    const compacted = original.slice(0, 5);
    const stats = compactor.getStats(original, compacted);
    expect(stats.reduction).toBe(5);
    expect(stats.reductionPercent).toBe(50);
  });
});
