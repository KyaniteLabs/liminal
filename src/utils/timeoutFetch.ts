/**
 * Fetch with timeout and error handling.
 * All LLM/API calls should use this instead of bare fetch()
 * to prevent indefinite hangs when remote servers flake.
 */

export interface TimeoutFetchOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Request to ${url} timed out after ${ms}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    url: string,
  ) {
    super(`HTTP ${status}: ${statusText} for ${url}`);
    this.name = 'FetchHttpError';
  }
}

/**
 * Drop-in replacement for fetch() with timeout and HTTP error handling.
 *
 * @param url - The URL to fetch
 * @param opts - Standard RequestInit plus optional `timeout` (default 30s)
 * @returns The Response object (only if response.ok is true)
 * @throws FetchTimeoutError if the request exceeds the timeout
 * @throws FetchHttpError if the response status is not ok
 */
export async function timeoutFetch(
  url: string,
  opts: TimeoutFetchOptions = {},
): Promise<Response> {
  const { timeout = 30_000, ...fetchOpts } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOpts,
      signal: fetchOpts.signal
        ? AbortSignal.any([fetchOpts.signal, controller.signal])
        : controller.signal,
    });

    if (!response.ok) {
      throw new FetchHttpError(response.status, response.statusText, url);
    }

    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeout);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
