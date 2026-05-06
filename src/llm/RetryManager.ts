import { LLMTimeoutError, LLMRateLimitError } from './LLMClient.js';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

type RetryTimingOptions = Required<Omit<RetryOptions, 'signal'>>;

const DEFAULT_OPTIONS: RetryTimingOptions = {
  maxRetries: 5,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
};

export class RetryManager {
  /**
   * Execute a function with exponential backoff retry logic.
   * Only retries LLMTimeoutError and LLMRateLimitError.
   * Non-retryable errors throw immediately.
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      this.throwIfAborted(opts.signal);
      try {
        return await fn();
      } catch (error) {
        if (
          !(error instanceof LLMTimeoutError) &&
          !(error instanceof LLMRateLimitError)
        ) {
          throw error;
        }

        lastError = error as Error;

        if (attempt >= opts.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        let delay = opts.baseDelayMs * Math.pow(2, attempt);

        // Respect retryAfterSeconds from rate limit errors
        if (error instanceof LLMRateLimitError && error.retryAfterSeconds) {
          delay = Math.max(delay, error.retryAfterSeconds * 1000);
        }

        // Cap at max delay
        delay = Math.min(delay, opts.maxDelayMs);

        await this.abortableDelay(delay, opts.signal);
      }
    }

    throw lastError;
  }

  private static abortError(signal?: AbortSignal): Error {
    if (signal?.reason instanceof Error) return signal.reason;
    const error = new Error('Operation aborted');
    error.name = 'AbortError';
    return error;
  }

  private static throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw this.abortError(signal);
  }

  private static async abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
    this.throwIfAborted(signal);
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, delayMs);

      function cleanup(): void {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
      }

      function onAbort(): void {
        cleanup();
        reject(RetryManager.abortError(signal));
      }

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Run tasks with a concurrency limit, collecting allSettled results.
   */
  static async mapSettled<T>(
    items: T[],
    fn: (item: T, index: number) => Promise<unknown>,
    concurrency: number,
  ): Promise<PromiseSettledResult<unknown>[]> {
    const results: PromiseSettledResult<unknown>[] = [];
    let nextIndex = 0;

    async function worker(): Promise<void> {
      while (nextIndex < items.length) {
        const i = nextIndex++;
        try {
          const value = await fn(items[i], i);
          results[i] = { status: 'fulfilled', value };
        } catch (err) {
          results[i] = { status: 'rejected', reason: err };
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }
}
