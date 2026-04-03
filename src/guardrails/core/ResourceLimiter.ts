/**
 * Constraint Layer - Resource Limiting
 * 
 * Enforces hard limits on:
 * - Token usage
 * - Memory consumption
 * - Execution time
 * - API call frequency
 */

import { ResourceUsage } from './types.js';

export interface ResourceLimits {
  /** Maximum tokens per task */
  maxTokens: number;
  
  /** Maximum memory in MB */
  maxMemoryMB: number;
  
  /** Maximum execution time in ms */
  maxTimeMs: number;
  
  /** Maximum API calls per task */
  maxApiCalls: number;
  
  /** Maximum tokens per individual request */
  maxTokensPerRequest?: number;
  
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
}

export interface ResourceCheckResult {
  allowed: boolean;
  resource: keyof ResourceUsage;
  current: number;
  limit: number;
  message: string;
}

/**
 * Resource limiter with tracking and enforcement
 */
export class ResourceLimiter {
  private limits: ResourceLimits;
  private usage: ResourceUsage;
  private startTime: number;
  
  constructor(limits: Partial<ResourceLimits> = {}) {
    this.limits = {
      maxTokens: 100000,
      maxMemoryMB: 512,
      maxTimeMs: 300000, // 5 minutes
      maxApiCalls: 50,
      ...limits,
    };
    
    this.startTime = Date.now();
    this.usage = {
      tokensUsed: 0,
      tokensLimit: this.limits.maxTokens,
      memoryUsedMB: 0,
      memoryLimitMB: this.limits.maxMemoryMB,
      timeElapsedMs: 0,
      timeLimitMs: this.limits.maxTimeMs,
      apiCalls: 0,
      apiCallLimit: this.limits.maxApiCalls,
    };
  }
  
  /**
   * Check all resources before operation
   */
  checkAll(): ResourceCheckResult[] {
    const results: ResourceCheckResult[] = [];
    
    // Update time elapsed
    this.usage.timeElapsedMs = Date.now() - this.startTime;
    
    // Check tokens
    results.push({
      allowed: this.usage.tokensUsed < this.limits.maxTokens,
      resource: 'tokensUsed',
      current: this.usage.tokensUsed,
      limit: this.limits.maxTokens,
      message: `Token usage: ${this.usage.tokensUsed}/${this.limits.maxTokens}`,
    });
    
    // Check memory
    this.updateMemoryUsage();
    results.push({
      allowed: this.usage.memoryUsedMB < this.limits.maxMemoryMB,
      resource: 'memoryUsedMB',
      current: this.usage.memoryUsedMB,
      limit: this.limits.maxMemoryMB,
      message: `Memory usage: ${this.usage.memoryUsedMB.toFixed(1)}/${this.limits.maxMemoryMB} MB`,
    });
    
    // Check time
    results.push({
      allowed: this.usage.timeElapsedMs < this.limits.maxTimeMs,
      resource: 'timeElapsedMs',
      current: this.usage.timeElapsedMs,
      limit: this.limits.maxTimeMs,
      message: `Time elapsed: ${(this.usage.timeElapsedMs / 1000).toFixed(1)}/${(this.limits.maxTimeMs / 1000).toFixed(0)}s`,
    });
    
    // Check API calls
    results.push({
      allowed: this.usage.apiCalls < this.limits.maxApiCalls,
      resource: 'apiCalls',
      current: this.usage.apiCalls,
      limit: this.limits.maxApiCalls,
      message: `API calls: ${this.usage.apiCalls}/${this.limits.maxApiCalls}`,
    });
    
    return results;
  }
  
  /**
   * Check if operation is allowed
   */
  isAllowed(): boolean {
    return this.checkAll().every(r => r.allowed);
  }
  
  /**
   * Get first blocking resource check
   */
  getFirstViolation(): ResourceCheckResult | undefined {
    return this.checkAll().find(r => !r.allowed);
  }
  
  /**
   * Record token usage
   */
  recordTokens(tokens: number): void {
    this.usage.tokensUsed += tokens;
  }
  
  /**
   * Record API call
   */
  recordApiCall(): void {
    this.usage.apiCalls++;
  }
  
  /**
   * Estimate tokens for text
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Check if proposed token usage would exceed limit
   */
  canUseTokens(proposedTokens: number): boolean {
    return (this.usage.tokensUsed + proposedTokens) <= this.limits.maxTokens;
  }
  
  /**
   * Get remaining budget for a resource
   */
  getRemaining(resource: keyof ResourceUsage): number {
    const current = this.usage[resource];
    const limit = this.getLimit(resource);
    return Math.max(0, limit - current);
  }
  
  /**
   * Get usage percentage for a resource
   */
  getUsagePercent(resource: keyof ResourceUsage): number {
    const current = this.usage[resource];
    const limit = this.getLimit(resource);
    return (current / limit) * 100;
  }
  
  /**
   * Get current resource usage snapshot
   */
  getUsage(): ResourceUsage {
    this.usage.timeElapsedMs = Date.now() - this.startTime;
    this.updateMemoryUsage();
    return { ...this.usage };
  }
  
  /**
   * Get current limits
   */
  getLimits(): ResourceLimits {
    return { ...this.limits };
  }
  
  /**
   * Update memory usage (Node.js specific)
   */
  private updateMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.usage.memoryUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    }
  }
  
  /**
   * Get limit for a resource
   */
  private getLimit(resource: keyof ResourceUsage): number {
    switch (resource) {
      case 'tokensUsed':
        return this.limits.maxTokens;
      case 'memoryUsedMB':
        return this.limits.maxMemoryMB;
      case 'timeElapsedMs':
        return this.limits.maxTimeMs;
      case 'apiCalls':
        return this.limits.maxApiCalls;
      default:
        return 0;
    }
  }
}

/**
 * Global resource limiter factory
 */
const limiters: Map<string, ResourceLimiter> = new Map();

export function createResourceLimiter(
  taskId: string,
  limits?: Partial<ResourceLimits>
): ResourceLimiter {
  const limiter = new ResourceLimiter(limits);
  limiters.set(taskId, limiter);
  return limiter;
}

export function getResourceLimiter(taskId: string): ResourceLimiter | undefined {
  return limiters.get(taskId);
}

export function removeResourceLimiter(taskId: string): void {
  limiters.delete(taskId);
}

export function getAllResourceLimiters(): Map<string, ResourceLimiter> {
  return new Map(limiters);
}
