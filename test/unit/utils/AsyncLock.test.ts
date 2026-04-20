import { describe, it, expect } from 'vitest';
import { AsyncLock } from '../../../src/utils/AsyncLock.js';

describe('AsyncLock', () => {
  it('acquire runs function and returns result', async () => {
    const lock = new AsyncLock();
    const result = await lock.acquire(() => 42);
    expect(result).toBe(42);
  });

  it('acquire runs async function and returns result', async () => {
    const lock = new AsyncLock();
    const result = await lock.acquire(async () => 'hello');
    expect(result).toBe('hello');
  });

  it('serializes concurrent access', async () => {
    const lock = new AsyncLock();
    const order: number[] = [];

    const p1 = lock.acquire(async () => {
      order.push(1);
      await new Promise(r => setTimeout(r, 50));
      order.push(2);
    });
    const p2 = lock.acquire(async () => {
      order.push(3);
      await new Promise(r => setTimeout(r, 10));
      order.push(4);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it('resolves waiters in FIFO order', async () => {
    const lock = new AsyncLock();
    const results: string[] = [];

    const p1 = lock.acquire(async () => {
      results.push('a-start');
      await new Promise(r => setTimeout(r, 20));
      results.push('a-end');
    });
    const p2 = lock.acquire(async () => {
      results.push('b-start');
    });
    const p3 = lock.acquire(async () => {
      results.push('c-start');
    });

    await Promise.all([p1, p2, p3]);
    expect(results).toEqual(['a-start', 'a-end', 'b-start', 'c-start']);
  });

  it('releases lock even when function throws', async () => {
    const lock = new AsyncLock();
    await expect(
      lock.acquire(() => { throw new Error('boom'); })
    ).rejects.toThrow('boom');

    // Lock should be available again
    const result = await lock.acquire(() => 'recovered');
    expect(result).toBe('recovered');
  });
});
