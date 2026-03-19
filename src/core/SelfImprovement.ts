/**
 * Self-improvement callback with configurable safety limits.
 * - Max depth: reject after N recursive "improve me" calls without calling LLM.
 * - Per-request timeout: abort long-running requests.
 * - Optional rate limit: max 1 request per N ms.
 *
 * Context is passed through requestImprovement so callers can track depth
 * across recursive improvement calls.
 */

export interface ImprovementContext {
  /** Current recursion depth (caller must set; increment when recursing). */
  depth: number;
  /** Last request start time (ms); set by requestImprovement for rate limiting. */
  lastRequestTime?: number;
}

export interface RequestImprovementOptions {
  /** Max depth; when context.depth >= maxDepth, reject without calling LLM. Default 3. */
  maxDepth?: number;
  /** Per-request timeout in ms; request is aborted after this. Default 60000. */
  requestTimeoutMs?: number;
  /** Optional rate limit: min ms between requests; reject if called too soon. */
  rateLimitMs?: number;
}

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export type ImprovementGenerator = (
  prompt: string,
  signal?: AbortSignal
) => Promise<string>;

/**
 * Request one improvement step. Enforces max depth, optional rate limit, and
 * per-request timeout. Pass the same context through recursive "improve me"
 * calls; do not call when context.depth >= maxDepth.
 *
 * @param prompt - Improvement prompt
 * @param context - Mutable context (depth, lastRequestTime); updated for rate limiting
 * @param options - Limits (maxDepth, requestTimeoutMs, rateLimitMs)
 * @param generator - Async function that performs the LLM call; receives AbortSignal for timeout
 * @returns Generated code from generator
 * @throws When depth >= maxDepth, or rate limit hit, or request aborted (timeout)
 */
export async function requestImprovement(
  prompt: string,
  context: ImprovementContext,
  options: RequestImprovementOptions,
  generator: ImprovementGenerator
): Promise<string> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const rateLimitMs = options.rateLimitMs;

  if (context.depth >= maxDepth) {
    throw new Error(`Max improvement depth exceeded (depth=${context.depth}, maxDepth=${maxDepth})`);
  }

  if (rateLimitMs != null && context.lastRequestTime != null) {
    const elapsed = Date.now() - context.lastRequestTime;
    if (elapsed < rateLimitMs) {
      throw new Error(`Rate limit: wait ${rateLimitMs - elapsed}ms before next improvement request`);
    }
  }

  context.lastRequestTime = Date.now();

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new DOMException('Request timeout', 'AbortError'));
    }, requestTimeoutMs);
  });

  try {
    const result = await Promise.race([
      generator(prompt, controller.signal),
      timeoutPromise
    ]);
    return result;
  } finally {
    clearTimeout(timeoutId!);
  }
}
