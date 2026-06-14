import { describe, it, expect } from 'vitest';
import { Result, ok } from 'neverthrow';
import { BaseProvider } from '../../../src/llm/providers/BaseProvider.js';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../../../src/llm/ProviderTypes.js';
import type { LLMError } from '../../../src/llm/errors.js';

// Minimal concrete subclass that exposes the protected withTimeout for behavioral testing.
class TestProvider extends BaseProvider {
  readonly name = 'test';
  async generate(_req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    return ok({ content: '', model: this.config.model });
  }
  // eslint-disable-next-line require-yield
  async *stream(_req: ProviderRequest): AsyncGenerator<StreamEvent> {
    return;
  }
  get capabilities(): ProviderCapabilities {
    return { thinking: false, streaming: false, jsonMode: false, toolUse: false, vision: false };
  }
  public exposeWithTimeout(reqSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
    return this.withTimeout(reqSignal, timeoutMs);
  }
}

const provider = new TestProvider({ baseUrl: 'http://x', model: 'm' } as never);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('BaseProvider.withTimeout', () => {
  it('bounds the call by the timeout when no caller signal is given', async () => {
    const signal = provider.exposeWithTimeout(undefined, 30);
    expect(signal.aborted).toBe(false);
    await delay(70);
    expect(signal.aborted).toBe(true);
  });

  it('STILL fires the timeout when the caller passes a never-aborting signal (the bug fix)', async () => {
    const caller = new AbortController(); // never aborted
    const signal = provider.exposeWithTimeout(caller.signal, 30);
    expect(signal.aborted).toBe(false);
    await delay(70);
    // Previously `req.signal || AbortSignal.timeout(...)` returned caller.signal and never aborted.
    expect(signal.aborted).toBe(true);
  });

  it('aborts immediately when the caller signal is already aborted', () => {
    const caller = new AbortController();
    caller.abort(new Error('caller cancelled'));
    const signal = provider.exposeWithTimeout(caller.signal, 10_000);
    expect(signal.aborted).toBe(true);
  });

  it('propagates caller cancellation that happens before the timeout', async () => {
    const caller = new AbortController();
    const signal = provider.exposeWithTimeout(caller.signal, 10_000);
    expect(signal.aborted).toBe(false);
    caller.abort(new Error('caller cancelled'));
    await delay(5);
    expect(signal.aborted).toBe(true);
  });
});
