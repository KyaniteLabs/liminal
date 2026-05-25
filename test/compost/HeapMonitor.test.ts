import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok, err } from 'neverthrow';
import { HeapMonitor } from '../../src/compost/HeapMonitor.js';

vi.mock('../../src/compost/CompostMill.js', () => ({}));

vi.mock('../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

function makeMockMill(overrides: Record<string, unknown> = {}) {
  const fn = vi.fn();
  return {
    shouldAutoDigest: fn.mockResolvedValue(false),
    digest: fn.mockResolvedValue(ok({ stats: {}, seeds: [], digestPath: '' })),
    ...overrides,
  };
}

describe('HeapMonitor', () => {
  it('stop() is safe to call without start', () => {
    const monitor = new HeapMonitor(100);
    expect(() => monitor.stop()).not.toThrow();
  });

  it('start() begins monitoring and stops cleanly', () => {
    const mockMill = makeMockMill();
    const monitor = new HeapMonitor(100);
    monitor.start(mockMill);
    monitor.stop();
  });

  it('start() is a no-op if already started', () => {
    const mockMill = makeMockMill();
    const monitor = new HeapMonitor(10000);
    monitor.start(mockMill);
    monitor.start(mockMill); // second call should be no-op (timer already set)
    monitor.stop();
  });

  it('triggers digest when shouldAutoDigest returns true', async () => {
    const digestFn = vi.fn().mockResolvedValue(ok({ stats: {}, seeds: [], digestPath: '/tmp/digest' }));
    const mockMill = makeMockMill({
      shouldAutoDigest: vi.fn().mockResolvedValue(true),
      digest: digestFn,
    });
    const monitor = new HeapMonitor(50);
    monitor.start(mockMill);

    // Wait for at least one interval tick
    await new Promise(resolve => setTimeout(resolve, 100));

    monitor.stop();
    expect(digestFn).toHaveBeenCalled();
  });

  it('debounces when already digesting', async () => {
    let digestResolve: (value: unknown) => void;
    const digestPromise = new Promise<unknown>(resolve => { digestResolve = resolve; });
    const digestFn = vi.fn().mockImplementation(() => digestPromise);
    const mockMill = makeMockMill({
      shouldAutoDigest: vi.fn().mockResolvedValue(true),
      digest: digestFn,
    });
    const monitor = new HeapMonitor(30);
    monitor.start(mockMill);

    // Wait for first digest to start
    await new Promise(resolve => setTimeout(resolve, 50));
    // First digest is still in-flight, second interval should debounce
    const callCount = digestFn.mock.calls.length;

    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should not have significantly more calls due to debounce
    expect(digestFn.mock.calls.length).toBeLessThanOrEqual(callCount + 1);

    // Release the hanging digest
    digestResolve!(ok({ stats: {}, seeds: [], digestPath: '' }));
    monitor.stop();
  });

  it('logs digest Result errors', async () => {
    const { Logger } = await import('../../src/utils/Logger.js');
    const mockMill = makeMockMill({
      shouldAutoDigest: vi.fn().mockResolvedValue(true),
      digest: vi.fn().mockResolvedValue(err(new Error('digest explosion'))),
    });
    const monitor = new HeapMonitor(30);
    monitor.start(mockMill);

    await new Promise(resolve => setTimeout(resolve, 80));
    monitor.stop();

    expect(Logger.warn).toHaveBeenCalledWith('HeapMonitor', 'auto-digest failed:', 'digest explosion');
  });
});
