import { describe, expect, it, vi } from 'vitest';
import {
  AbortError,
  abortError,
  abortable,
  combineAbortSignals,
  isAbortError,
  throwIfAborted,
} from '../../../src/utils/abort.js';

describe('AbortError', () => {
  it('uses default message', () => {
    const err = new AbortError();
    expect(err.message).toBe('Operation aborted');
    expect(err.name).toBe('AbortError');
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts custom message', () => {
    const err = new AbortError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('isAbortError', () => {
  it('returns true for AbortError name', () => {
    expect(isAbortError(new AbortError())).toBe(true);
  });

  it('returns true for "Generation aborted" message', () => {
    const err = new Error('Generation aborted');
    err.name = 'DOMException';
    expect(isAbortError(err)).toBe(true);
  });

  it('returns true for "Operation aborted" message', () => {
    const err = new Error('Operation aborted');
    expect(isAbortError(err)).toBe(true);
  });

  it('returns false for non-Error values', () => {
    expect(isAbortError('string')).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError(42)).toBe(false);
  });

  it('returns false for unrelated errors', () => {
    expect(isAbortError(new Error('something else'))).toBe(false);
  });
});

describe('abortError', () => {
  it('returns default error when no signal', () => {
    const err = abortError();
    expect(err.message).toBe('Operation aborted');
  });

  it('extracts message from Error reason', () => {
    const reason = new Error('timeout exceeded');
    const controller = new AbortController();
    controller.abort(reason);
    const err = abortError(controller.signal);
    expect(err.message).toBe('timeout exceeded');
    expect(err.stack).toBe(reason.stack);
  });

  it('uses default when Error reason has empty message', () => {
    const controller = new AbortController();
    controller.abort(new Error(''));
    const err = abortError(controller.signal);
    expect(err.message).toBe('Operation aborted');
  });

  it('uses string reason as message', () => {
    const controller = new AbortController();
    controller.abort('user cancelled');
    const err = abortError(controller.signal);
    expect(err.message).toBe('user cancelled');
  });

  it('falls back to default for non-string, non-Error reason', () => {
    const controller = new AbortController();
    controller.abort({ code: 123 });
    const err = abortError(controller.signal);
    expect(err.message).toBe('Operation aborted');
  });

  it('falls back for empty string reason', () => {
    const controller = new AbortController();
    controller.abort('');
    const err = abortError(controller.signal);
    expect(err.message).toBe('Operation aborted');
  });
});

describe('throwIfAborted', () => {
  it('does nothing when signal is undefined', () => {
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });

  it('does nothing when signal is not aborted', () => {
    const controller = new AbortController();
    expect(() => throwIfAborted(controller.signal)).not.toThrow();
  });

  it('throws when signal is aborted', () => {
    const controller = new AbortController();
    controller.abort('stop');
    expect(() => throwIfAborted(controller.signal)).toThrow('stop');
  });
});

describe('combineAbortSignals', () => {
  it('returns undefined for no signals', () => {
    expect(combineAbortSignals()).toBeUndefined();
    expect(combineAbortSignals(undefined, undefined)).toBeUndefined();
  });

  it('returns single signal directly', () => {
    const controller = new AbortController();
    const result = combineAbortSignals(controller.signal);
    expect(result).toBe(controller.signal);
  });

  it('returns combined signal for multiple signals', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);
    expect(combined).toBeDefined();
    expect(combined!.aborted).toBe(false);
  });

  it('aborts combined signal when first signal aborts', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);
    c1.abort('first abort');
    expect(combined!.aborted).toBe(true);
  });

  it('aborts combined signal when second signal aborts', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);
    c2.abort('second abort');
    expect(combined!.aborted).toBe(true);
  });

  it('returns aborted signal when a pre-aborted signal is provided', () => {
    const c1 = new AbortController();
    c1.abort('already dead');
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);
    expect(combined!.aborted).toBe(true);
  });

  it('filters out undefined signals', () => {
    const c1 = new AbortController();
    const combined = combineAbortSignals(undefined, c1.signal, undefined);
    expect(combined).toBe(c1.signal);
  });
});

describe('abortable', () => {
  it('returns operation result when no signal', async () => {
    const result = await abortable(Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('returns operation result when signal is not aborted', async () => {
    const controller = new AbortController();
    const result = await abortable(Promise.resolve('hello'), controller.signal);
    expect(result).toBe('hello');
  });

  it('throws immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort('stopped');
    await expect(abortable(Promise.resolve(1), controller.signal)).rejects.toThrow('stopped');
  });

  it('rejects when signal aborts during operation', async () => {
    const controller = new AbortController();
    let rejectOp: (err: Error) => void;
    const operation = new Promise<string>((_, reject) => {
      rejectOp = reject;
    });
    const promise = abortable(operation, controller.signal);
    controller.abort('mid-flight abort');
    await expect(promise).rejects.toThrow('mid-flight abort');
  });

  it('propagates operation rejection when not aborted', async () => {
    const controller = new AbortController();
    await expect(abortable(Promise.reject(new Error('op failed')), controller.signal)).rejects.toThrow(
      'op failed',
    );
  });
});
