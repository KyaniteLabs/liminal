import { LLMTimeoutError, LLMRateLimitError } from './LLMClient.js';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
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

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
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
