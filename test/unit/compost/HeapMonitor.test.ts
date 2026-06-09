import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeapMonitor } from '../../../src/compost/HeapMonitor.js';

// vi.hoisted for mock used in vi.mock factory
const { mockShouldAutoDigest, mockDigest } = vi.hoisted(() => ({
  mockShouldAutoDigest: vi.fn(),
  mockDigest: vi.fn(),
}));

vi.mock('../../../src/compost/CompostMill.js', () => ({
  CompostMill: vi.fn().mockImplementation(() => ({
    shouldAutoDigest: mockShouldAutoDigest,
    digest: mockDigest,
  })),
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('HeapMonitor', () => {
  let monitor: HeapMonitor;
  let mockMill: { shouldAutoDigest: typeof mockShouldAutoDigest; digest: typeof mockDigest };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    monitor = new HeapMonitor(100);
    mockMill = { shouldAutoDigest: mockShouldAutoDigest, digest: mockDigest };
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it('does not start a second timer if already running', () => {
    mockShouldAutoDigest.mockResolvedValue(false);
    monitor.start(mockMill as any);
    monitor.start(mockMill as any); // second call should be no-op

    vi.advanceTimersByTime(100);
    expect(mockShouldAutoDigest).toHaveBeenCalledTimes(1);
  });

  it('triggers digest when shouldAutoDigest returns true', async () => {
    mockShouldAutoDigest.mockResolvedValue(true);
    mockDigest.mockResolvedValue(undefined);

    monitor.start(mockMill as any);
    vi.advanceTimersByTime(100);

    // Flush microtasks from the async IIFE without running all timers
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDigest).toHaveBeenCalledTimes(1);
  });

  it('skips digest when shouldAutoDigest returns false', async () => {
    mockShouldAutoDigest.mockResolvedValue(false);

    monitor.start(mockMill as any);
    vi.advanceTimersByTime(100);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockDigest).not.toHaveBeenCalled();
  });

  it('debounces — skips digest if already digesting', async () => {
    let digestResolve!: () => void;
    mockShouldAutoDigest.mockResolvedValue(true);
    mockDigest.mockImplementation(() => new Promise<void>(resolve => { digestResolve = resolve; }));

    monitor.start(mockMill as any);

    // First tick starts digest (which hangs)
    vi.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDigest).toHaveBeenCalledTimes(1);

    // Second tick — shouldAutoDigest called but digesting=true
    vi.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();

    // digest was NOT called a second time (debounced)
    expect(mockDigest).toHaveBeenCalledTimes(1);

    // Resolve the hanging digest
    digestResolve();
    await Promise.resolve();
  });

  it('recovers from digest error', async () => {
    mockShouldAutoDigest.mockResolvedValue(true);
    mockDigest.mockRejectedValue(new Error('digest boom'));

    monitor.start(mockMill as any);
    vi.advanceTimersByTime(100);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // After error, digesting reset to false
    // Advance another tick — should call shouldAutoDigest again
    mockShouldAutoDigest.mockResolvedValue(false);
    vi.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockShouldAutoDigest).toHaveBeenCalledTimes(2);
  });

  it('stop clears the interval', async () => {
    mockShouldAutoDigest.mockResolvedValue(false);

    monitor.start(mockMill as any);
    monitor.stop();

    vi.advanceTimersByTime(500);

    expect(mockShouldAutoDigest).not.toHaveBeenCalled();
  });

  it('stop is safe when not started', () => {
    expect(() => monitor.stop()).not.toThrow();
  });
});
