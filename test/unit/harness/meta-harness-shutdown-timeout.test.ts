import { afterEach, describe, expect, it, vi } from 'vitest';
import { withShutdownTimeout } from '../../../src/harness/MetaHarnessIntegration.js';

describe('withShutdownTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears the shutdown guard timer after a fast shutdown resolves', async () => {
    vi.useFakeTimers();

    await expect(withShutdownTimeout(Promise.resolve('stopped'), 5000)).resolves.toBe('stopped');

    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects when shutdown exceeds the timeout', async () => {
    vi.useFakeTimers();

    const result = withShutdownTimeout(new Promise(() => undefined), 5000);
    const expectation = expect(result).rejects.toThrow('Shutdown timeout');
    await vi.advanceTimersByTimeAsync(5000);

    await expectation;
    expect(vi.getTimerCount()).toBe(0);
  });
});
