/**
 * Rate Limiter for Meta-Harness
 * 
 * Prevents API abuse and rate limiting:
 * - LLM calls: 5 per minute max
 * - File writes: 10 per minute max  
 * - Build runs: 12 per minute max
 */

interface RateLimitConfig {
  minDelayMs: number;
  maxPerMinute: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  llmCall: { minDelayMs: 2000, maxPerMinute: 5 },
  fileWrite: { minDelayMs: 500, maxPerMinute: 10 },
  fileRead: { minDelayMs: 0, maxPerMinute: 1000 },
  buildRun: { minDelayMs: 5000, maxPerMinute: 12 },
  testRun: { minDelayMs: 5000, maxPerMinute: 6 },
};

export class RateLimiter {
  private lastCall: Map<string, number> = new Map();
  private callHistory: Map<string, number[]> = new Map();
  private limits: Map<string, RateLimitConfig>;

  constructor(customLimits?: Record<string, RateLimitConfig>) {
    this.limits = new Map(Object.entries(customLimits || DEFAULT_LIMITS));
  }

  /**
   * Check if operation is allowed (within burst limit)
   */
  checkBurst(operation: string): { allowed: boolean; retryAfterMs?: number } {
    const config = this.limits.get(operation);
    if (!config) return { allowed: true };

    const now = Date.now();
    const window = 60 * 1000; // 1 minute
    const history = this.callHistory.get(operation) || [];
    
    // Clean old entries
    const recent = history.filter(t => now - t < window);
    
    if (recent.length >= config.maxPerMinute) {
      const oldest = recent[0];
      const retryAfter = window - (now - oldest);
      return { allowed: false, retryAfterMs: retryAfter };
    }
    
    return { allowed: true };
  }

  /**
   * Throttle operation (enforce minimum delay)
   */
  async throttle(operation: string): Promise<void> {
    const config = this.limits.get(operation);
    if (!config || config.minDelayMs === 0) return;

    const last = this.lastCall.get(operation) || 0;
    const elapsed = Date.now() - last;
    
    if (elapsed < config.minDelayMs) {
      await sleep(config.minDelayMs - elapsed);
    }
    
    this.lastCall.set(operation, Date.now());
  }

  /**
   * Record an operation call
   */
  recordCall(operation: string): void {
    const now = Date.now();
    const history = this.callHistory.get(operation) || [];
    history.push(now);
    this.callHistory.set(operation, history);
  }

  /**
   * Execute with rate limiting (burst check + throttle)
   */
  async execute<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<{ result?: T; error?: string; rateLimited?: boolean }> {
    // Check burst limit
    const burstCheck = this.checkBurst(operation);
    if (!burstCheck.allowed) {
      return {
        error: `Rate limit exceeded for ${operation}. Retry after ${Math.ceil((burstCheck.retryAfterMs || 0) / 1000)}s`,
        rateLimited: true,
      };
    }

    // Throttle
    await this.throttle(operation);

    // Record and execute
    this.recordCall(operation);
    
    try {
      const result = await fn();
      return { result };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get current status for an operation
   */
  getStatus(operation: string): {
    callsLastMinute: number;
    limit: number;
    remaining: number;
    timeUntilReset?: number;
  } {
    const config = this.limits.get(operation);
    if (!config) {
      return { callsLastMinute: 0, limit: Infinity, remaining: Infinity };
    }

    const now = Date.now();
    const window = 60 * 1000;
    const history = this.callHistory.get(operation) || [];
    const recent = history.filter(t => now - t < window);
    
    return {
      callsLastMinute: recent.length,
      limit: config.maxPerMinute,
      remaining: Math.max(0, config.maxPerMinute - recent.length),
      timeUntilReset: recent.length > 0 ? window - (now - recent[0]) : 0,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Singleton instance
export const rateLimiter = new RateLimiter();
